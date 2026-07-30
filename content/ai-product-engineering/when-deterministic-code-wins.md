# When deterministic code wins

**What it is:** the recognition that for a large class of tasks, plain old code — regex, SQL, a rules table, a parser, a calculator — beats an LLM on every axis that matters: correctness, speed, cost, and debuggability.

## Why it matters for an AI Engineer

A deterministic function returns the same, provably-correct answer every time, in microseconds, for free. An LLM returns a *probable* answer, in hundreds of milliseconds, for money, and might be wrong. When the task has a single correct answer that logic can compute, reaching for an LLM is strictly worse — you're trading correctness and speed for nothing. The mark of a mature AI engineer is a reflex to ask "can code do this exactly?" and to *build the AI system as mostly deterministic code with the LLM as a small, contained component*. This isn't anti-AI; it's what keeps AI products fast, cheap, and trustworthy. Interviewers and staff engineers respect it enormously.

## The mechanism: where determinism dominates

Use deterministic code whenever the task is any of these:

- **Exact computation** — math, dates, currency conversion, totals. `price * 1.05` for 5% VAT is always right; an LLM doing arithmetic is a liability.
- **Structured lookup** — "user's balance", "order status", "policy for country X". A database query is the answer, and it's *current* (an LLM's answer is frozen at training time).
- **Well-specified transformation** — parse a date, validate an email, extract fields from a fixed-schema document, format JSON. Parsers don't hallucinate.
- **Rule-based routing/decisions** — "if amount > 10000 → flag" or keyword matching. Enumerable rules → a rules engine, not a prompt.
- **Anything requiring an audit trail** — regulated decisions need "we applied rule 4.2", not "the model felt this was right."

The pattern that wins in production is a **hybrid**: deterministic code handles structure, validation, tools, and the common case; the LLM is called *only* for the genuinely fuzzy step, and its output is validated by code before use. The LLM proposes; deterministic code disposes.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 Input</span>
    <span class="darr">→</span>
    <span class="dbox blue">⚙️ Deterministic: validate, lookup, route</span>
    <span class="darr">→<span class="lbl">only if fuzzy</span></span>
    <span class="dbox purple">🧠 LLM step</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Code validates output</span>
  </div>
  <div class="dcap">The LLM is a small contained node; deterministic code surrounds and checks it.</div>
</div>

## Concrete example

Extracting an invoice total. The tempting move: "ask the LLM for the total." The robust move: let the LLM *locate* the value, but let code *own the number*.

```python
import re

def get_invoice_total(text: str) -> float:
    # LLM finds the raw string near "Total" — a fuzzy, layout-dependent task
    raw = llm_extract(text, field="grand total amount as it appears")

    # Deterministic code owns parsing, validation, and correctness
    m = re.search(r"[\d,]+\.\d{2}", raw)
    if not m:
        raise ValueError(f"no valid amount in LLM output: {raw!r}")
    total = float(m.group().replace(",", ""))

    # Deterministic cross-check: total must equal sum of line items
    if abs(total - sum(parse_line_items(text))) > 0.01:
        raise ValueError("total mismatch — flag for human review")
    return total
```

The LLM does the one fuzzy thing (find it in a messy layout). Code does the parsing, the type conversion, and the arithmetic cross-check — the parts where an LLM would silently err. If the model returns "approximately 5,000" or drops a digit, code catches it instead of shipping a wrong number.

## How a company uses this

A logistics firm in Dubai built a "smart" shipping-cost estimator. The first version asked an LLM to compute cost from weight, zone, and rate card — and it was wrong ~3% of the time on the arithmetic, which at thousands of quotes/day meant real disputes. They rebuilt it so the LLM *only* extracted weight and destination from free-text customer messages (genuinely fuzzy), then a deterministic rate-table function computed the price. Errors on the cost dropped to zero, latency fell (one small LLM call instead of a reasoning chain), and cost per quote dropped ~60%. The LLM was demoted to a parser — exactly where it belonged.

## Common mistakes
- **Letting the LLM do arithmetic or date math** — give it a calculator tool or do it in code.
- **Asking the LLM for facts that live in your database** — it'll confidently return stale or invented values; query the source of truth.
- **No code validation of LLM output** — always parse/validate/constrain what comes back before acting on it.
- **Over-correcting into "no AI ever"** — the fuzzy step (understanding messy input) genuinely needs the model; keep it there.

## Interview tip
Say: *"My default architecture is deterministic code with the LLM as a small, validated component — it handles the one fuzzy step, and code owns lookups, math, and output validation. That keeps the system correct, cheap, and auditable."* Then give the invoice or cost-estimator example. Showing you *demote* the LLM to only what it's uniquely good at is a strong seniority signal — pairs directly with [Is this even an AI problem?](is-this-even-an-ai-problem.md).
