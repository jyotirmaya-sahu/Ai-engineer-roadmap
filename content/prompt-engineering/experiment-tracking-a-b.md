# Experiment tracking & A/B

**What it is:** Experiment tracking is measuring a prompt change against real data on defined metrics; A/B testing is running two prompt versions on live traffic to see which actually performs better — so you decide with evidence, not vibes.

## Why it matters for an AI Engineer
Prompt changes *feel* better all the time and are worse half the time. Because LLM output is non-deterministic and quality is fuzzy, human intuition on "did this prompt improve things?" is unreliable — you can convince yourself a change helped from three cherry-picked examples while it quietly regressed on the other 97. Experiment tracking and A/B testing are how a professional *knows* a change is an improvement before shipping it to millions of users. This closes the prompt-engineering loop — [template](./prompt-templates.md) → [version](./versioning.md) → **measure** — and it's the single clearest signal in an interview that you've done this for real, not just in a notebook.

## The mechanism
Two complementary methods:

**Offline evaluation (before shipping).** You build an **eval set** — a fixed collection of representative inputs, ideally with known-good answers or graded criteria. On every prompt change you run the whole set and score it, so you compare versions apples-to-apples. How you score:

- **Exact/rule metrics** for structured tasks (accuracy, F1, valid-JSON rate, does it contain the required citation).
- **LLM-as-judge** for open-ended quality — a separate model grades each answer on rubric criteria (helpfulness, groundedness, tone) at scale. Cheaper and faster than humans; calibrate it against human labels first.
- **Human review** on a sample for the things judges miss.

Track cost and latency per version too — a "better" prompt that doubles cost may not be worth it.

**Online A/B testing (in production).** Split live traffic: version A to 50%, version B to 50%, and measure *real* outcomes — user thumbs-up rate, task completion, escalation-to-human rate, retention. This catches what offline evals can't: real-world inputs and genuine user behaviour. Run until the difference is **statistically significant** (enough samples that it's not noise), then roll the winner out to 100%.

The golden rule: **never ship a prompt change you haven't measured.** Tie every experiment to a specific [version](./versioning.md) so results are attributable.

## Concrete example
A tiny offline eval comparing two prompt versions on an accuracy metric:

```python
from openai import OpenAI
client = OpenAI()

EVAL = [  # (input, expected label)
    ("My card was charged twice", "billing"),
    ("Where is my order?", "delivery"),
    ("App keeps crashing", "technical"),
    ("I want a refund", "billing"),
]

PROMPTS = {
    "A": "Classify the ticket as billing, delivery, or technical. One word.",
    "B": "You are a support router. Reply with exactly one label: billing, delivery, "
         "or technical. Choose the single best fit.",
}

def score(prompt):
    correct = 0
    for text, expected in EVAL:
        out = client.chat.completions.create(
            model="gpt-4o-mini", temperature=0,
            messages=[{"role": "system", "content": prompt},
                      {"role": "user", "content": text}],
        ).choices[0].message.content.strip().lower()
        correct += (out == expected)
    return correct / len(EVAL)

for name, p in PROMPTS.items():
    print(name, score(p))   # e.g. A 0.75   B 1.0  -> ship B, with evidence
```

Now "B is better" is a measured 100% vs 75% on a fixed set — not a hunch. Real eval sets have hundreds of cases across edge conditions.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">Prompt A vs Prompt B</span>
    <span class="darr">↓<span class="lbl">offline eval set</span></span>
    <span class="dbox orange">📊 Accuracy · cost · latency</span>
    <span class="darr">↓<span class="lbl">live A/B split</span></span>
    <span class="dbox blue">👍 Real user metrics (significant?)</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Ship the proven winner</span>
  </div>
  <div class="dcap">Measure offline, confirm online, ship on evidence — never on intuition.</div>
</div>

## How a company uses this
A Dubai food-delivery app iterates its in-app support bot weekly. Every candidate prompt runs against a ~400-case eval set (scored with rule metrics for routing plus an LLM-judge for reply quality) before it's allowed near production; the winner is then A/B tested on 10% of live traffic, measured on *resolution-without-human-handoff rate* and CSAT, and only promoted to 100% once the lift is statistically significant. This caught a "more concise" prompt that scored great offline but *raised* human-escalation online (too terse for confused users) — they'd have shipped a regression on intuition alone. The eval set is versioned alongside the prompts, and every experiment links to its prompt [version](./versioning.md) so results stay attributable months later.

## Common mistakes
- **Eyeballing a few examples.** The classic trap — a change that looks better on 3 cases regresses on the eval set. Measure on many.
- **No eval set.** Without a fixed benchmark you can't compare versions; build one early, grow it from real failures.
- **Testing only offline.** Offline misses real inputs and user behaviour; confirm important changes with a live A/B.
- **Calling A/B results too early.** A 2% "lift" on 50 users is noise. Wait for statistical significance.
- **Ignoring cost/latency.** A more accurate prompt that's 2× cost or slower may lose overall — track those metrics too.
- **Uncalibrated LLM-judge.** A judge that disagrees with humans gives confident-but-wrong scores; validate it against human labels.

## Interview tip
Say: *"I never ship a prompt change unmeasured. Offline I score every version against a fixed eval set — rule metrics plus a calibrated LLM-judge, tracking cost and latency too. For important changes I A/B on live traffic against real outcomes like resolution rate, and only promote the winner once it's statistically significant. Every experiment is tied to a prompt version for attribution."* Naming the eval set, LLM-judge calibration, statistical significance, and version attribution is the strongest possible signal of production experience.
