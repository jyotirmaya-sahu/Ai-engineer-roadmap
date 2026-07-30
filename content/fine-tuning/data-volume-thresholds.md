# Data-volume Thresholds

**The one-line idea:** roughly how many training examples you actually need before fine-tuning helps rather than hurts — and why *quality* matters far more than raw count.

## Why it matters for an AI Engineer

The first question on any fine-tuning project is "do we even have enough data?" Guess too low and the model overfits and gets *worse*; assume you need millions and you'll never start. Knowing the real thresholds lets you scope a project honestly in the first meeting — a concrete, practical skill interviewers probe for. It also tells you when to stop labeling and start training.

## The mechanism / how it works

With **PEFT (LoRA/QLoRA)** you are *not* teaching the model language from scratch — the base model already knows that. You're nudging an existing skill into a specific shape. That's why the numbers are surprisingly small. Rough working thresholds for instruction/behavior fine-tuning:

| Examples | What to expect |
|---|---|
| **< 50** | Don't. Too few to learn a pattern; high overfit risk. Use few-shot prompting instead. |
| **50–200** | Minimum viable for a *narrow, well-defined* task (one format, one tone). Works if examples are very clean and consistent. |
| **500–1,000** | The reliable sweet spot for most single-task fine-tunes (classification, extraction, style). |
| **1,000–10,000** | Robust, production-grade for a complex task or several output shapes. |
| **10,000+** | Diminishing returns for PEFT; you're into full-fine-tune / heavy-alignment territory. |

Three principles matter more than the raw count:

1. **Quality beats quantity.** 300 hand-checked, consistent examples beat 3,000 noisy ones. A few contradictory examples (same input, different "correct" output) actively confuse the model and can *lower* accuracy.
2. **Consistency is the real lever.** Fine-tuning learns *patterns*. If every example follows the same format and voice, the model locks onto it fast. Inconsistent labels = a blurry target.
3. **Narrow needs less.** A single, tight task ("classify ticket → 1 of 5 labels") needs far fewer examples than a broad one ("be a helpful multi-topic assistant").

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📉 &lt;50<span class="sub">overfit — don't</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">200<span class="sub">narrow task min</span></span>
    <span class="darr">→</span>
    <span class="dbox green">500–1k<span class="sub">sweet spot</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">10k+<span class="sub">diminishing returns</span></span>
  </div>
  <div class="dcap">Small clean datasets go far with PEFT — quality and consistency matter more than count.</div>
</div>

## Concrete example — worked numbers

You want a model that turns support emails into a fixed JSON of {category, urgency, summary}.
- You gather **800 real emails**, each hand-labeled with the exact JSON, all in the same schema and style.
- Split ~90/10: ~720 train, ~80 held-out for eval.
- QLoRA-tune for 2–3 epochs. That's enough: the task is narrow and the labels are consistent.

If instead you had 800 examples but three engineers each used a *different* JSON style, the model would learn none of them well — you'd fix the *consistency*, not add more data.

## How a company uses this

A Dubai logistics firm wanted to auto-extract 12 fields from delivery-note images (OCR'd text). They assumed they needed tens of thousands of samples and stalled for months. An AI engineer showed that **~1,200 carefully corrected examples** — one clean schema, reviewed by a single annotator for consistency — was plenty for a QLoRA tune that hit 93% field accuracy. The unblock wasn't more data; it was realizing the threshold was ~1k *clean* rows, not 50k messy ones. They labeled for two weeks and shipped.

## Common mistakes
- **Chasing volume over consistency** — the fastest way to a worse model.
- **No held-out eval set** — without it you can't tell if more data helped or if you overfit. Always carve out ~10%.
- **Duplicated/near-duplicate rows** inflating the count while teaching nothing new.

## Interview tip
Say: *"For PEFT I plan for a few hundred to ~1,000 clean, consistent examples per narrow task — the base model already knows language, so I'm shaping a skill, not teaching one. Below ~50 I stick to few-shot prompting. And I always hold out ~10% for evaluation, because quality and consistency drive results far more than raw count."* Next: [Data prep & formatting](data-prep-formatting.md).
