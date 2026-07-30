# When Fine-tuning Is the Wrong Answer

**The one-line idea:** fine-tuning is expensive, slow to iterate, and easy to get wrong — most times someone *wants* to fine-tune, a prompt or RAG would have solved it faster, cheaper, and better.

## Why it matters for an AI Engineer

Knowing when *not* to fine-tune is a stronger senior signal than knowing how to fine-tune. Teams burn weeks and thousands of dollars tuning a model to do something a two-line prompt already did. In interviews, the candidate who lists the anti-patterns — and picks the cheaper lever — stands out. This tile is the guardrail for the whole node.

## The mechanism / how it works — the anti-patterns

**1. You want to add or update facts.** Weights are a terrible database: knowledge stored in them is lossy, un-citable, and frozen at training time. Fine-tune the price list today, it's wrong next week. Facts belong in **RAG** or the prompt. Fine-tuning teaches *behavior*, not *knowledge* — the single most common mistake.

**2. You haven't exhausted prompting.** A clear system prompt, a few **few-shot examples**, and structured-output constraints solve a huge share of "the model won't do X" problems in minutes, with zero training. Always spend a day on prompt engineering before considering a tune.

**3. Your requirement changes often.** Every change means re-collecting data and re-training. Prompts and RAG update instantly; a fine-tune has a slow, costly feedback loop.

**4. You don't have (or can't get) enough clean data.** Fine-tuning on 40 messy examples usually makes the model *worse* — it overfits and forgets general ability. If you can't assemble a few hundred high-quality examples, don't tune. (See [Data-volume thresholds](data-volume-thresholds.md).)

**5. You need explainability or citations.** A tuned model gives you an opaque answer with no source. Regulated Dubai sectors (banking, health, legal) often *require* traceability — that's RAG's job.

**6. The base model already does it.** Frontier models in 2026 are strong; test the plain model first. Often the "gap" was just a weak prompt.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">💡 "Let's fine-tune!"</span>
    <span class="darr">↓<span class="lbl">is the gap knowledge?</span></span>
    <span class="dbox blue">Yes → use RAG, not fine-tune</span>
    <span class="darr">↓<span class="lbl">tried prompting + few-shot?</span></span>
    <span class="dbox orange">No → do that first (a day, not a week)</span>
    <span class="darr">↓<span class="lbl">have 100s of clean examples of a stable behavior?</span></span>
    <span class="dbox green">✅ Only now is fine-tuning the right tool</span>
  </div>
  <div class="dcap">Fine-tuning survives three filters: not knowledge, prompting exhausted, enough stable-behavior data.</div>
</div>

## Concrete example — worked numbers

A team wants a bot to answer using their constantly-updated product catalog. They plan to fine-tune monthly.
- **Fine-tune path:** re-label ~2,000 examples + retrain *every month* ≈ days of engineer time + GPU cost, and it's always a month stale.
- **RAG path:** point a retriever at the live catalog. Updates are instant, answers cite the SKU, zero retraining.

RAG wins decisively — the requirement is *changing knowledge*, exactly what fine-tuning is worst at.

## How a company uses this

A Dubai retail group asked a vendor to fine-tune a model on their promotions so the chatbot "knows the deals." An AI engineer pushed back: promotions change weekly, so a fine-tune would be perpetually outdated and un-auditable. They shipped **RAG over the live promotions feed** in days instead of weeks; the only thing they later fine-tuned was the *tone* (a stable behavior), on ~600 examples. Correctly separating knowledge (RAG) from behavior (fine-tune) saved the project.

## Common mistakes
- Treating fine-tuning as the "serious" or "real" solution — cheaper levers are the professional default.
- Fine-tuning to fix a hallucination that was actually a retrieval or prompt bug.
- Skipping evaluation, so nobody notices the tune made general ability *worse*.

## Interview tip
Say: *"Before fine-tuning I ask three things: is the gap knowledge (then RAG), have I exhausted prompting and few-shot, and do I have hundreds of clean examples of a *stable* behavior? If any fails, fine-tuning is the wrong answer. It's a last resort for behavior, not a default."* Related: [Long-context vs RAG vs fine-tune](long-context-vs-rag-vs-fine-tune.md).
