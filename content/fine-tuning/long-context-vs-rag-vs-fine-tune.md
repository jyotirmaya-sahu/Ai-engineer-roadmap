# Long-context vs RAG vs Fine-tune

**The one-line idea:** three different ways to give a model something it doesn't already have — paste it into the prompt (long-context), look it up at query time (RAG), or bake it into the weights (fine-tune) — and picking wrong wastes money or time.

## Why it matters for an AI Engineer

This is the single most common design decision in the job, and it's a favorite interview question because the naive answer ("just fine-tune it") is almost always wrong. Getting it right decides your cost, latency, and how fast you can update. An engineer who reaches for the cheapest lever that works — and can defend the choice — reads as senior. See the node overview for the full ladder; this tile teaches the three-way trade-off at its core.

## The mechanism / how it works

The key question is: **is the gap knowledge or behavior — and how often does it change?**

- **Long-context** — paste the material directly into the prompt. Modern models take 128k–1M+ tokens, so you can drop in whole documents. Zero setup, always current, but you pay for every token on every call and quality sags in the middle of huge contexts ("lost in the middle").
- **RAG** — store your documents in a vector DB, retrieve only the 3–5 relevant chunks per query, and put *those* in the prompt. Scales to millions of documents, cites sources, updates the instant you re-index. It adds **knowledge**.
- **Fine-tune** — train the weights on examples so a new **behavior** (format, tone, skill) becomes built-in. Best quality for *how* the model acts; but it's frozen at training time — new facts mean re-training.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ What does the model lack?</span>
    <span class="darr">↓</span>
    <span class="dbox blue">📄 A few docs, changes often → Long-context</span>
    <span class="darr">↓</span>
    <span class="dbox blue">🗄️ Lots of facts, must cite/update → RAG</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 A skill/format/tone → Fine-tune</span>
  </div>
  <div class="dcap">Knowledge that changes → context or RAG. Behavior that's stable → fine-tune. They combine.</div>
</div>

Crucially they are **not either/or**. The strongest systems fine-tune a model to *behave* right (e.g. always answer in a strict citation format) *and* use RAG to feed it fresh facts. Fine-tuning teaches the how; RAG supplies the what.

## Concrete example — same problem, three approaches

Task: answer questions about a company's HR policy.

| Approach | How | Cost / update |
|---|---|---|
| Long-context | paste the 40-page handbook into every prompt | ~12k tokens *every* call; edit the file = instantly current |
| RAG | chunk + embed the handbook, retrieve top-5 per question | ~1.5k tokens/call; re-index on change; cites the clause |
| Fine-tune | train on Q→A pairs about the handbook | cheap per call, but **stale** the day HR edits a policy — bad fit |

Here RAG wins: the need is **knowledge that changes**. You'd only fine-tune if the problem were *behavioral* — say the answers must always follow a rigid legal-disclaimer template the base model won't reliably produce.

## How a company uses this

A Dubai fintech support bot combined all three in production: **RAG** over the live product-docs and ticket history (facts change weekly), a light **fine-tune** to lock the brand's terse bilingual tone and refusal style (behavior), and **long-context** only for the occasional "summarize this specific 30-page contract the user pasted" request. Retrieval kept per-call context near 2k tokens (vs ~15k if they'd stuffed everything), cutting inference cost ~85% while staying current — the fine-tune handled *voice*, RAG handled *truth*.

## Common mistakes
- **Fine-tuning to inject facts.** Weights are a lossy, un-updatable place to store knowledge; it hallucinates and goes stale. Facts → RAG.
- **Assuming long-context replaces RAG.** A 1M window sounds like "just paste everything," but it's slow, expensive per call, and accuracy drops in the middle. RAG is cheaper and often *more* accurate.
- **Treating them as rivals.** The best answer in interviews is often "combine them."

## Interview tip
Say: *"I map the gap to the lever: changing facts go in context or RAG, stable behavior goes in a fine-tune. I default to RAG for knowledge because it's updatable and citable, use long-context for one-off pasted documents, and fine-tune only when the model needs to *act* differently — and I'll happily combine a behavioral fine-tune with RAG for facts."*
