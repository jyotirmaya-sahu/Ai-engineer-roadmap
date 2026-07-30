# Top-K Selection

**The one-line idea:** Top-K is the single dial that decides **how many chunks retrieval hands to the LLM** — set it too low and you miss the answer, too high and you drown the model (and your budget) in irrelevant text.

## Why it matters for an AI Engineer

Every retriever call has a `k`, and it's the most-tuned, least-understood knob in RAG. It directly trades **recall** (did we catch the answer at all?) against **precision + cost** (how much junk did we drag in, and how many tokens are we paying for?). Getting it wrong is the quiet cause of both "the bot missed obvious info" (k too small) and "the bot got confused / hallucinated / cost a fortune" (k too big). Interviewers use "what k do you use and why?" as a quick depth check.

## The mechanism — how it works

After search scores every candidate chunk, you keep the top **k** by score and discard the rest. The tension:

- **Small k (1–3):** high precision, low cost, but if the answer sits in the 4th chunk, it's gone forever — the LLM can't retrieve what it never received. This is a **recall** failure.
- **Large k (15–30):** high recall (the answer is almost surely in there somewhere), but three costs: (1) **tokens** — you pay per chunk and may blow the context window; (2) **distraction** — LLMs get *worse* when the prompt is padded with irrelevant chunks, and the "lost in the middle" effect buries the good one; (3) **latency**.

The pro move is a **two-stage funnel**: retrieve a *generous* k (say 30–50) cheaply, then **rerank** and keep only the top 3–5 for the LLM. Wide net for recall, tight final selection for precision — you get both.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ all chunks</span>
    <span class="darr">→<span class="lbl">retrieve k=40</span></span>
    <span class="dbox orange">📄 40 candidates<span class="sub">high recall, cheap</span></span>
    <span class="darr">→<span class="lbl">rerank</span></span>
    <span class="dbox green">📄 top 4<span class="sub">high precision, sent to LLM</span></span>
  </div>
  <div class="dcap">Retrieve wide for recall, then narrow to a small k for precision and token budget.</div>
</div>

## Concrete example — worked numbers

Say each chunk is ~200 tokens and your input cost is $3 / 1M tokens.

| k | Tokens sent | Cost / query | Recall | Risk |
|---|---|---|---|---|
| 2 | ~400 | $0.0012 | may miss answer | under-retrieval |
| 5 | ~1,000 | $0.0030 | good sweet spot | balanced |
| 30 | ~6,000 | $0.0180 | answer almost always in | distraction + 6× cost |

Setting `k` in LangChain:

```python
# retrieve wide, then hand to a reranker that keeps the final few
retriever = store.as_retriever(search_kwargs={"k": 40})   # stage 1: high recall
# ... a reranker (cross-encoder / Cohere) then trims to top 4 for the prompt
```

For 100k queries/day, moving from k=30 to a retrieve-40-rerank-to-4 pipeline can cut LLM input tokens ~6× *and* improve answer quality — the classic win.

## How a company uses this

A **Dubai insurance** claims assistant started at k=3 and kept missing edge-case policy clauses (they lived in the 4th–6th chunk). Jumping to k=20 fixed recall but doubled token spend and made answers waffly. The settled design: **retrieve k=25, rerank to k=4.** Recall recovered, cost dropped back down, answers tightened.

## Common mistakes / misconceptions

- **Treating k as one number.** The retrieval-k and the final-to-LLM-k are *different dials*. Retrieve wide, send narrow.
- **Cranking k to "be safe."** More context often makes LLM answers *worse*, not better — irrelevant chunks distract the model. High recall without reranking is a trap.
- **Ignoring chunk size.** k=5 with 1,500-token chunks is 7,500 tokens; k=5 with 200-token chunks is 1,000. Budget in *tokens*, not chunk count.
- **Never measuring.** Pick k with a small eval set (recall@k), not vibes.

## Interview tip
Say: *"I don't pick a single k — I retrieve wide, maybe 30–50 for recall, then rerank down to 3–5 for the LLM. That gets recall from the wide net and precision plus a small token budget from the tight final selection. A big k without reranking usually *hurts* because irrelevant chunks distract the model."* The two-stage funnel answer is what separates practitioners from tutorial-followers.

See also: **Reranking** (the narrowing stage), **MMR** (diversify the top-K), and **Contextual Compression** (shrink what survives).
