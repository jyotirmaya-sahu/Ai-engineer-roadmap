# Avoiding hallucination

**What it is:** A hallucination is when the model states something false or fabricated *as if it were fact*. Avoiding it is the set of techniques that make the model stick to what it actually knows — and admit when it doesn't.

## Why it matters for an AI Engineer
Hallucination is the number-one reason LLM features fail in production and the number-one reason stakeholders distrust them. A support bot inventing a refund policy, a medical assistant inventing a dosage, a coding assistant inventing an API that doesn't exist — each is a real, shipped failure. As an AI Engineer, a huge part of your job is *containing* hallucination to an acceptable level, because you can't eliminate it entirely. Knowing the concrete levers — and their limits — is core competence.

## The mechanism
First understand *why* it happens: an LLM predicts the most *plausible* next token, not the most *true* one. It has no built-in "I'm not sure" signal — a fabricated citation and a real one look equally fluent to it. So hallucination isn't a bug you patch; it's a property you manage. The levers, strongest first:

- **Grounding.** Give it the facts in-context and tell it to answer only from them — the biggest single reducer. See [grounding & citations](./grounding-citations.md).
- **Give it an out.** Explicitly allow "I don't know / I'm not sure." Models default to *always answering*; without permission to abstain, they fabricate. This one line prevents a huge share of hallucinations.
- **Lower temperature.** For factual tasks, `temperature=0` reduces creative drift.
- **Ask for citations.** Requiring a source makes unsupported claims visible; you can reject answers whose citations don't check out.
- **Decompose & verify.** Break the task ([chaining](./prompt-chaining-decomposition.md)) and add a verification step — a second call that checks the answer against the source, or [self-consistency](./self-consistency.md) voting on factual questions.
- **Constrain scope.** A narrow, well-defined task hallucinates less than an open-ended one.

None of these is perfect; you stack them. And you *measure* the residual rate on an eval set rather than assuming it's zero.

## Concrete example
The single highest-ROI line — giving the model permission to abstain:

```python
from openai import OpenAI
client = OpenAI()

def ask(system_extra=""):
    return client.chat.completions.create(
        model="gpt-4o-mini", temperature=0,
        messages=[
            {"role": "system", "content": "You are a factual assistant. " + system_extra},
            {"role": "user", "content": "What was Emirates Airline's exact net profit in Q3 2027?"},
        ],
    ).choices[0].message.content

print(ask())  # -> often fabricates a confident specific number (hallucination)

print(ask("If you don't have reliable information, say 'I don't know' — never guess numbers."))
# -> "I don't know — I don't have reliable data on that specific figure."
```

The task asks for future/unknown data; the second prompt makes the model admit it instead of inventing a plausible-looking figure.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ Factual question</span>
    <span class="darr">↓</span>
    <span class="dbox orange">📚 Ground + allow "I don't know" + low temp</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🔍 Verify against source</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Grounded answer OR honest abstention</span>
  </div>
  <div class="dcap">Stack the levers — no single one eliminates hallucination; together they contain it.</div>
</div>

## How a company uses this
A Dubai bank's assistant must *never* invent fees or eligibility rules. Their stack: grounding on retrieved policy docs, a hard "if it's not in the context, escalate to a human" rule, `temperature=0`, required citations, and an automated eval suite of ~500 known Q&A pairs run on every prompt change to track the hallucination rate over time (see [experiment tracking](./experiment-tracking-a-b.md)). They treat any hallucination on a fee/eligibility question as a Sev-1 bug. The reframe that made it work culturally: they stopped trying to make the model *always answer correctly* and instead made it *reliably abstain* when unsure — a bot that says "let me connect you to a specialist" is safe; a bot that guesses a fee is a liability.

## Common mistakes
- **Treating it as fully fixable.** You *reduce* hallucination; you don't eliminate it. Design for the residual (abstention, human handoff, verification).
- **No permission to abstain.** The most common miss — the model fabricates because you never let it say "I don't know."
- **Trusting confidence.** Fluency ≠ accuracy. A confident tone (especially with a [persona](./role-assignment.md)) makes hallucinations *more* dangerous.
- **Not measuring.** "It seems fine" isn't data. Build an eval set and track the rate.
- **High temperature on factual tasks.** Creativity is the enemy of accuracy here.

## Interview tip
Say: *"Hallucination is inherent — the model predicts plausible tokens, not true ones — so I *contain* it rather than pretend to eliminate it: ground on retrieved facts, explicitly allow 'I don't know', temperature 0, required + verified citations, and a human handoff for the residual. And I measure the rate on an eval set, because 'seems fine' isn't a metric."* That mature framing — contain and measure, don't 'fix' — is exactly what senior interviewers listen for.
