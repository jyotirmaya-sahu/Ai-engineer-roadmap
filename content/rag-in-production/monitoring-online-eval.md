# Monitoring & Online Eval

**What it is:** watching your RAG system *in production* — tracing every request, checking answer quality on live traffic, collecting user feedback, and alerting when something regresses — so you catch problems before users file tickets.

## Why it matters for an AI Engineer

Offline eval (see [debugging-retrieval-failures.md](debugging-retrieval-failures.md)) tells you how you did on a fixed test set. **Online eval** tells you how you're doing *right now, on real users*, where the queries are messier and the corpus keeps changing. Without it you're flying blind: quality silently drifts as documents change or a model updates, and the first signal you get is an angry user. Monitoring is what turns RAG from "hope it's still working" into an operated system. It's also the thing that makes debugging *possible* — you can't root-cause a failure you didn't trace.

## The mechanism: trace, evaluate, feedback, alert

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ request</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 RAG pipeline</span>
    <span class="darr">→<span class="lbl">emit trace</span></span>
    <span class="dbox blue">🗄️ Langfuse<span class="sub">spans + inputs/outputs</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">📊 dashboards + online eval</span>
    <span class="darr">→</span>
    <span class="dbox green">🚨 alerts</span>
  </div>
  <div class="dcap">Every request emits a trace; dashboards and automated evals watch it; alerts fire on regression.</div>
</div>

### 1. Tracing — the foundation

For every request, log a **trace** with a span per stage (embed, search, rerank, generate), capturing: the query, the retrieved chunk IDs + scores, the final prompt, the answer, latency per stage, token counts, and cost. **Langfuse** is the standard open-source tool for this in 2026 (self-hostable — useful for a Dubai enterprise with data-residency rules). This is what makes the retrieval-vs-generation split possible later.

```python
from langfuse.decorators import observe, langfuse_context

@observe()
def answer(query: str):
    hits = retrieve(query)
    langfuse_context.update_current_observation(
        metadata={"chunk_ids": [h.id for h in hits],
                  "scores": [h.score for h in hits]}   # log what was retrieved
    )
    out = generate(query, hits)
    return out
```

### 2. Online eval — grade live answers automatically

You can't hand-check a million answers. Instead, sample live traffic and run automated quality checks — the key one for RAG is **faithfulness / groundedness**: does the answer stay within the retrieved context, or did it hallucinate? An **LLM-as-judge** call scores it:

```python
def faithfulness_check(answer: str, context: str) -> float:
    prompt = (f"Context:\n{context}\n\nAnswer:\n{answer}\n\n"
              "Is every claim in the Answer supported by the Context? "
              "Reply with a score 0.0–1.0 and nothing else.")
    return float(judge_llm(prompt).strip())

# run on, say, 5% of live traffic; alert if the rolling average drops
```

Other online signals: **context relevance** (were retrieved chunks actually on-topic?), **answer relevance** (did it address the question?), and **"I don't know" rate** (a spike often means retrieval broke). Sampling 1–5% keeps the eval cost small.

### 3. User feedback — the cheapest ground truth

A thumbs up/down on each answer is gold. Log it against the trace ID so a 👎 links straight to the retrieved chunks and prompt that produced it — instant debugging material. Track the 👎 rate as a top-line quality metric.

### 4. Dashboards & alerts — what to actually watch

| Metric | Why | Alert when |
|---|---|---|
| p95 latency per stage | catch slowdowns | p95 > SLA (e.g. 2s) |
| faithfulness score (rolling) | catch hallucination drift | drops below threshold |
| 👎 / thumbs-down rate | real user quality | spikes vs baseline |
| "I don't know" rate | proxy for retrieval breaking | sudden jump |
| retrieval score distribution | corpus/index health | top-score median falls |
| cost / 1k queries | budget guard | exceeds target |
| error / timeout rate | reliability | > baseline (see [high-availability-fallbacks.md](high-availability-fallbacks.md)) |

The point of alerts: a bad deploy or a corrupted re-index should page *you*, not surface as a user complaint days later.

## How a company uses this

> A **Dubai government service portal** runs a citizen-facing RAG in Arabic and English. They trace everything to a **self-hosted Langfuse** (data must stay in-country). An online faithfulness judge runs on 5% of answers; when a re-index accidentally dropped a batch of Arabic documents, the "I don't know" rate for Arabic queries spiked and faithfulness dipped — an alert fired within the hour, long before any citizen complained. The 👎 button, linked to traces, lets them jump from a bad answer straight to the chunks that caused it. Mean-time-to-detect went from days to under an hour.

## Common mistakes
- **Logging only the final answer**, not the retrieved chunks — you keep the symptom but lose the evidence needed to debug.
- **Only offline eval** — a static test set can't catch drift from a changing corpus or a silently-updated model.
- **No alerting** — you have dashboards nobody looks at until a user complains.
- **Judging 100% of traffic** — expensive and unnecessary; sample 1–5%.
- **Feedback not linked to trace IDs** — a 👎 you can't connect to *what produced it* is nearly useless.

## Interview tip
Say: *"I trace every request with Langfuse — spans per stage plus the retrieved chunk IDs, prompt, cost, and latency — because that trace is what makes debugging possible. On live traffic I sample a few percent and run an LLM-as-judge faithfulness check to catch hallucination drift, collect thumbs up/down linked to trace IDs, and alert on p95, faithfulness, the 'I don't know' rate, and cost. Offline eval catches regressions on a fixed set; online eval catches drift from a corpus and model that keep changing."*
