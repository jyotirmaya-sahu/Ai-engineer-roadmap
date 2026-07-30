# Right-sizing & distillation

**What it is:** Using the *smallest* model that still passes your quality bar for a given task — and, when a small off-the-shelf model isn't quite good enough, training one to match a big model on your specific task (distillation).

## Why it matters for an AI Engineer

[Routing](model-routing-cascades.md) picks a model per request; right-sizing picks the *default* model for a whole task, and it's often the cleanest win of all. Many production tasks are narrow — classify a ticket, extract fields from an invoice, tag sentiment — and a small model does them as well as a frontier one at 1/30th the price. The frontier model is there because someone reached for the best during the prototype and never revisited it. Distillation goes further: for a high-volume narrow task, you can *teach* a small model to match the big one, locking in frontier-level quality at cheap-model cost. This is how teams serve millions of calls a day without a frontier bill.

## The mechanism / how it works

**Right-sizing (no training).** Take your eval set for the task and run it against a ladder of models — frontier, mid, small — measuring accuracy and cost. Pick the smallest that clears your quality threshold. Often the small model already passes and you're done: swap the model name, keep the same prompt, cut cost 10–30×. Sometimes a bit of prompt engineering or a few-shot example closes a small gap and keeps you on the cheap tier.

**Distillation (when small isn't enough).** Teach a small "student" model to imitate a big "teacher":

1. Run the big model on thousands of real inputs for your task; capture its outputs.
2. Fine-tune a small open model (or use a provider's distillation feature) on those input→output pairs.
3. The student learns the teacher's behavior *for this task* — matching quality on the narrow distribution while being far cheaper and faster to serve.

Distillation trades **up-front effort and training cost** for **permanently lower per-call cost**. It only pays when volume is high enough to amortize the training, and when the task is stable (a distilled model is frozen; a shifting task means re-distilling).

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 teacher<span class="sub">frontier</span></span>
    <span class="darr">→<span class="lbl">label 10k examples</span></span>
    <span class="dbox blue">📚 task dataset</span>
    <span class="darr">→<span class="lbl">fine-tune</span></span>
    <span class="dbox green">🪶 student<span class="sub">small, cheap, fast</span></span>
  </div>
  <div class="dcap">The teacher's outputs become training data; the small student learns to match it on your task.</div>
</div>

## Concrete example

Right-sizing, worked on a ticket-classification task (5M calls/month, ~600 tokens each):

| Model | Eval accuracy | $/MTok (in/out) | Monthly cost |
|---|---|---|---|
| Frontier | 96% | $10 / $30 | ~$13,200 |
| Mid | 95% | $2 / $8 | ~$3,000 |
| Small | **94%** | $0.10 / $0.40 | **~$180** |

The small model is within 2 points of frontier — well inside tolerance for this task — at **~1.4% of the cost**. That's a $13,000/month saving from changing one string, no training required. If the small model had landed at 85% (unacceptable), *then* you distill: label 10k tickets with the frontier model, fine-tune the small one, and typically recover most of the gap (say to 93–94%) while keeping the ~$180 serving cost.

## How a company uses this

A UAE bank ran document classification (which type of KYC document is this?) on a frontier model — accurate but expensive at their volume. An engineer benchmarked the task ladder and found a small model hit 93% zero-shot vs. the frontier's 95%; two well-chosen few-shot examples pushed the small model to 95%, matching it, at a fraction of the price. They switched the default and cut that pipeline's cost ~95%. For a higher-stakes extraction task where the small model lagged, they distilled: 15k invoices labeled by the frontier model, a fine-tuned small open model served on their own infra, quality matched, and per-call cost dropped 20×. The discipline both cases share: **decide with eval numbers**, and re-benchmark when the task or the available models change — new small models ship constantly and often erase last year's need to distill.

## Common mistakes

- **Defaulting to frontier forever.** The prototype's model choice quietly becomes production; nobody re-benchmarks, and you overpay for years.
- **Right-sizing without a real eval set.** "Feels fine" isn't a threshold; you need measured accuracy per tier to choose safely.
- **Distilling too early.** Distillation is real effort and a frozen model — try right-sizing + prompt tweaks first; only distill when a small model genuinely can't reach the bar and volume justifies it.
- **Distilling a moving target.** If the task definition shifts often, the frozen student drifts out of date; keep frontier for unstable tasks.

## Interview tip
Say: *"For any narrow, high-volume task I benchmark a ladder of models on my eval set and pick the smallest that clears the quality bar — that alone often cuts cost 10–30× because the prototype's frontier choice was never revisited. If the smallest model can't reach the bar and volume justifies it, I distill: label real inputs with the frontier model as teacher and fine-tune a small student to match it, locking frontier quality at cheap-model cost. I decide with eval numbers, and re-benchmark when models or the task change."* It shows you right-size before you reach for training.
