# tokenizers

**What it is:** The component that converts **text ↔ token IDs** — splitting "unbelievable" into pieces like `un`, `believ`, `able`, mapping each to an integer the model can process, and mapping the model's output integers back to text. Hugging Face's `tokenizers` library does this extremely fast.

## Why it matters for an AI Engineer

Models don't read characters — they read token IDs, and *every* model has its own vocabulary. Tokenizers are where you get **exact** token counts (not the "~4 chars" guess from [Usage & token counting](/working-with-llm-apis/usage-token-counting)), which drives cost, context-window budgeting, and [chunking](../chunking/sentence-token-based.md). They also explain surprising behavior: why a model "can't count letters" (it sees tokens, not letters), why Arabic and code cost more tokens, and why a prompt that fit yesterday overflows today after a model swap. Understanding tokenization is the difference between guessing at limits and *knowing* them.

## The mechanism — how it works

Modern LLMs use **subword tokenization**, usually **Byte-Pair Encoding (BPE)** or a variant. The idea:

- Start from a **vocabulary** learned during training — common words are single tokens (`the`, ` Dubai`), rare words split into subword pieces (`tokeniz` + `ation`), and truly novel strings fall back to bytes. This keeps the vocabulary finite (~50k–200k tokens) while representing *any* text.
- **Encoding**: text → a list of integer IDs, greedily matching the longest known pieces.
- **Decoding**: IDs → text, concatenating the pieces back.
- **Special tokens** mark structure: beginning-of-sequence, end-of-turn, role markers. Chat templates insert these.

Consequences you must internalize:
- **Leading spaces matter** — ` Dubai` and `Dubai` are often *different* tokens.
- **Non-English and code tokenize into more tokens per character** — Arabic script and JSON/code fragment more, so the same visible length costs more.
- **Each model family has its own tokenizer** — counts from one don't transfer to another.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">"tokenization"</span>
    <span class="darr">→<span class="lbl">BPE</span></span>
    <span class="dbox orange">token</span>
    <span class="dbox orange">ization</span>
    <span class="darr">→</span>
    <span class="dbox blue">[3323, 2065]<span class="sub">integer IDs</span></span>
    <span class="darr">→<span class="lbl">model</span></span>
    <span class="dbox purple">🧠</span>
  </div>
  <div class="dcap">Subword BPE splits text into known pieces, each an integer ID — the only thing the model actually sees.</div>
</div>

## Concrete example

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B-Instruct")

ids = tok.encode("Tokenization in Dubai مرحبا")
print(ids)                         # [list of integer token IDs]
print(len(ids))                    # exact token count for THIS model
print(tok.convert_ids_to_tokens(ids))  # see the actual subword pieces

# Notice the space matters:
print(len(tok.encode("Dubai")), len(tok.encode(" Dubai")))  # can differ

# For OpenAI models, use tiktoken instead (same idea, different vocab):
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4.1")
print(len(enc.encode("Tokenization in Dubai مرحبا")))       # exact count for GPT
```

Run it and you'll see the Arabic word costs more tokens than an English word of similar length — the concrete reason bilingual apps budget more.

## How a company uses this

A Dubai government-services chatbot serves **Arabic and English**. **Production reality:** early cost estimates assumed English-like token rates and came in ~40% under actual spend, because Arabic text tokenizes into noticeably more tokens per character. Once they measured true counts with the model's tokenizer, they re-budgeted, and they now **tokenize-and-check every prompt** before sending to guarantee it fits the context window — returning a graceful "please shorten" instead of a 400 error. They also use exact token counts to size RAG chunks precisely and to set per-user cost caps, all of which require the real tokenizer, not a heuristic.

## Common mistakes

- **Estimating tokens by word/character count** — fine-ish for English, wrong for Arabic, code, numbers, and emoji.
- **Reusing one model's token count for another** — different vocabularies; always use the target model's tokenizer.
- **Ignoring leading spaces** when splitting or counting — they change the tokenization.
- **Expecting character-level operations** (reversing a word, counting letters) to be reliable — the model sees tokens, not characters.
- **Forgetting special/chat tokens count too** — the chat template adds tokens beyond your visible text.

## Interview tip
Say: *"Tokenizers do subword BPE — text to integer IDs against a per-model vocabulary — and they're the only way to get *exact* token counts, which I use for cost, context-window checks, and chunk sizing. The gotchas: each model has its own vocab so counts don't transfer, leading spaces matter, and Arabic and code cost more tokens per character than English — which directly affects budgeting for bilingual Dubai apps."* The Arabic tokenization point is a strong, specific signal.
