# LangSmith / Langfuse

**The one-line idea:** LangSmith and Langfuse are the observability-and-eval platforms for LLM apps — they trace every call, host your datasets and scores, and monitor quality in production, turning ad-hoc eval scripts into a real system.

## Why it matters for an AI Engineer

You *can* run metrics with loose scripts, but at production scale you need to *see inside* a multi-step chain (which retrieval, which prompt, which token blew the latency?), store and version datasets, run eval experiments, and watch live quality drift. These platforms provide exactly that. LangSmith (by LangChain) and Langfuse (open-source, self-hostable) are the tools job posts name and interviewers ask about — "how do you monitor your LLM app in production?" has these as the answer. For a Dubai bank that needs to self-host on-prem for data residency, **Langfuse's open-source option is often the deciding factor.**

## The mechanism — how it works

Both do three things that together close the eval loop:

1. **Tracing.** Every LLM/RAG call is logged as a **trace** — a tree of spans: retrieval step (which chunks, scores), each LLM call (prompt, output, tokens, latency, cost), tool calls. When an answer is bad, you open its trace and see *exactly* where it went wrong — the missing chunk, the mangled prompt, the slow step. This is the debugging superpower.
2. **Datasets + experiments.** Store golden datasets in the platform, run your system over them, attach scores (from code metrics, LLM-judge, or human review in the UI), and compare experiments side by side. This is your regression-eval home, with history and diffs.
3. **Production monitoring.** Sample live traffic, run online evaluators (e.g. an LLM-judge for faithfulness) on real answers, and dashboard the metrics over time with alerts. Human reviewers can grade or annotate traces in the same UI, feeding labels back into datasets.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🤖 every LLM/RAG call</span>
    <span class="darr">↓<span class="lbl">SDK auto-traces</span></span>
    <span class="dbox blue">🗄️ traces · datasets · scores</span>
    <span class="darr">↓</span>
    <span class="dbox orange">📊 experiments · dashboards · alerts</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ debug · gate · monitor drift</span>
  </div>
  <div class="dcap">One platform for tracing, dataset/eval experiments, and live production monitoring.</div>
</div>

## Concrete example

```python
# Langfuse — open-source, self-hostable (great for on-prem data residency)
# pip install langfuse
from langfuse import observe, get_client
from openai import OpenAI

langfuse = get_client()
client = OpenAI()

@observe()                                  # auto-traces inputs, outputs, latency, cost
def answer(question, contexts):
    prompt = f"Answer using only:\n{contexts}\n\nQ: {question}"
    resp = client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": prompt}])
    out = resp.choices[0].message.content
    langfuse.score_current_trace(name="faithfulness", value=0.95)  # attach a metric
    return out

answer("What's the notice period?", "Closing needs 30 days notice.")
# → full trace (prompt, output, tokens, cost, latency, faithfulness) in the dashboard
```

LangSmith is nearly identical in spirit — wrap calls with its SDK / `@traceable`, and datasets + evaluators live in its cloud UI.

## How a company uses this

A **Dubai bank** self-hosted **Langfuse on-prem** (customer data can't leave the country — the open-source option was decisive over a cloud-only tool). Every assistant answer is traced, so when a customer reports a wrong answer, support pastes the trace ID and an engineer sees the exact retrieved chunks and prompt in seconds — root-causing in minutes instead of hours. Their golden set lives in Langfuse; CI runs experiments against it; and an online faithfulness evaluator samples ~2% of live traffic, dashboarding the hallucination rate with an alert if it drifts above 3%. One platform spans dev-time eval and production monitoring, which is exactly why these tools exist.

## Common mistakes / misconceptions

- **Assuming you need LangChain to use them.** Both trace *any* code via SDK/decorators — you don't have to build on LangChain.
- **Cloud-only when data residency matters.** For regulated Dubai/GCC data, a cloud-only platform can be a non-starter. Langfuse self-hosting is often why it wins.
- **Tracing but never evaluating.** Traces alone are just logs. The value is attaching *scores* and running *experiments* on top.
- **Logging full sensitive payloads.** Traces can capture PII/customer data — mask or redact sensitive fields before they hit the platform.

## Interview tip
Say: *"For observability I use Langfuse or LangSmith — they trace every span of a RAG/agent call so I can open a bad answer and see the exact chunks, prompt, tokens, latency and cost, host my golden datasets and eval experiments, and run online evaluators on sampled production traffic with drift alerts. For regulated data I'll self-host Langfuse on-prem."* Mentioning tracing-for-debugging *and* the on-prem/data-residency angle shows production and enterprise awareness.

See also: [Regression / CI eval](./regression-ci-eval.md) (experiments these host), [Golden datasets](./golden-datasets.md) (stored here), and [RAG in Production] (where tracing earns its keep).
