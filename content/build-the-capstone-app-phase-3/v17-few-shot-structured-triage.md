# v17 · Few-Shot Structured Triage

**What you'll build:** HelpDesk consistently converts messy customer requests into a validated category, urgency, language, summary, and escalation decision using a measured few-shot prompt.

## Why this version

The zero-shot classifier from earlier phases handles obvious messages but fails on local phrasing and edge cases: “driver says delivered, wallah nothing here” may be misread as a generic order question. Few-shot examples demonstrate the boundary between labels. Structured output then makes the result safe for software to consume.

## The mechanism

Start with a schema and label definitions. Build a small labelled dataset from anonymized examples. Select examples that clarify confusing boundaries, not many repetitive easy cases. Place them before the current ticket and request only the schema fields.

```python
from typing import Literal
from pydantic import BaseModel, Field

class TriageResult(BaseModel):
    category: Literal["order", "refund", "technical", "account", "other"]
    urgency: Literal["normal", "urgent"]
    language: Literal["en", "ar", "mixed", "other"]
    summary: str = Field(max_length=240)
    needs_human: bool
    evidence: list[str] = Field(max_length=3)
```

Keep the canonical category contract created in v8.1: delivery and damaged-item wording map to `order`; changing the database taxonomy requires a migration and backfill. Register three concrete boundary examples in the v16 prompt library, then constrain generation rather than merely validating arbitrary text afterward:

```python
response = await client.responses.parse(
    model=spec.model,
    input=render(spec, {"ticket_text": ticket_text}),
    text_format=TriageResult,
    **dict(spec.settings),
)
if response.status == "incomplete" or not response.output_parsed:
    return escalate("triage_incomplete")
triage = response.output_parsed
```

Bound the length of each evidence string as well as the number of items. The `POST /api/tickets/{id}/triage` service persists the prompt/release version and routes the existing ticket; the agent UI shows the proposed result and allows a correction that becomes labelled evaluation data.

Examples must not contain hidden reasoning. Show input and correct output only. Ask for short evidence phrases copied or paraphrased from the ticket so reviewers can understand the decision without requesting private chain-of-thought.

<div class="diagram">
  <div class="flow"><span class="dbox gray">label rules</span><span class="darr">+</span><span class="dbox blue">boundary examples</span><span class="darr">+</span><span class="dbox orange">current ticket</span><span class="darr">→</span><span class="dbox purple">schema-constrained model</span><span class="darr">→</span><span class="dbox green">validated triage</span></div>
  <div class="dcap">Few-shot examples define difficult boundaries; the schema defines the machine contract.</div>
</div>

Create three prompt candidates: zero-shot, three-shot, and six-shot. Run all three against the same frozen evaluation set. Compare category macro F1, urgent-case recall, schema-valid rate, latency, and input cost. Choose the smallest prompt that meets the target; more examples can increase cost and sometimes anchor the model incorrectly.

For high-risk urgency detection, try structured self-consistency: run three independent low-temperature classifications and escalate when two agree on `urgent`, or when any deterministic rule finds words such as fire, injury, or stolen payment details. Measure the recall gain before paying triple cost.

## How a company uses this

A support team routes urgent safety issues to a staffed queue and Arabic messages to bilingual agents. False negatives on urgency cost more than false positives, so the threshold favors recall. Operations staff review a confusion matrix weekly and add examples only for recurring errors. Prompt versions and dataset versions are linked in the release record.

## Common mistakes

- Choosing examples because they look impressive rather than because they clarify boundaries.
- Putting real names, phone numbers, or order IDs in examples.
- Evaluating on the same examples used in the prompt.
- Asking for an explanation paragraph when short evidence fields are enough.
- Optimizing overall accuracy while rare urgent cases fail.

## Interview tip

Discuss the zero-shot baseline and the measured improvement from few-shot examples. Mention macro F1 and urgent-case recall rather than saying the prompt “felt better.”

## Practice — assignments

1. Build a 100-ticket anonymized evaluation set.
2. Measure the current zero-shot baseline.
3. Add three boundary examples and rerun the evaluation.
4. Compare three-shot and six-shot cost, latency, and quality.
5. Add deterministic urgent-safety rules.
6. Test majority voting on only the ambiguous subset.
7. Publish a confusion matrix with the prompt release.
