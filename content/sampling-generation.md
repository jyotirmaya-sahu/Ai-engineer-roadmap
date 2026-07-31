# Sampling & Generation

**The one-line idea:** an LLM doesn't "write" an answer — it predicts a probability for every possible next token, and *sampling* is the set of knobs that decides which token you actually pick. Master these knobs and you control creativity, determinism, cost, and where the model stops.

> **Continuing from the capstone.** You just built **HelpDesk** (v1–v8) — but every one of its `create()` calls used the model's *default* sampling. That's why its answers might feel slightly random, occasionally too long, or not deterministic enough for support. This node is where you learn the dials to fix exactly that: after it, you'll go back and set a low **temperature** on HelpDesk's support replies, a **max_tokens** cap to control cost, and a **stop sequence** so it never invents the customer's next line. Same app — now you tune it.

## Why we even need it

Under the hood, every time an LLM produces a word it does the same thing: it looks at everything so far and outputs a **probability distribution** over its entire vocabulary — maybe 100,000+ possible next tokens, each with a score. "The cat sat on the ___" might give `mat` 60%, `floor` 15%, `roof` 8%, and a long tail of thousands of tiny probabilities.

Now you have a choice. Always pick the single highest-probability token? You get safe, repetitive, sometimes robotic text — and identical output every time. Roll the dice weighted by those probabilities? You get variety and creativity — but also the risk of picking something weird. **Sampling parameters are the dials that shape that choice**: how much randomness, how wide a net of candidates, how to discourage repetition, when to stop, and how long to run.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📝 Prompt so far</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔢 Prob. over 100k tokens<span class="sub">mat .60 · floor .15 …</span></span>
    <span class="darr">→<span class="lbl">sampling knobs</span></span>
    <span class="dbox green">✅ Chosen token</span>
  </div>
  <div class="dcap">The model outputs probabilities; sampling parameters decide which token you actually keep — one token at a time, in a loop.</div>
</div>

## Why it matters for an AI Engineer

These are the settings you tune *every single API call*. A support bot answering policy questions wants near-deterministic, factual output (low temperature). A brainstorming tool wants variety (higher temperature, wider top-p). A JSON-emitting extraction pipeline wants it locked down so tightly it never drifts. Getting these wrong is one of the most common causes of "the model is hallucinating" or "the output is boring" or "it won't stop talking and my bill is huge." Unlike prompt engineering, these are numeric, testable, and cheap to experiment with — which is exactly why interviewers love asking about them.

## The knobs you'll learn (and when to reach for each)

| Knob | What it controls | Reach for it when |
|---|---|---|
| **[Temperature](sampling-generation/temperature.md)** | overall randomness — flattens or sharpens the distribution | the master creativity/determinism dial |
| **[Top-K](sampling-generation/top-k.md)** | keep only the K most likely tokens, sample among them | cap absolute number of candidates |
| **[Top-P (nucleus)](sampling-generation/top-p-nucleus.md)** | keep the smallest set of tokens summing to probability P | the modern default cutoff, adapts per step |
| **[Repetition penalty](sampling-generation/repetition-penalty.md)** | down-weight tokens already used | model loops or repeats phrases |
| **[Max tokens](sampling-generation/max-tokens.md)** | hard cap on output length | control cost, latency, truncation |
| **[Stop sequences](sampling-generation/stop-sequences.md)** | strings that end generation immediately | structured output, chat turn boundaries |
| **[Seed](sampling-generation/seed.md)** | fix the randomness so runs are reproducible | testing, debugging, eval determinism |
| **[Logprobs](sampling-generation/logprobs.md)** | expose the actual token probabilities | confidence scoring, classification, debugging |

Temperature, top-k, and top-p are three ways of shaping *the same* candidate distribution — you rarely need all three at once. The rest are guardrails around length, stopping, reproducibility, and observability.

## Real world: how a company uses this

**Back to HelpDesk:** the exact settings your support assistant should use — **temperature 0.2** so two customers asking the same question get consistent, on-policy answers; **max_tokens 300** so replies stay short and the bill stays predictable; a **stop sequence** of `"\n\nCustomer:"` so the model never hallucinates the customer's next turn; and **logprobs** on a separate intent-classifier call to route low-confidence queries to a human. Contrast that with a **marketing brainstorm tool** on the *same* model running **temperature 0.9, top_p 0.95** for variety. Same model, opposite dials — the sampling settings *are* the product difference. When you finish this node, add these to HelpDesk's `create()` call.

## Interview tip

Say: *"Sampling parameters shape the model's next-token probability distribution. Temperature is the master randomness dial — I use ~0.0–0.3 for factual or structured tasks and 0.7–1.0 for creative ones. Top-p is my preferred cutoff over top-k because it adapts to how confident the model is. I add stop sequences and max_tokens as guardrails, a fixed seed for reproducible tests, and logprobs when I need a confidence score."* That answer shows you actually run these in production, not just read about them.

---

*Below: deep-dive articles on each sampling knob. After this, go set them on HelpDesk — then the next node, **LLM APIs — Advanced**, adds the capabilities (tool-calling, vision, caching) your app reaches for as it grows.*
