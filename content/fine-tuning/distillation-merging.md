# Distillation & Merging

**The one-line idea:** two ways to reshape models cheaply — **distillation** trains a small model to copy a big one (shrink for cost/speed), and **merging** blends two or more fine-tuned models' weights into one (combine skills without retraining).

## Why it matters for an AI Engineer

Both are cost-and-capability levers a senior engineer reaches for after the basic tune works. **Distillation** is how you take a task your expensive frontier model does well and move it onto a small, cheap model you own — the classic "GPT-4 quality on a task, at open-8B cost." **Merging** lets you combine, say, an Arabic-tone adapter and a JSON-format adapter into one model that does both, for *free*, with no GPU training at all. In a Dubai job where the token bill and latency are scrutinized, knowing you can shrink and combine models is a strong signal. These are "nice-to-have" topics that separate a capable engineer from a cost-aware one.

## The mechanism / how it works

**Distillation — teacher → student.** A big, capable **teacher** model generates outputs (and optionally its full probability distribution — the "soft labels"); a small **student** model trains to reproduce them.
- **Response/data distillation** (the common, practical form): run the teacher on lots of inputs, save its answers, then SFT the small model on those `input → teacher-answer` pairs. The student learns the teacher's behavior on *your* task distribution.
- **Logit distillation:** the student matches the teacher's full output *probabilities*, not just the final token — richer signal, needs access to the teacher's logits.
- Result: a 7–8B student that matches a much bigger model *on the narrow task*, at a fraction of the cost and latency. (Watch licensing — some providers restrict training on their outputs.)

**Merging — average the weights.** Take two models fine-tuned from the *same base* and combine their weights into one, no training required:
- **Linear/SLERP merge:** weighted average of the two weight sets.
- **TIES / DARE:** smarter merges that resolve conflicts between the two models' changes, keeping the important deltas and dropping noise — better than a naive average.
- Because LoRA adapters are just weight *deltas*, you can also merge *adapters*. The catch: both models must share the same base and architecture, and merging can dilute skills if they conflict, so you **evaluate** the merged model like any tune ([Train & evaluate](train-evaluate.md)).

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 Big teacher</span>
    <span class="darr">→<span class="lbl">generate answers</span></span>
    <span class="dbox orange">train small student on them</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Cheap model, teacher's skill</span>
  </div>
  <div class="flow">
    <span class="dbox blue">Model A (Arabic tone)</span>
    <span class="darr">＋<span class="lbl">TIES merge</span></span>
    <span class="dbox blue">Model B (JSON format)</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ One model, both skills — no training</span>
  </div>
  <div class="dcap">Distillation shrinks; merging combines. Both avoid a from-scratch tune.</div>
</div>

## Concrete example — distillation, worked

```python
# 1) Teacher (frontier model) labels your unlabeled inputs
teacher_outputs = [call_frontier_model(x) for x in raw_inputs]   # e.g. 5,000 rows

# 2) Save as an SFT dataset: input -> teacher answer
save_jsonl([{"messages":[{"role":"user","content":x},
                         {"role":"assistant","content":y}]}
            for x, y in zip(raw_inputs, teacher_outputs)], "distill.jsonl")

# 3) QLoRA-tune a small open model on it (see hf-peft-trl.md) — the student now
#    mimics the teacher on THIS task, at ~1/20th the per-call cost.
```

Merging two adapters with `mergekit` is a config-file job (declare the models, weights, and method like `ties`) with **no GPU training** — minutes, not hours.

## How a company uses this

A Dubai e-commerce firm used a frontier model to write product descriptions — great quality, but ~$0.02/description at millions of SKUs was untenable. They **distilled**: had the frontier model write 8,000 descriptions, then QLoRA-tuned an 8B open model on them. The student hit ~95% of the teacher's quality (human-rated) at roughly **1/25th the per-call cost**, running on their own GPU. Separately, they **merged** their "brand-tone" and "SEO-keyword" adapters into a single model so serving didn't need to swap adapters mid-request. Distillation cut the bill; merging cut the serving complexity.

## Common mistakes
- **Merging models with different base architectures** — it produces garbage; same base is mandatory.
- **Trusting a merge without eval** — merging can silently weaken one skill; always score it.
- **Ignoring output-license terms** when distilling from a commercial model.
- **Expecting a distilled student to match the teacher *everywhere*** — it matches on the trained task distribution, not in general.

## Interview tip
Say: *"Distillation trains a small student to copy a big teacher's outputs on my task — same quality at a fraction of the cost and latency. Merging averages weights of models fine-tuned from the same base, with TIES/DARE to resolve conflicts, so I can combine skills or adapters with zero training. Both are cost levers I reach for after a tune works — and I evaluate a merge like any other model before shipping."* Related: [Train & evaluate](train-evaluate.md), [Adapters](adapters.md).
