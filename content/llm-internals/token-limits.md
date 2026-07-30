# Token Limits

**What it is:** The hard ceiling on how many tokens a model can handle at once — input *plus* output must fit inside the context window, and you pay per token on both sides.

## Why it matters for an AI Engineer

Token limits are the budget you design every prompt around. They decide **how much context you can stuff in** (RAG chunks, chat history, documents), **what your request costs**, and **why long conversations silently break** when early messages get dropped. Mismanaging the token budget is the #1 cause of "the model forgot what I told it" and truncated/garbled outputs. Getting this right is core to building anything beyond a toy.

## The mechanism

Every model has a **context window** measured in tokens — e.g. 8k, 128k, 200k, or 1M in 2026-era models. Crucially, this window is **shared** between input and output:

```
context_window >= prompt_tokens + max_output_tokens
```

If you send a 120k-token prompt to a 128k model, you've left only ~8k tokens for the answer. Ask for more and the request errors or the output gets cut off mid-sentence. `max_tokens` in the API caps only the *output*; it doesn't extend the window.

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">Context Window — e.g. 128k tokens total</span>
    <div class="flow">
      <span class="dbox blue wide">Input<span class="sub">system + history + RAG + user</span></span>
      <span class="dbox yellow wide">Reserved for output</span>
    </div>
  </div>
  <div class="dcap">Input and output share one fixed token budget — the more prompt you send, the less room is left to answer.</div>
</div>

**Truncation** is what happens when you exceed the limit. Some SDKs error; many app frameworks silently drop the *oldest* messages to make room — which is why a long chat "forgets" its earlier instructions. You control this by managing history, not by hoping the model remembers.

## Concrete example

Count before you send, using the model's own tokenizer:

```python
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4o")
prompt = system_prompt + retrieved_context + user_question
n = len(enc.encode(prompt))
budget = 128_000
max_out = 2_000
if n > budget - max_out:
    retrieved_context = trim(retrieved_context)   # drop lowest-ranked RAG chunks
```

**Cost math:** using illustrative prices (input $2.50 / 1M tokens, output $10 / 1M — always check your model's current pricing), a request with 10k input + 1k output tokens costs `10_000/1e6 * 2.5 + 1_000/1e6 * 10 = $0.025 + $0.01 = $0.035`. Multiply by request volume — this is your unit economics.

## How this shows up in production

- **RAG context trimming:** You retrieve more chunks than fit, then rank and keep only what the budget allows — a core RAG design decision, not an afterthought.
- **Conversation memory:** Long-running chats use summarization or sliding windows to stay under the limit; otherwise the oldest (often the system setup) gets truncated.
- **Cost control:** Input caching (Anthropic/OpenAI prompt caching) discounts repeated prefixes; keeping prompts lean directly cuts spend. Long context is powerful but not free — a 1M-token call is expensive and slower (attention scales ~quadratically).

## Common misconceptions

- **"`max_tokens` sets the context window."** It caps *output* only. The window is fixed by the model and shared with the input.
- **"A bigger window means I should always fill it."** More tokens = more cost, more latency, and often *worse* quality (see lost-in-the-middle). Use the smallest context that answers the question.
- **"Tokens are words."** They're subword units, ~1.3 per English word and more for other languages/code. Always count with the real tokenizer.

## Interview tip

Say: *"The context window is a fixed token budget shared by input and output — prompt tokens plus reserved output must fit. Exceeding it truncates, usually dropping the oldest context, which is why long chats forget. I budget tokens explicitly: count with the model's tokenizer, trim RAG context to fit, and reserve room for the response."* Adding the cost formula (input rate × input tokens + output rate × output tokens) shows you own the economics.
