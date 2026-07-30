# Architecting AI Solutions

**The one-line idea:** Architecting an AI system is picking the *cheapest, simplest* approach that meets the requirement — and being able to defend, out loud, why you didn't reach for the fancier one.

## Why we even need it

Every AI feature can be built ten different ways. You can answer a support question with a one-line prompt, or with RAG over your docs, or with a fine-tuned model, or with a five-agent swarm. They all "work" in a demo. But they don't cost the same, fail the same, or take the same time to ship:

- A prompt costs cents and ships this afternoon.
- RAG costs an ingestion pipeline, a vector DB, and a week.
- Fine-tuning costs a labelled dataset, a training run, and a re-run every time your data changes.
- A multi-agent system costs all of that *plus* an orchestration layer that hangs at 2am.

The junior instinct is to reach for the most powerful tool ("let's use agents!"). The senior instinct is the opposite: **start at the bottom and climb only when forced.** This node is the judgment layer that sits on top of everything else in the roadmap — it's what turns "I know how RAG works" into "I know *when* RAG is the wrong choice."

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📝 Prompt<span class="sub">cents · minutes</span></span>
    <span class="darr">↓<span class="lbl">not enough?</span></span>
    <span class="dbox blue">📚 RAG<span class="sub">$ · days</span></span>
    <span class="darr">↓<span class="lbl">still not enough?</span></span>
    <span class="dbox orange">🛠️ Tools / agents<span class="sub">$$ · weeks</span></span>
    <span class="darr">↓<span class="lbl">still not enough?</span></span>
    <span class="dbox purple">🎓 Fine-tune / pretrain<span class="sub">$$$ · months</span></span>
  </div>
  <div class="dcap">Cost and complexity climb fast. Stop at the first rung that meets the requirement.</div>
</div>

## Why it matters for an AI Engineer

This is the **#1 senior signal** in an interview. Anyone can follow a tutorial and wire up LangChain. What separates a senior AI Engineer from a bootcamp grad is the ability to say *"we could fine-tune here, but RAG is cheaper, updates instantly, and gives us citations — so I'd only fine-tune if we needed a specific output style or 40% latency headroom we can't get otherwise."* That single sentence — a clear "when to choose X over Y" with the trade-off named — is what gets you hired at a Dubai enterprise, because they're paying for judgment, not typing.

Every tile below is a **decision**, not a technology. You already learned the technologies elsewhere in the roadmap; here you learn to *choose between them* under real constraints of cost, latency, accuracy, and team time.

## The decisions you'll learn (and when to reach for each)

| Decision | The choice you're making | Reach for it when… |
|---|---|---|
| [The capability ladder](architecting-ai-solutions/prompt-few-shot-rag-tools-fine-tune-pretrain.md) | prompt → few-shot → RAG → tools → fine-tune → pretrain | always — it's the map for every other decision |
| [Climb only when the rung below fails](architecting-ai-solutions/climb-only-when-the-rung-below-fails.md) | *when* to move up a rung | you have evidence, not a hunch, that the cheap option fell short |
| [RAG vs fine-tune vs long-context vs prompt](architecting-ai-solutions/rag-vs-fine-tune-vs-long-context-vs-prompt.md) | how to inject knowledge into the model | the model needs facts it doesn't have — pick the delivery method |
| [When to add memory, and which type](architecting-ai-solutions/when-to-add-memory-and-which-type.md) | should the system remember, and how | conversations or agents need continuity across turns/sessions |
| [Single call vs workflow vs agent vs multi-agent](architecting-ai-solutions/single-call-vs-workflow-vs-agent-vs-multi-agent.md) | how much autonomy to give | the task has multiple steps — pick control vs flexibility |
| [Vector vs keyword vs SQL vs graph](architecting-ai-solutions/vector-vs-keyword-vs-sql-vs-graph.md) | how to store and fetch the data | you're retrieving — match the query shape to the store |
| [Which model tier per task](architecting-ai-solutions/which-model-tier-per-task.md) | frontier vs mid vs small model | every LLM call — right-size for the job |
| [Build vs buy](architecting-ai-solutions/build-vs-buy-managed-vs-self-hosted.md) | managed API vs self-hosted | you're choosing infrastructure — weigh control vs cost vs speed |
| [Sync vs streaming vs async vs batch](architecting-ai-solutions/sync-vs-streaming-vs-async-vs-batch.md) | the request/response shape | you're deciding how the user (or system) waits for the answer |
| [Structured output vs tool-calling vs text](architecting-ai-solutions/structured-output-vs-tool-calling-vs-text.md) | what the model returns | the output feeds code, a UI, or another system |

## Real world: how a company uses this

> **A Dubai logistics company** wanted a "smart assistant" for their operations team. The vendor pitched a six-agent system with fine-tuned models — AED 400k and four months. A senior AI Engineer redrew it: 80% of the questions were "where is shipment X?" (a SQL lookup wrapped in tool-calling) and "what's our policy on Y?" (RAG over 200 PDFs). No fine-tuning, no agent swarm — one router, one SQL tool, one RAG tool, a mid-tier model. Shipped in three weeks for a fraction of the cost, and *cheaper to run* because most queries never touched a frontier model. Same business outcome; the architecture decision was the entire value.

## Interview tip
When asked to design any AI system, **narrate the ladder out loud**: "First I'd try the cheapest thing that could work — here, probably a prompt with RAG. I'd only add agents if the task genuinely needs multi-step reasoning I can't script, and I'd only fine-tune if RAG couldn't hit the quality or latency bar. Let me justify each step against cost, latency, and how often the data changes." Interviewers aren't testing whether you *know* agents exist — they're testing whether you'll waste six months building one that wasn't needed.

---

*Below: deep-dive articles on each architectural decision.*
