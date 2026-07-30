# Testing frameworks

**What it is:** the structured tooling and test-type taxonomy for verifying an LLM app — from ordinary unit tests on your glue code to non-deterministic quality tests on the model's output.

## Why it matters for an AI Engineer

"How do you test something that gives a different answer every time?" is one of the most common — and most revealing — AI Engineer interview questions. The naive answer ("you can't, it's non-deterministic") is wrong and disqualifying. The truth is you test an LLM app on *two levels*: the deterministic scaffolding (parsing, routing, tools, API calls) with normal `pytest`, and the non-deterministic model output with *property* and *quality* tests. Without a real test suite you're one prompt edit away from silently breaking production; with one, you refactor and ship with confidence. Testing frameworks are the foundation that [automated eval gates](/llmops-observability/automated-eval-gates) and [CI/CD](/llmops-observability/ci-cd) are built on.

## The mechanism — how it works

Split the app into what's deterministic and what isn't, and test each accordingly:

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">🔧 DETERMINISTIC scaffolding<span class="sub">parsing · routing · tool calls · retrieval plumbing</span></span>
    <span class="darr">↓<span class="lbl">test with</span></span>
    <span class="dbox green">✅ normal pytest — mock the LLM, assert exact behavior (fast, in CI on every commit)</span>
    <span class="dbox purple">🎲 NON-DETERMINISTIC model output<span class="sub">the generated answer</span></span>
    <span class="darr">↓<span class="lbl">test with</span></span>
    <span class="dbox orange">📐 property tests<span class="sub">is it valid JSON? cites a source? no PII? in-scope?</span></span>
    <span class="dbox orange">🎯 quality/eval tests<span class="sub">LLM-as-judge / semantic match over a golden set</span></span>
  </div>
  <div class="dcap">Two layers: deterministic code gets exact-assertion unit tests; model output gets property + quality tests.</div>
</div>

**Unit tests (pytest)** — for everything that *isn't* the model: does the JSON parser handle a malformed response? does the router pick the right tool? For these you **mock the LLM call** so tests are fast, free, and deterministic.

**Property/invariant tests** — you can't assert the exact wording, but you *can* assert properties that must always hold: output parses as valid JSON, contains a citation, stays under a token limit, never leaks the system prompt, refuses out-of-scope questions. These run against real model output but assert *shape*, not exact text.

**Quality/eval tests** — grade *how good* the answer is, over a golden dataset, using [LLM-as-judge](/llmops-observability/online-evaluation) or semantic similarity, with a pass threshold. These are the eval suite the [gate](/llmops-observability/automated-eval-gates) runs.

**Adversarial/red-team tests** — deliberate attacks (prompt injection, jailbreaks, edge inputs) to check guardrails hold.

Tooling: `pytest` for the base layer; **DeepEval** (pytest-native LLM assertions like `assert_test(faithfulness, threshold=0.7)`), **promptfoo** (YAML matrix of prompts × cases × assertions), and **Langfuse datasets** for versioned test sets tied to traces.

## Concrete example

```python
import pytest
# 1) Deterministic unit test — mock the LLM, assert exact behavior
def test_router_picks_search_tool(mocker):
    mocker.patch("app.llm", return_value='{"tool":"search","q":"villas"}')
    assert route("find villas in Dubai").tool == "search"

# 2) Property test — real output, assert an invariant that must ALWAYS hold
def test_answer_is_valid_json_with_citation():
    out = app.answer("What's the refund window?")
    data = json.loads(out)                 # must parse
    assert data["source"], "every answer must cite a source"

# 3) Quality test (DeepEval-style) — grade over a golden case
from deepeval.metrics import FaithfulnessMetric
def test_faithfulness():
    m = FaithfulnessMetric(threshold=0.8)
    m.measure(build_test_case("What's the refund window?"))
    assert m.score >= 0.8
```

## How a company uses this

A Dubai proptech's listing-assistant has ~120 pytest unit tests on parsing/routing/tools (run on every commit, <10s, all mocked), ~30 property tests ("output is valid JSON with a listing ID, never invents a price"), and a 200-case DeepEval quality suite run in the [eval gate](/llmops-observability/automated-eval-gates). The property tests earn their keep: a model update once started wrapping JSON in markdown fences, and the "valid JSON" property test caught it in CI in seconds — a bug that would otherwise have broken every downstream parse in production. Split by cost: cheap mocked tests on every commit, expensive judge-based quality tests only on PRs to keep the pipeline fast.

## Common mistakes
- **"It's non-deterministic so I can't test it."** You test properties and quality, not exact strings. Saying this in an interview sinks you.
- **Not mocking the LLM in unit tests** — makes them slow, flaky, and expensive; you end up not running them.
- **Only quality tests, no property tests** — you miss cheap, high-value invariants (valid JSON, citation present, no PII).
- **No adversarial tests** — guardrails you never test are guardrails you can't trust.
- **Asserting exact model wording** — brittle; it'll fail on a harmless rephrase. Assert intent/properties instead.

## Interview tip
Say: *"I test an LLM app in layers. The deterministic scaffolding — parsing, routing, tools — gets normal pytest with the model mocked, run on every commit. The model output gets property tests for invariants that must always hold (valid JSON, cites a source, stays in scope) plus a quality suite scored with LLM-as-judge over a golden set, using DeepEval or promptfoo. Plus adversarial tests for the guardrails. You don't assert exact text — you assert properties and quality."* That taxonomy is exactly what feeds [automated eval gates](/llmops-observability/automated-eval-gates) inside [CI/CD](/llmops-observability/ci-cd).
