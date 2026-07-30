# Zero-shot

**What it is:** Zero-shot prompting is asking the model to do a task directly, with instructions but *no worked examples* — you rely on what it already learned in training.

## Why it matters for an AI Engineer
Zero-shot is your default and your baseline. It's the cheapest prompt (fewest tokens) and the fastest to write, so you always try it first and only add complexity — examples, reasoning steps, chains — when zero-shot measurably falls short. Knowing when zero-shot is *enough* saves you money and latency on every request, at scale that's real dollars. Modern instruction-tuned models (GPT-4o, Claude, Gemini) are astonishingly good zero-shot, so a huge share of production features are just a clear zero-shot instruction plus plumbing.

## The mechanism
The model was fine-tuned on millions of instruction→response pairs ("instruction tuning" / RLHF). That baked in a general ability to *follow instructions* it has never seen phrased that exact way. When you write "Classify this review as positive, negative, or neutral," the model recognizes the task shape from training and produces the pattern — no examples needed.

The whole game in zero-shot is **instruction clarity**. The model can't read your mind; it fills ambiguity with its own priors. So you make the instruction explicit about four things:

- **Task**: what to do ("summarize", "classify", "extract").
- **Output format**: exactly what to return ("one word", "a JSON object", "3 bullets max").
- **Constraints**: length, tone, what to exclude.
- **Edge cases**: what to do when unsure ("if none apply, answer 'unknown'").

Miss any of these and the model guesses — and its guess drifts request to request, which is where flakiness comes from.

## Concrete example
Weak zero-shot vs. engineered zero-shot for the same task:

```python
from openai import OpenAI
client = OpenAI()

# Weak: ambiguous format, no edge-case rule
weak = "Is this review good or bad? 'Shipping was slow but the phone is great.'"

# Engineered: explicit task, format, and edge case
strong = """Classify the sentiment of the review below.
Answer with exactly one word: positive, negative, or mixed.
If sentiment is unclear, answer: unknown.

Review: "Shipping was slow but the phone is great."
"""

for p in (weak, strong):
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": p}],
        temperature=0,
    )
    print(r.choices[0].message.content)
# Weak -> "It's mixed..." (a whole sentence, unpredictable)
# Strong -> "mixed" (one clean token you can parse)
```

`temperature=0` makes it near-deterministic — essential when you'll parse the output.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📝 Instruction only</span>
    <span class="darr">→<span class="lbl">no examples</span></span>
    <span class="dbox purple">🧠 Instruction-tuned LLM</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Answer</span>
  </div>
  <div class="dcap">Zero-shot leans entirely on training + a crystal-clear instruction.</div>
</div>

## How a company uses this
A Dubai e-commerce team routes incoming support tickets to the right queue (billing, delivery, returns, tech). At ~50,000 tickets/day, few-shot examples would add ~300 tokens per call — that's 15M extra input tokens daily, real money. They found a tight zero-shot instruction with an explicit label list hit ~94% routing accuracy, so they kept it zero-shot and spent the token budget elsewhere. The lesson: they *measured* zero-shot on a labelled set first, and only the few genuinely ambiguous categories got [few-shot examples](./few-shot.md).

## Common mistakes
- **Blaming the model for a vague prompt.** "It didn't format correctly" usually means you never said the format. Fix the instruction before reaching for a bigger model.
- **Leaving edge cases undefined.** Without an "if unsure" rule, the model invents one, and it varies per call.
- **Not pinning temperature.** For classification/extraction, `temperature=0` for stable, parseable output.
- **Adding examples reflexively.** Examples cost tokens and can bias the model; try clean zero-shot first.

## Interview tip
Say: *"Zero-shot is my baseline — clear task, explicit output format, and a defined fallback for 'unsure'. I only move to few-shot when a labelled eval shows zero-shot missing a specific format or edge case, because examples cost tokens on every single request."* That signals cost-awareness and a measure-first habit.
