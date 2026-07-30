# Perplexity

**The one-line idea:** Perplexity measures how *surprised* a language model is by a piece of text — low perplexity means the model found the text predictable (fluent, in-distribution), high perplexity means it kept getting caught off guard.

## Why it matters for an AI Engineer

Perplexity is the metric of the model *itself*, not of a task answer — it's how you compare base models, track pretraining/fine-tuning progress, and detect when text is out-of-distribution for your model. As an AI Engineer you'll rarely gate a product feature on perplexity, but you'll see it everywhere: model release notes, fine-tuning loss curves, and "is my domain data too weird for this model?" checks. Understanding it also demystifies what "the model predicts the next token" really costs.

## The mechanism — how it works

A language model assigns a **probability to each next token**. If it's confident and right, that probability is high; if it's guessing, it's low. Perplexity turns those probabilities into one number.

Formally, perplexity is the **exponentiated average negative log-likelihood** of the tokens:

`perplexity = exp( − (1/N) · Σ log P(tokenᵢ | previous tokens) )`

The intuition: it's the **effective number of equally-likely choices** the model felt it had at each step. Perplexity 1 = the model was certain every token (P=1). Perplexity 10 = at each token it was as unsure as if picking uniformly among 10 options. So:

- **Lower is better** — the text was predictable to the model.
- It's tied to **cross-entropy loss**: perplexity = exp(loss). That's why training curves and perplexity move together.

Because it depends on the model's own probabilities, perplexity needs **access to the model's logits** — you can't compute it from an API that only returns text (unless it returns logprobs).

<div class="diagram">
  <div class="dstack">
    <span class="dbox purple">P("mat" | "the cat sat on the") = 0.4</span>
    <span class="dbox purple">P("sat" | "the cat") = 0.25</span>
    <span class="dbox purple">P("cat" | "the") = 0.1</span>
  </div>
  <div class="flow">
    <span class="darr">→<span class="lbl">avg −log P, then exp</span></span>
    <span class="dbox green">✅ perplexity (lower = more fluent)</span>
  </div>
  <div class="dcap">Average how surprised the model was per token, exponentiated — the effective branching factor.</div>
</div>

## Concrete example

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
model = AutoModelForCausalLM.from_pretrained("gpt2")

text = "The termination notice period is thirty days."
ids = tok(text, return_tensors="pt").input_ids

with torch.no_grad():
    loss = model(ids, labels=ids).loss     # cross-entropy over the sequence
ppl = torch.exp(loss)
print(f"perplexity = {ppl.item():.1f}")    # e.g. ~45 — fluent English

# Compare with gibberish: "notice thirty the period is days termination"
# → much higher perplexity, the model is more surprised
```

## How a company uses this

A team fine-tuning a small model on **Arabic legal contracts** for a Dubai client tracked perplexity on a held-out contract set across training. It fell from ~90 (base model, this domain looks strange to it) to ~18 (fine-tuned, now fluent in legalese) — concrete proof the fine-tune *learned the domain*, reported as a curve rather than a single vibe check. They also ran perplexity as a **cheap OOD detector**: incoming documents with perplexity far above the training distribution got flagged for human handling, because the model was likely to fumble text it found that surprising.

## Common mistakes / misconceptions

- **Treating low perplexity as "correct."** Fluent ≠ true. A model can confidently, low-perplexity-ly generate a wrong fact. Perplexity measures fluency/fit, not accuracy — never gate answer quality on it.
- **Comparing perplexity across different tokenizers.** Different vocabularies change token counts and make the numbers incomparable. Only compare within the same tokenizer.
- **Using it on API-only models.** No logprobs, no perplexity. It's an intrinsic, white-box metric.
- **Forgetting it's exp(loss).** People report them as if unrelated; they're the same signal.

## Interview tip
Say: *"Perplexity is exp of the average per-token negative log-likelihood — the model's effective branching factor, so lower means the text was more predictable to it. I use it to compare base models and watch fine-tuning progress on held-out domain text, and as an OOD tripwire — but never as a quality metric, because fluent isn't the same as correct."* The fluency-not-correctness distinction is the trap they're checking for.

See also: [BERTScore](./bertscore.md) and [ROUGE](./rouge.md) (task-output metrics, not model-fit), and [LLM Internals] for how next-token probabilities arise.
