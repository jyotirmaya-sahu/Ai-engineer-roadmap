# Agentic RAG

**The one-line idea:** put an LLM *agent* in charge of retrieval — instead of a fixed "retrieve once, answer once" pipeline, the model **decides** whether to retrieve, what to search for, when to search *again*, which tool or index to use, and whether its answer is good enough before returning it.

## Why it matters for an AI Engineer

Naive, Advanced, and Modular RAG all share one limit: the *control flow is fixed by you*. Agentic RAG hands that control to the LLM, which unlocks the questions those pipelines choke on — multi-hop reasoning ("compare our 2024 and 2025 travel policies"), questions needing several searches, and cases where one retrieval isn't enough. This is the 2026 frontier of RAG and increasingly what "AI Engineer" job posts mean by *building agents*. It's also the riskiest pattern — more autonomy means more failure modes, higher latency, and higher cost — so being able to explain *when it's worth it* is exactly what senior interviewers probe for.

## The mechanism / how it works

At the core is an **agent loop**: the LLM reasons, optionally calls a tool, sees the result, and reasons again — repeating until it decides it's done. Retrieval becomes just *one tool the agent can call* rather than a mandatory first step.

A typical loop:
1. **Reason** — the LLM reads the question and thinks: do I even need to retrieve? What should I search for?
2. **Act** — it calls a tool: `search_docs(query)`, `query_sql(...)`, `web_search(...)`.
3. **Observe** — it reads the returned chunks.
4. **Decide** — enough to answer? If not, reformulate and retrieve again (loop back to step 1). If the chunks look irrelevant, it can *reject* them and try a different query — this self-correction is the signature move (**Self-RAG / Corrective RAG**).
5. **Answer** — once satisfied, generate the grounded final answer.

The agent can also **decompose**: break "compare A and B" into two retrievals, then synthesize. And it can pick *which* index to hit, making it a superset of **Modular RAG**'s routing — except the decision is *reasoned live*, not rule-based.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ Question</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 Agent reasons<span class="sub">need to retrieve? what?</span></span>
    <span class="darr">↓<span class="lbl">act</span></span>
    <span class="dbox blue">🔍 Retrieve / tool call</span>
    <span class="darr">↓<span class="lbl">observe</span></span>
    <span class="dbox orange">chunks<span class="sub">enough? relevant?</span></span>
    <span class="darr">↓<span class="lbl">no → loop back</span></span>
    <span class="dbox green">✅ Grounded answer</span>
  </div>
  <div class="dcap">Retrieval is a tool the agent calls in a loop — it can search again, switch tools, or reject bad results.</div>
</div>

## Concrete example — RAG as a tool in an agent

```python
# pip install langgraph langchain-openai
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def search_policies(query: str) -> str:
    """Search internal HR/finance policy documents. Call multiple times if needed."""
    hits = store.similarity_search(query, k=4)
    return "\n\n".join(h.page_content for h in hits)

agent = create_react_agent(ChatOpenAI(model="gpt-5.4"), tools=[search_policies])

# The AGENT decides how many times to call search_policies and with what queries.
out = agent.invoke({"messages": [("user",
    "How did our travel per-diem for Dubai change between 2024 and 2025?")]})
print(out["messages"][-1].content)
```

For that comparison question the agent typically calls `search_policies` **twice** — once per year — then synthesizes. A naive pipeline would do one search and miss half the answer. Notice you never wrote the loop or the "search twice" logic; the agent reasoned it out.

## How a company uses this

A Dubai consulting firm's research assistant fields open-ended analyst questions like *"summarize our exposure to the UAE real-estate sector across all client reports."* No single retrieval answers that. Their agentic system decomposes it, searches several report indexes, notices thin coverage on one sub-topic and searches again with a broadened query, then synthesizes — mimicking how a human analyst works. The tradeoff is stark and worth memorizing: each query fires **3–8 LLM calls instead of 1**, so latency climbs from ~2s to ~8–15s and cost rises 5–10×. They run it only for high-value research questions and keep a plain Advanced-RAG path for simple lookups — routing cheap questions away from the expensive agent. That cost/latency discipline is the real production skill.

## Common mistakes / misconceptions

- **Using it for everything.** Agentic RAG on "what's the capital of France?"-tier queries burns money and time for no gain. Reserve it for multi-hop or open-ended questions; route the rest to Advanced RAG.
- **No loop cap.** An agent can retrieve forever. Always set a max-iterations limit and a fallback, or one bad query stalls (and bills) indefinitely.
- **Skipping observability.** With a variable number of tool calls, you *must* trace every step (LangSmith/Langfuse) or debugging is impossible — you can't see *why* it retrieved five times.
- **Confusing it with modular RAG.** Modular = *you* wrote the routing rules. Agentic = the *LLM decides* the path at run time. The autonomy is the whole distinction.

## Interview tip

Say: *"Agentic RAG makes retrieval a tool an LLM agent calls in a reason–act–observe loop — it decides whether to retrieve, reformulates and searches again if results are weak, and can self-correct before answering. It handles multi-hop questions a fixed pipeline can't, but each query costs several LLM calls, so I route only complex questions to it and keep cheaper RAG for the rest."* Naming the cost/latency tradeoff *and* the routing discipline shows you'd deploy it responsibly, not just because it's the shiny option.
