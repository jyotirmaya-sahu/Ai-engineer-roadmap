# Usage & token counting

**What it is:** LLMs don't see words — they see **tokens** (chunks of text, roughly ¾ of a word each). Every request is billed by tokens in + tokens out, and every model has a hard **token limit** on how much it can hold. Counting tokens is how you control both your bill and whether a request even fits.

## Why it matters for an AI Engineer

Two of the most common production problems are *"this request costs too much"* and *"context length exceeded."* Both are token problems. If you can't estimate tokens *before* you send, you can't budget, you can't guarantee a prompt fits the context window, and you can't decide how much history or how many retrieved chunks to include. Token counting underlies cost dashboards, [prompt caching](/llm-apis-advanced/prompt-caching) decisions, chunk-size tuning in RAG, and truncation logic in long chats. It's a skill interviewers probe directly: "How would you keep a 100-turn conversation from overflowing the context window?"

## The mechanism — how it works

A **tokenizer** splits text into tokens using a learned vocabulary (byte-pair encoding). Rough English rule of thumb: **1 token ≈ 4 characters ≈ 0.75 words**, so ~1,000 tokens ≈ 750 words. But it varies: code, numbers, rare words, and non-English text (including Arabic) tokenize into *more* tokens per character, which matters a lot for Dubai's bilingual apps.

Every response returns a **usage** object with three numbers:
- **prompt/input tokens** — everything you sent (system + all history + user + tool schemas + images).
- **completion/output tokens** — what the model generated. Usually billed *higher* per token than input.
- **total tokens** — the sum.

Two limits use these:
1. **Context window** — the max input+output the model can handle in one call (e.g. 128k, 200k, or 1M tokens depending on model). Exceed it → hard error.
2. **Cost** — `input_tokens × input_price + output_tokens × output_price`, priced per million tokens.

To count *before* sending, use the model's tokenizer offline: OpenAI's `tiktoken`, or Hugging Face [tokenizers](/llm-apis-advanced/tokenizers) for open models.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">"Abu Dhabi is great"</span>
    <span class="darr">→<span class="lbl">tokenize</span></span>
    <span class="dbox orange">Abu</span>
    <span class="dbox orange"> Dhabi</span>
    <span class="dbox orange"> is</span>
    <span class="dbox orange"> great</span>
    <span class="darr">→</span>
    <span class="dbox blue">4 tokens<span class="sub">× price = cost</span></span>
  </div>
  <div class="dcap">Text becomes tokens; token count drives both the context limit and the bill.</div>
</div>

## Concrete example

```python
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4.1")
text = "Abu Dhabi is the capital of the UAE."
tokens = enc.encode(text)
print(len(tokens))          # -> 9 tokens

# Estimate cost BEFORE sending (illustrative prices per 1M tokens):
IN_PRICE, OUT_PRICE = 2.50, 10.00      # $/1M input, $/1M output
in_tok, out_tok = 1200, 400
cost = (in_tok/1e6)*IN_PRICE + (out_tok/1e6)*OUT_PRICE
print(f"${cost:.5f}")       # -> $0.00700

# After the call, trust the real usage object:
from openai import OpenAI
r = OpenAI().chat.completions.create(
    model="gpt-4.1", messages=[{"role":"user","content":text}])
print(r.usage.prompt_tokens, r.usage.completion_tokens, r.usage.total_tokens)
```

## How a company uses this

A Dubai legal-AI startup logs the `usage` object from *every* call into a dashboard keyed by customer and feature. **Production reality:** they discovered one "summarize this contract" feature was resending the entire 60-page contract on each follow-up question — 45k input tokens per turn — quietly costing more than the rest of the app combined. Counting tokens per feature exposed it; they switched to summarizing older context and enabled prompt caching, cutting that feature's cost ~80%. They also validate every request against the context window *before* sending, returning a clean "document too large, please split" instead of an opaque 400 error.

## Common mistakes

- **Guessing tokens from word count** — fine for English prose, wildly off for code, JSON, or Arabic (which can be 2–3x more tokens per character).
- **Forgetting output tokens cost more** and that generation length, not just prompt length, drives the bill.
- **Counting only the user message**, ignoring system prompt, full history, tool schemas, and images — all of which count as input.
- **Not checking the context window before sending**, then crashing on long inputs.
- **Using the wrong tokenizer** for the model — each model family has its own vocabulary.

## Interview tip
Say: *"Tokens are the unit of both billing and context limits — input and output are priced separately, output usually higher. I count with tiktoken or the model's tokenizer before sending to guarantee I fit the context window and to budget, and I log the returned usage object per feature. A rule of thumb is ~4 characters per token, but I never trust that for code or Arabic."* Naming the Arabic/code caveat is a nice Dubai-relevant tell.

## Practice — assignments

Write a program for each. Do them in order. You need `pip install openai tiktoken` and `OPENAI_API_KEY` set.

1. Write a program that takes a sentence and, using the model's tokenizer offline, prints how many tokens it is and the list of individual token strings.

2. Write a program that compares tokenization of three inputs — an English sentence, the same length of code, and an Arabic sentence — and prints the token count of each, showing that equal-length text isn't equal tokens.

3. Write a program that estimates the cost of a request *before* sending it: given an input token count, an expected output token count, and per-million prices, print the dollar cost.

4. Write a program that makes a real API call and prints the actual input, output, and total tokens from the response's usage object — then compare the input count to your offline estimate from assignment 1.

5. Write a program that, given a piece of text and a model's context-window size, checks whether the text fits and prints a clean "fits" or "too large, please split" message instead of letting the API error.

6. Write a program that runs a short multi-turn conversation and, after each turn, prints the running total of tokens used across all calls so far — showing how cost grows as history accumulates.

7. (Stretch) Write a program that trims a long conversation so it stays under a token budget: keep the system message plus as many of the most recent turns as fit within, say, 1000 tokens, dropping the oldest.

*Do 1–5 before moving to the next tile.*
