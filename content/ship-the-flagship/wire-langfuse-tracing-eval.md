# Wire Langfuse Tracing + Eval

**What it is:** Adding a recorder to your live app that logs *every* LLM call — the exact prompt, the tokens used, the cost, the latency, the output — so you can see what your app actually did in production, and score whether those outputs were any good.

## Why it matters for an AI Engineer

An LLM is a black box that is *also* non-deterministic and *also* costs money per call. That's a nightmare to run blind. Without observability you can't answer the questions the job depends on: *Why did this user get a wrong answer? Which prompt version is cheaper? Is quality dropping since we changed the model?* Traditional logging doesn't cut it — you need to see the full prompt (often assembled from retrieval + history + a system message), the token breakdown, and the cost, all linked to one request. **Langfuse** is the open-source standard for this. "You can't fix what you can't see" is literally the reason LLMOps exists as a job function, and tracing is its foundation.

## The mechanism / how it works

Two connected ideas: **tracing** (record what happened) and **eval** (judge if it was good).

**Tracing.** A single user request becomes a **trace**. Inside it, each step is a **span** or **generation**: the retrieval span (what chunks came back), the LLM generation (prompt in, completion out, tokens, cost, latency, model name). Langfuse nests these into a tree so you can open one slow or wrong request and see *every* step that produced it. You instrument your code by decorating functions with `@observe()`, or by using Langfuse's drop-in wrapper around the OpenAI client so every call is captured automatically with zero extra code per call.

**Eval.** Tracing tells you *what* happened; eval tells you if it was *good*. Two flavors:

- **Online eval** — score live production traces. The cheap, scalable way is **LLM-as-judge**: a second model reads the question + answer + retrieved context and scores faithfulness ("is this answer grounded in the context, or hallucinated?") on every trace, or a sample of them.
- **Offline eval** — before you ship a prompt change, run it against a fixed **dataset** of question→expected-answer pairs and compare scores. This is your regression test for quality: does the new prompt actually beat the old one, or did it just *feel* better?

Crucially, traces link to eval scores, so you can filter "show me every production request that scored below 0.5 on faithfulness" and read exactly what went wrong.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📨 request</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔍 retrieval span</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM generation<span class="sub">prompt · tokens · $ · ms</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">🔭 Langfuse trace</span>
    <span class="darr">→<span class="lbl">LLM-judge</span></span>
    <span class="dbox green">✅ faithfulness score</span>
  </div>
  <div class="dcap">Every step of a request is recorded as one trace, then scored for quality.</div>
</div>

## Concrete example

Instrumenting the FastAPI RAG endpoint from the earlier steps:

```python
# pip install langfuse openai
# env: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST
from langfuse import observe, get_client
from langfuse.openai import AsyncOpenAI   # drop-in wrapper auto-traces every call

client = AsyncOpenAI()
langfuse = get_client()

@observe()                    # creates the top-level trace for the request
async def answer(question: str, top_k: int = 5):
    chunks = retrieve(question, top_k)          # your retrieval; auto-nested as a span
    context = "\n\n".join(chunks)
    resp = await client.chat.completions.create(  # captured: prompt, tokens, cost, latency
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"Answer ONLY from context:\n{context}"},
            {"role": "user", "content": question},
        ],
    )
    ans = resp.choices[0].message.content

    # online LLM-as-judge: score faithfulness of THIS answer, attach to the trace
    verdict = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content":
            f"Context:\n{context}\n\nAnswer:\n{ans}\n\n"
            "Is the answer fully supported by the context? Reply 1 (yes) or 0 (no)."}],
    )
    score = float(verdict.choices[0].message.content.strip())
    langfuse.score_current_trace(name="faithfulness", value=score)
    return ans
```

Now every request shows up in the Langfuse dashboard with its full prompt, a **cost in dollars**, a **latency in ms**, and a faithfulness score — and you can sort by "cheapest," "slowest," or "lowest quality" to find exactly what to fix.

## How a company uses this

At production scale, tracing is the difference between "users say it's wrong sometimes" and "6.2% of traces scored below 0.5 faithfulness, all from documents ingested after the March re-index." Concretely: a support-RAG team watches a **cost-per-conversation** metric in Langfuse and catches the day it jumps from $0.004 to $0.011 because a prompt change accidentally stopped truncating chat history — a fix worth thousands of dollars a month at volume. They run **LLM-as-judge on a 5% sample** of live traffic (judging every request would double the LLM bill), and reserve full **offline eval on a golden dataset of ~200 Q&A pairs** as a mandatory gate in CI: no prompt or model change ships unless average faithfulness holds or improves. When a customer complains about a specific bad answer, support pastes the trace ID and an engineer opens the *exact* prompt, retrieved chunks, and model output in seconds — root-cause instead of guesswork.

## Common mistakes

- **Logging only inputs and outputs, not the assembled prompt.** The bug is almost always in the *full* prompt (bad retrieved context, a truncated system message) — you must capture that, not just the user's question.
- **Judging 100% of traffic with an LLM.** It doubles cost and latency. Sample (e.g. 5%) for online eval; run the full suite offline.
- **No offline eval dataset.** Then every prompt change is a vibe-based guess with no regression safety net — quality silently drifts.
- **Blocking the user response on the eval call.** Run the LLM-judge asynchronously or in the background so scoring never adds latency to the user's answer.
- **Trusting one judge blindly.** LLM judges are noisy — spot-check them against human labels periodically.

## Interview tip

Say: *"I trace every LLM call in Langfuse — full assembled prompt, tokens, cost, and latency linked per request — because you can't debug or cost-optimize a black box you can't see. For quality I run LLM-as-judge for faithfulness on a sample of live traffic, and gate every prompt or model change behind an offline eval on a golden dataset so quality can't silently regress."* Tying tracing to *cost per conversation* and eval to *a CI quality gate* shows you think in production terms, not demo terms.
