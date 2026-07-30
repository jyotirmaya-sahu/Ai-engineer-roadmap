# Context Length

**What it is:** The maximum amount of text — measured in tokens — a model can "see" in a single call, covering your prompt, any documents you paste in, the conversation so far, *and* the reply it generates.

## Why it matters for an AI Engineer

Context length is a hard wall. Exceed it and the API rejects the request or silently drops the oldest text. It decides how much of a document you can feed a model, how long a chat can run before it "forgets" the start, and how much retrieved context a RAG system can stuff in. It also drives cost: you pay per token, so a model that *accepts* a million tokens will *charge* you for a million tokens if you actually fill it. Knowing the limits — and not naively filling them — is core to building apps that don't break or bankrupt you.

## The mechanism / how it works

Models don't read characters; they read **tokens** — chunks of ~4 characters of English (a short word, a word-piece, or punctuation). "Dubai" might be one token; "unbelievable" might be three. Roughly **1 token ≈ 0.75 words**, so 1,000 tokens ≈ 750 words ≈ 1.5 pages.

The **context window** is the total token budget per call. Critically, it's shared:

```
context window  =  system prompt  +  chat history  +  retrieved docs  +  user message  +  the model's reply
```

If the window is 200k tokens and you paste 199k tokens of documents, only ~1k are left for the answer — the model gets truncated mid-sentence. You must budget input *and* reserve room for output.

Typical 2026 windows: mid models ~128k tokens; Claude ~200k; Gemini up to ~1–2M. A million tokens is roughly a 1,500-page book in one call.

<div class="diagram">
  <div class="dstack">
    <span class="dbox blue">System prompt<span class="sub">~1k</span></span>
    <span class="dbox blue">Chat history<span class="sub">grows every turn</span></span>
    <span class="dbox orange">Retrieved docs (RAG)<span class="sub">the big variable</span></span>
    <span class="dbox gray">User message</span>
    <span class="dbox green">↳ reserved for the reply</span>
  </div>
  <div class="dcap">Everything shares one token budget. Fill it with input and the model has no room to answer.</div>
</div>

Two traps beyond the raw number:

1. **"Lost in the middle."** Even within a huge window, models attend best to the *start* and *end*. Bury the key fact in the middle of 500k tokens and recall drops. Bigger windows don't remove the need for good [chunking and retrieval](../chunking.md) — they just raise the ceiling.
2. **Cost and latency scale with tokens used.** Attention cost grows fast with sequence length, so a 500k-token call is both expensive and slow (high time-to-first-token). Long context is a capability, not a default.

## Concrete example — count before you send

```python
# Anthropic exposes a token counter so you can budget before spending
from anthropic import Anthropic
client = Anthropic()
doc = open("contract.txt").read()
count = client.messages.count_tokens(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": doc}],
)
print(count.input_tokens)          # e.g. 240_000
# window is ~200k → this WON'T fit. Chunk + retrieve instead of pasting whole.
```

The lesson: don't assume; *measure* token count against the window, and if the doc doesn't fit, retrieve the relevant chunks instead of dumping everything.

## How a company uses this

A Dubai law firm reviewing 300-page loan agreements first tried pasting whole contracts into a 200k-window model — some documents overflowed, and even when they fit, the ~200k-token calls cost ~$0.60 each and took 15+ seconds to first token. They switched to RAG: chunk the contract, embed it, retrieve only the ~8 relevant clauses (~4k tokens) per question. Same model, but calls dropped to ~$0.02 and ~1.5s, and accuracy *rose* because the model wasn't hunting through 200k tokens for one clause. Long context is the safety net; retrieval is the everyday tool.

## Common mistakes
- **Filling the window "because it's there."** You pay for every token and hurt recall via lost-in-the-middle.
- **Forgetting the reply needs room.** Reserve output tokens or you get truncated answers.
- **Treating giant context as a replacement for RAG.** It's slower, pricier, and less accurate than targeted retrieval for most real workloads.

## Interview tip
Say: *"Context length is the shared token budget for prompt, history, retrieved docs, and the reply — so I budget input and reserve output room, and I count tokens before sending. Big windows (200k–2M) are a safety net, but I still prefer retrieval because attention degrades in the middle of long context and cost/latency scale with tokens used. Long context complements RAG; it doesn't replace it."*
