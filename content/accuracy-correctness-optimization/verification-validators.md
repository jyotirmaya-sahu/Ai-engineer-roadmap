# Verification & validators

**What it is:** Running the model's output through an *external, deterministic checker* — a code executor, a schema, a rule, another model — that can prove the answer right or catch it wrong, instead of trusting the LLM's word.

## Why it matters for an AI Engineer

Self-critique has a ceiling: a model can't reliably catch an error it has no way to *test*. Validators break that ceiling by bringing in ground truth from *outside* the model. If the task is machine-checkable — does the code run, does the SQL execute, is the citation actually entailed, does the number sum correctly — you can turn "the LLM says it's right" into "we *proved* it's right (or caught that it isn't)." This is the most reliable accuracy lever available and the foundation of trustworthy agents: an agent that verifies each step before proceeding fails far less than one that assumes success.

## The mechanism

A validator is any function that takes the output and returns pass/fail (plus, ideally, an error message you can feed back for a revise step). The art is choosing a check *stronger* than the model itself:

- **Executable checks (the gold standard).** Run generated code against unit tests; execute generated SQL on a sample DB; parse generated JSON. The world tells you the truth, no LLM judgment involved. This is why coding agents work — the test suite is an oracle.
- **Schema / type validators.** Pydantic, JSON Schema, regex. Cheap, deterministic, catches structural errors. (Constrained decoding *prevents* these; validators *catch* them — use whichever fits.)
- **Rule / constraint checks.** Domain invariants: "line items must sum to the total," "discharge date ≥ admission date," "cited page exists in the document." Pure Python, near-free, catches logic errors an LLM misses.
- **Entailment / faithfulness models.** A small NLI model checks each claim is actually supported by the source — the verifier behind [citation-forcing](./grounding-citation-forcing.md).
- **LLM-as-judge (weakest, most flexible).** Use only when nothing deterministic exists; treat its verdict as a signal, not proof.

The pattern is **verify → on failure, feed the error back to revise → re-verify**, capped at N attempts. The validator is what makes [generate-critique-revise](./generate-critique-revise.md) reliable instead of hopeful.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 output</span>
    <span class="darr">→</span>
    <span class="dbox orange">🧪 validator (run code / check rule)</span>
    <span class="darr">→<span class="lbl">fail</span></span>
    <span class="dbox purple">✏️ revise w/ error</span>
    <span class="darr">→<span class="lbl">pass</span></span>
    <span class="dbox green">✅ proven correct</span>
  </div>
  <div class="dcap">An external checker returns pass/fail; failures feed back as a concrete error for revision.</div>
</div>

## Concrete example

```python
import ast
from anthropic import Anthropic
c = Anthropic()

def gen(prompt):
    return c.messages.create(model="claude-sonnet-4-6", max_tokens=500,
        messages=[{"role": "user", "content": prompt}]).content[0].text

def validate(code):
    """External oracle: does the generated code pass the spec's tests?"""
    ns = {}
    try:
        exec(code, ns)
        assert ns["is_prime"](7) is True
        assert ns["is_prime"](1) is False
        assert ns["is_prime"](9) is False
        return True, ""
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"

prompt = "Write `def is_prime(n): ...` returning True/False. Return code only."
code = gen(prompt)
for _ in range(3):                       # cap attempts
    ok, err = validate(code)
    if ok:
        break
    code = gen(f"{prompt}\nYour code failed: {err}\nFix it.")
assert ok, "still failing after 3 tries -> escalate"
print(code)
```

The unit tests, not the model, decide correctness — that's the whole point.

## How a company uses this

A Dubai accounting-automation startup has an agent draft journal entries from receipts. LLM-only, it sometimes produced entries that *looked* right but didn't balance. They added a deterministic validator: **debits must equal credits, and each line's account must exist in the chart of accounts** — pure Python, sub-millisecond, essentially free. Any entry that fails is bounced back to the model with the exact imbalance ("debits 1,250 ≠ credits 1,200") for a fix, capped at 3 tries, then escalated. Post-validator, *zero* unbalanced entries reach the ledger — a hard financial invariant is now enforced by code, not hoped for from a prompt. The lesson: the cheapest, most reliable accuracy win is a deterministic rule check, not a fancier model.

## Common mistakes

- **Using an LLM judge when a deterministic check exists.** If you can run it, run it — code/rules beat an LLM opinion on cost, speed, and reliability.
- **A validator no stronger than the generator.** Asking the same model "is this right?" adds latency, not accuracy. The check must have independent ground truth.
- **Not feeding the error back.** Pass/fail alone wastes the signal; the error *message* is what lets the revise step actually fix it.
- **Unsandboxed code execution.** Running model-generated code needs a sandbox (timeouts, no network/filesystem) or you've built a security hole.

## Interview tip
Say: *"Whenever correctness is machine-checkable I verify with an external validator, not the model's opinion — run the code against tests, execute the SQL, enforce domain invariants like debits equal credits, or entailment-check citations. On failure I feed the concrete error back for a bounded revise loop, then escalate. A deterministic rule check is the cheapest and most reliable accuracy lever there is; an LLM judge is a last resort when nothing deterministic exists."* Naming the executable-oracle idea (why coding agents work) signals real depth.
