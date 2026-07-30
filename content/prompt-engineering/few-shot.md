# Few-shot

**What it is:** Few-shot prompting is putting a handful of input→output examples *inside the prompt* so the model copies the pattern — teaching by demonstration instead of description.

## Why it matters for an AI Engineer
Some behaviours are hard to *describe* but easy to *show*: a very specific JSON shape, a house tone of voice, how to handle a tricky edge case. Few-shot is how you pin those down without fine-tuning. It's the workhorse between plain [zero-shot](./zero-shot.md) and training your own model — cheaper and faster than fine-tuning, and often just as good. The tradeoff is tokens: every example rides along on *every* request, so you learn to use the fewest, best examples that lock the behaviour.

## The mechanism
This works because of **in-context learning**: a transformer conditions its next-token predictions on everything in the window. When it sees three examples all mapping input to a tight format, the strongest continuation of that pattern is to produce the same format for the fourth input. You're not training weights — you're setting up a pattern the model completes.

Rules that actually matter:

- **Format consistency beats quantity.** Three examples with identical structure teach more than eight sloppy ones. The model copies the *shape* — including your delimiters, casing, and field order.
- **Cover the edges, not just the easy case.** Include an example of the hard case (a negative, an empty result, a "none of the above"). The model generalizes from what you show; show only happy paths and it fails on the ugly ones.
- **Order can bias.** Models weight recent examples slightly more (recency), and an all-"positive" run can nudge the answer positive. Mix labels; put the trickiest example last.
- **2–5 is the sweet spot.** More rarely helps and burns tokens + latency.

## Concrete example
Forcing a strict extraction format the model wouldn't reliably invent zero-shot:

```python
from openai import OpenAI
client = OpenAI()

prompt = """Extract the product and issue from each message as JSON.

Message: "My Galaxy S24 screen is flickering."
Output: {"product": "Galaxy S24", "issue": "screen flickering"}

Message: "Order arrived but the charger was missing."
Output: {"product": "unknown", "issue": "missing charger"}

Message: "The AirPods keep disconnecting from my laptop."
Output:"""

r = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": prompt}],
    temperature=0,
)
print(r.choices[0].message.content)
# -> {"product": "AirPods", "issue": "keeps disconnecting from laptop"}
```

Notice the 2nd example teaches the `"product": "unknown"` fallback — an edge case description alone often misses.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">📋 Ex 1</span>
    <span class="dbox orange">📋 Ex 2</span>
    <span class="dbox orange">📋 Ex 3</span>
    <span class="darr">→</span>
    <span class="dbox gray">❓ New input</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM copies the pattern</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Same-shaped output</span>
  </div>
  <div class="dcap">In-context learning: the model completes the demonstrated pattern for the new input.</div>
</div>

## How a company uses this
A Dubai fintech extracts structured fields from Arabic-and-English bank statements for a budgeting app. Zero-shot mixed up date formats (DD/MM vs MM/DD) and dropped the currency. Four few-shot examples — two Arabic, two English, one with a missing field — locked the exact JSON schema and the DD/MM convention. Accuracy on their eval set jumped from 81% to 97%. At ~20 statements per user they cache the few-shot prefix so the examples hit the [prompt cache](../context-engineering/prompt-kv-caching.md) and don't get re-billed at full price each call.

## Common mistakes
- **Inconsistent example formatting.** If your examples vary, the output varies. Make them byte-for-byte parallel.
- **Only happy-path examples.** No edge-case demo → model breaks on edge cases in prod.
- **Too many examples.** 15 examples is wasted tokens and latency; trim to the essential 3–5.
- **Examples that leak into the answer.** If test inputs resemble an example, the model may echo the example's answer. Vary them.

## Interview tip
Say: *"I use few-shot when a format or edge case is easier to show than describe. Three to five consistent examples, including the hard case, and I cache the example prefix so I'm not re-billed for it every call. If I'd need dozens of examples, that's my signal to consider fine-tuning instead."*
