# Success metrics before building

**What it is:** deciding — in numbers — what "the feature works" means *before* you write any code, so you can tell success from a demo that merely looks impressive.

## Why it matters for an AI Engineer

LLM features demo beautifully and fail quietly. In a demo you cherry-pick three prompts and everyone claps; in production, edge cases you never tried erode the number that actually matters to the business. Without a metric defined up front, you have no way to answer "is this good enough to ship?" or "did my prompt change help or hurt?" — you're flying on vibes. Defining success first is what lets you iterate with an [evaluation set](../evaluation.md), justify the spend, and defend the feature when someone asks "does the AI actually work?" It's also the single most common thing junior engineers skip and senior engineers insist on.

## The mechanism: three layers of metrics

Good AI features track metrics at three levels, and you need all three:

1. **Model/quality metrics** — is the output *correct*? For classification: accuracy, precision/recall. For generation: faithfulness (no hallucination), relevance, an LLM-judge score, or exact-match against a labeled set. These come from an **offline eval set**: a fixed collection of inputs with known-good outputs you can re-run on every change.
2. **Product metrics** — do users get value? Task completion rate, deflection rate (support tickets avoided), time saved, edit distance (how much users rewrite the AI's draft), thumbs-up rate. These are measured live, on real users.
3. **Guardrail / cost metrics** — what does it cost to be right? Latency (p50/p95), $ per request, and *harm metrics* you must not regress: hallucination rate, refusal rate, safety violations.

The trap is optimizing layer 1 while layer 2 drops. A summarizer can score higher on ROUGE while users edit its output *more* — the offline metric improved, the product got worse. So you pick **one North Star product metric**, guard the cost/harm metrics as thresholds ("p95 < 3s, hallucination < 2%"), and use offline quality metrics as your fast iteration signal between deploys.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 Quality<span class="sub">offline eval set</span></span>
    <span class="darr">→</span>
    <span class="dbox green">🎯 Product<span class="sub">North Star: task success</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🛡️ Guardrails<span class="sub">latency, cost, harm</span></span>
  </div>
  <div class="dcap">Iterate on offline quality, prove value on the product North Star, never breach the guardrails.</div>
</div>

## Concrete example

You're building a RAG assistant for HR policy questions. Define success *before* building:

- **North Star (product):** ≥ 80% of questions resolved without a human handoff, with < 5% incorrect-answer complaints.
- **Offline quality gate (blocks deploy):** on a 100-question labeled eval set, faithfulness ≥ 0.9 and answer-relevance ≥ 0.85, scored by an LLM judge plus spot human checks.
- **Guardrails:** p95 latency < 3s; cost < \$0.02/query; hallucination rate < 2%.

Now every prompt tweak is measurable: run the eval set, check the gate, ship, watch the North Star. A pretty demo that fails the 100-question set never ships.

```python
# Minimal offline gate you run in CI on every prompt change
import statistics

eval_set = [
    {"q": "How many annual leave days?", "expected": "30 calendar days"},
    {"q": "Notice period for resignation?", "expected": "one month"},
    # ... 100 labeled cases
]

def score(answer: str, expected: str) -> float:
    # stand-in for an LLM-judge call returning 0..1 faithfulness
    return llm_judge(answer=answer, expected=expected)

scores = [score(rag_answer(x["q"]), x["expected"]) for x in eval_set]
faithfulness = statistics.mean(scores)
assert faithfulness >= 0.90, f"BLOCKED: {faithfulness:.2f} < 0.90 — do not deploy"
print(f"passed gate: {faithfulness:.2f}")
```

## How a company uses this

A Dubai bank shipping an internal document-search copilot defined success as *"analyst finds the right clause in < 30s, measured against their old 4-minute manual search"* — a time-saved product metric tied to real money (analyst hours). They ran a frozen 200-question eval set nightly; any prompt or index change that dropped faithfulness below 0.92 auto-blocked the release. When a model upgrade *raised* their offline score but *raised hallucination on numeric fields*, the guardrail metric caught it before rollout — saving them from a compliance incident. Without pre-defined metrics, the "better" model would have shipped and quietly started inventing figures.

## Common mistakes
- **Defining metrics after building** — you unconsciously pick the metric your feature already passes.
- **Only tracking model accuracy**, ignoring whether users actually complete their task or how much they edit the output.
- **No offline eval set** — so you can't tell if a prompt change helped; you're A/B-testing on live users blindly.
- **Vanity metrics** ("queries answered") instead of outcome metrics ("problems solved without escalation").

## Interview tip
Say: *"Before building I define one North Star product metric, an offline eval set as the fast iteration signal, and guardrail thresholds for latency, cost, and hallucination that block a deploy. That way I can prove a change is an improvement instead of trusting a demo."* Mentioning a *frozen eval set that gates deploys* immediately reads as production experience, not tutorial experience.
