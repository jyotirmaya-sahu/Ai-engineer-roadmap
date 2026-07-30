# Validation & Schemas

**The one-line idea:** a schema is a *contract* for what your data must look like — field names, types, required-ness, allowed ranges — and validation is the guard that checks incoming data against that contract and rejects or flags anything that violates it, at the door, before it can poison anything downstream.

## Why it matters for an AI Engineer

Pipelines fail in two ways: loudly (a job crashes) and silently (bad data flows through and the model quietly gets dumber). Validation converts silent failures into loud, catchable ones. In a RAG or feature pipeline, one malformed record — a null where you expected text, a date as `"N/A"`, a price of `-1` — can crash the embed step, or worse, embed and get retrieved as a real answer. Schemas also matter because LLMs increasingly *produce* structured output (JSON tool calls), and you validate *that* the same way (see [Structured output](../prompt-engineering/structured-output.md)). "How do you stop bad data getting in?" is a core data-quality interview question.

## The mechanism / how it works

A schema declares the *shape* and *rules* of a record. Validation runs each record through it and sorts records into pass/fail. There are three levels of strictness worth knowing:

1. **Type & presence** — is `email` a string and present? Is `age` an integer?
2. **Constraints** — is `age` between 0 and 120? Does `email` match an email pattern? Is `status` one of a fixed set?
3. **Cross-field & cross-row** — is `end_date` after `start_date`? Is `id` unique across the batch? Is the row count within expected bounds?

The other big idea is **schema evolution**: real data changes over time (a new column appears, a type widens). A good validation layer distinguishes *breaking* changes (a required field vanished — stop the pipeline) from *safe* ones (a new optional field — carry on). And crucially, decide the **policy for bad rows**: reject the whole batch, drop bad rows and continue, or quarantine them to a "dead-letter" table for a human to inspect. Quarantine is usually right — you don't want one bad row to block a million good ones, nor to silently vanish.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 Incoming records</span>
    <span class="darr">→</span>
    <span class="dbox purple">🛡️ Validate vs schema</span>
    <span class="darr">→<span class="lbl">pass</span></span>
    <span class="dbox green">✅ Load</span>
  </div>
  <div class="flow">
    <span class="dbox purple">🛡️ Validate</span>
    <span class="darr">→<span class="lbl">fail</span></span>
    <span class="dbox orange">🗑️ Dead-letter queue<span class="sub">inspect / alert</span></span>
  </div>
  <div class="dcap">Every record is checked against the contract; violators are quarantined, not silently dropped or allowed through.</div>
</div>

## Concrete example

Row-level validation with **Pydantic** (the Python standard, 2026-current v2):

```python
from pydantic import BaseModel, EmailStr, field_validator, ValidationError

class Customer(BaseModel):
    id: int
    email: EmailStr
    age: int
    status: str

    @field_validator("age")
    @classmethod
    def age_in_range(cls, v):
        if not 0 <= v <= 120:
            raise ValueError("age out of range")
        return v

good, dead_letter = [], []
for raw in incoming_rows:
    try:
        good.append(Customer(**raw))
    except ValidationError as e:
        dead_letter.append({"row": raw, "errors": e.errors()})

print(f"{len(good)} valid, {len(dead_letter)} quarantined")
```

For dataset-level checks (nulls, ranges, row counts across a whole table), the industry tools are **Great Expectations** or **Pandera** — you declare "expectations" like `expect_column_values_to_not_be_null("email")` and get a pass/fail report you can gate the pipeline on.

## How a company uses this

A Dubai fintech ingests transaction feeds from a dozen partner banks, each with slightly different formats. A validation layer (Pydantic per-row + Great Expectations per-batch) sits at the boundary: rows with malformed amounts or missing account refs are routed to a dead-letter table and alerted on, never reaching the fraud model or the customer-facing assistant. When a partner silently changed a date format, the pipeline didn't crash and didn't corrupt the model's features — it quarantined the affected rows and paged the data team, who fixed the parser and re-ran the dead-letter batch. Their number that matters: **zero** malformed records have reached the feature store since the layer went in, versus a prior incident where a bad feed skewed a risk model for two days before anyone noticed.

## Common mistakes / misconceptions

- **Validating too late.** Checking data *after* it's stored means the bad data already spread. Validate at ingestion, at the trust boundary.
- **All-or-nothing failure.** Rejecting a whole 10M-row batch because 3 rows are bad is fragile. Quarantine bad rows, load the rest.
- **Silent drops.** Dropping bad rows with no log or alert hides real upstream problems. Dead-letter + notify.
- **No schema evolution plan.** Treating every new column as a fatal error makes the pipeline brittle; distinguish breaking vs additive changes.

## Interview tip

Say: *"I put a schema contract at every ingestion boundary — Pydantic for row-level types and constraints, Great Expectations for dataset-level checks like nulls and row counts — and I quarantine violating rows to a dead-letter queue with an alert rather than crashing the batch or silently dropping them. That turns silent data-quality failures into loud, fixable ones before anything reaches the model."* The dead-letter-plus-alert detail is what signals real operational maturity.
