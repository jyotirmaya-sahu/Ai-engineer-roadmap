# RAG vs fine-tune vs long-context vs prompt

**What it is:** the four ways to get *knowledge* into an LLM's answer — and the decision of which one fits your data's size, freshness, and budget.

## Why it matters for an AI Engineer

This is the single most-asked architecture question in AI interviews, and the one juniors get wrong most often (usually: "I'd fine-tune it"). All four *look* like they solve the same problem — "the model needs to know my stuff" — but they differ enormously in cost, update speed, and what they're actually good at. Picking wrong means either a hallucinating bot (prompt, no data), a stale model (fine-tune on data that changed), or a bill that scales with every request (long-context). Getting this right is the clearest signal you can architect, not just code.

## The mechanism: four ways to inject knowledge

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📝 Prompt<span class="sub">put the knowledge in the instruction</span></span>
    <span class="dbox orange">📜 Long-context<span class="sub">paste the whole document every call</span></span>
    <span class="dbox blue">📚 RAG<span class="sub">retrieve just the relevant bit, per query</span></span>
    <span class="dbox purple">🎓 Fine-tune<span class="sub">bake behavior into the weights</span></span>
  </div>
  <div class="dcap">From "in the prompt" to "in the weights" — four places knowledge can live.</div>
</div>

- **Prompt** — for a *small, static* fact ("our company is called X, tone is formal"), just write it in the system prompt. Zero infrastructure. Breaks down when the knowledge is large or changes often.
- **Long-context** — modern models take 200k–1M+ tokens, so you *can* paste a whole handbook into every request. Simple, no retrieval to build. But you **pay for every token on every call**, latency rises with input length, and quality degrades ("lost in the middle" — models attend least to the center of a huge context). Great for a *single medium doc per session*; terrible for a 10,000-doc corpus.
- **RAG** — retrieve only the 3–5 relevant chunks per query and inject those. Scales to millions of docs, **updates instantly** (change a doc, re-embed it, done), and gives citations. Costs an ingestion pipeline + vector DB to build and maintain. The default for *large or changing* knowledge.
- **Fine-tune** — adjust the weights so a *behavior, format, or style* is built in. Best when you need consistent output shape, a domain tone, or lower per-call cost/latency at high volume. **Does not reliably add new facts**, and every data change means retraining.

The decision table:

| Approach | Best when | Update speed | Cost shape | Adds facts? |
|---|---|---|---|---|
| **Prompt** | tiny, static knowledge | instant (edit text) | ~free | a little |
| **Long-context** | one medium doc per session | instant | **per-token, every call** | yes (while pasted) |
| **RAG** | large / changing corpus, need citations | **instant (re-embed)** | pipeline + cheap per-call | yes |
| **Fine-tune** | fixed style/format/skill, high volume | slow (retrain) | training up-front, cheap per-call | **no (unreliable)** |

**The mental split:** RAG and long-context add *knowledge*; fine-tuning adds *behavior*. They're not competitors — production systems often **fine-tune for style + RAG for facts** at the same time.

## Worked cost example: RAG vs long-context

A 300-page policy handbook (~150k tokens), 100k queries/month.

- **Long-context:** paste all 150k tokens every call. At ~$3/1M input tokens = **$0.45/query × 100k = $45,000/month**. Plus every call is slow.
- **RAG:** retrieve ~2k relevant tokens/query = $0.006/query × 100k = **$600/month** + a one-time vector DB. And it updates when the handbook changes without re-pasting.

Same knowledge, ~75× cheaper. This is the number that ends the "just use long-context" argument at scale — though for a *one-off* analysis of a single contract, long-context's zero-setup wins.

## How a company uses this

> **A Dubai real-estate portal** wanted an assistant over 40,000 constantly-changing listings *and* a fixed, formal Gulf-Arabic response style. They split it cleanly: **RAG** over the listings (prices change hourly — retrain-based fine-tuning would be perpetually stale; long-context can't fit 40k listings) for the *facts*, and a **LoRA fine-tune** on 3,000 past agent replies for the *tone*. A bare prompt handled the tiny static bits (company name, disclaimer). Four rungs, each doing the one job it's best at — and critically, listings update in real time because facts live in RAG, not weights.

## Common mistakes
- **Fine-tuning to inject facts.** The #1 error. The model won't reliably recall them and goes stale. Facts → RAG.
- **Long-context at corpus scale.** Pasting everything "because the window is huge" — you pay per token, per call, forever, and quality drops in the middle.
- **RAG for a single small doc.** Building a vector DB to answer questions about *one* 5-page PDF is over-engineering — just paste it (long-context/prompt).
- **Thinking it's either/or.** Fine-tune (behavior) + RAG (facts) together is standard, not exotic.

## Interview tip
Say: *"First I separate knowledge from behavior. For knowledge: static and tiny → prompt; one medium doc per session → long-context; large or changing corpus → RAG, because it updates instantly and gives citations. For behavior — a fixed style or format at volume — fine-tune. And fine-tuning is the wrong tool for facts; that's RAG's job. Often I use both together."* Then reference [the ladder](prompt-few-shot-rag-tools-fine-tune-pretrain.md) to show you'd try the prompt first.
