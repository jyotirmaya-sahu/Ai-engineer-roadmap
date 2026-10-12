# Orchestration Basics

**The one-line idea:** orchestration is the "conductor" that runs the steps of a pipeline in the right order, waits for each to finish, retries the ones that fail, and tells you when something broke — so a multi-step data job runs reliably without a human babysitting it.

## Why it matters for an AI Engineer

The moment your pipeline has more than one step — ingest → clean → embed → index — you have a coordination problem. Step 3 must not run before step 2 succeeds; if the embedding API times out, you want an automatic retry, not a silent gap in your vector store; and when a nightly RAG refresh fails at 2am you want an alert, not a broken chatbot discovered by a customer at 9am. Orchestration is what turns a fragile chain of scripts into a dependable system. Every production RAG or data pipeline runs on one, so "how would you schedule and monitor this?" is a standard follow-up in interviews.

## The mechanism / how it works

An orchestrator models your pipeline as a **DAG** — a Directed Acyclic Graph. Each node is a **task** (a unit of work like "extract" or "embed"), and edges are **dependencies** ("embed runs only after clean succeeds"). "Directed" = arrows have direction; "acyclic" = no loops, so the graph always terminates. The orchestrator walks this graph, running tasks whose dependencies are all done, in parallel where it can.

On top of the DAG it gives you four things scripts don't:

1. **Scheduling** — run the DAG on a cron ("daily at 2am") or trigger it on an event.
2. **Retries & backoff** — a failed task retries N times with increasing delay before it's marked failed (see [Retries & backoff](../llm-apis-advanced/retries-backoff.md) for the same idea applied to API calls).
3. **Observability** — a UI/logs showing which run succeeded, which task failed, and how long each took.
4. **Backfills** — re-run the pipeline for past dates to fix or fill in history.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 extract</span>
    <span class="darr">→</span>
    <span class="dbox orange">🧹 clean</span>
    <span class="darr">→</span>
    <span class="dbox purple">🔢 embed</span>
    <span class="darr">→</span>
    <span class="dbox blue">🗄️ index</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ notify</span>
  </div>
  <div class="dcap">A DAG: each task runs only after its upstream tasks succeed; the orchestrator handles order, retries, and alerts.</div>
</div>

Common tools: **Airflow** (the industry default, Python-defined DAGs), **Dagster** and **Prefect** (more modern, data-asset-aware), and managed cloud versions (AWS Step Functions, GCP Cloud Composer).

## Concrete example

A minimal Airflow DAG for a RAG refresh:

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
import datetime as dt

with DAG(
    dag_id="rag_refresh",
    schedule="0 2 * * *",                 # 2am daily
    start_date=dt.datetime(2026, 1, 1),
    catchup=False,
    default_args={"retries": 3, "retry_delay": dt.timedelta(minutes=5)},
) as dag:
    extract = PythonOperator(task_id="extract", python_callable=extract_docs)
    clean   = PythonOperator(task_id="clean",   python_callable=clean_docs)
    embed   = PythonOperator(task_id="embed",   python_callable=embed_docs)
    index   = PythonOperator(task_id="index",   python_callable=upsert_vectors)

    extract >> clean >> embed >> index    # the >> defines the DAG edges
```

That `>>` line *is* the dependency graph. If `embed` fails (API blip), Airflow retries it 3 times, 5 minutes apart, before failing the run and firing an alert — `index` never runs on bad data.

## How a company uses this

A Dubai insurance firm runs its document-AI pipeline on Airflow: ~40 DAGs covering claims ingestion, policy re-embedding, and nightly report generation. Orchestration earns its keep in the failure cases — when their embedding provider had a 20-minute outage, the retry-with-backoff policy meant most tasks simply succeeded on retry with zero human involvement; the few that didn't showed up as red in the UI with logs pinpointing the failed document. Before Airflow, the same work was cron'd shell scripts, and a single mid-chain failure left the vector store half-updated with no signal — the chatbot would confidently answer from a corpus that was 60% fresh and 40% stale. The orchestrator's real product is *trust*: you know the state of every run.

## Common mistakes / misconceptions

- **Putting heavy compute inside the orchestrator.** Airflow schedules and coordinates; it shouldn't crunch a million rows in-process. Have tasks *trigger* Spark/SQL/an API and wait, not do the crunching themselves.
- **No retries or no alerting.** A pipeline that fails silently is worse than no pipeline. Set `retries` and wire failure notifications.
- **Non-idempotent tasks.** Retries mean a task may run twice — writes must be safe to repeat (upsert, not blind insert), or retries create duplicates.
- **Cyclic thinking.** "Loop until done" doesn't belong in a DAG. Model iteration as scheduled runs, not graph cycles.

## Interview tip

Say: *"Once a pipeline has multiple dependent steps, I put it under an orchestrator like Airflow — model it as a DAG, set retries with backoff so transient failures self-heal, make tasks idempotent so retries are safe, and wire alerting so a 2am failure pages someone instead of surfacing as a broken chatbot at 9am."* Mentioning idempotency and alerting unprompted signals you've actually operated pipelines, not just drawn them.
