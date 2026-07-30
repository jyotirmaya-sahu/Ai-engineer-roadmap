# LangChain agents

**What it is:** LangChain is the original batteries-included framework for building LLM apps — it gives you ready-made components (models, tools, memory, retrievers) and an agent loop, so you don't hand-write the [function-calling](function-calling.md) plumbing.

## Why it matters for an AI Engineer

LangChain is the most widely-known LLM framework, so it shows up constantly in job descriptions and existing codebases — you'll be *expected* to read and write it. Its value is **breadth**: hundreds of pre-built integrations (every model provider, vector DB, and common tool) and a standard interface so swapping GPT for Claude, or Pinecone for pgvector, is a one-line change. For prototypes and "wire these ten services together fast," nothing beats it. Its weakness — which you must also be able to articulate in an interview — is that its high-level agent abstractions can hide control you need in production, which is exactly why [LangGraph](langgraph-nodes-edges-state.md) exists.

## The mechanism — what LangChain actually gives you

Strip away the marketing and LangChain provides three things:

1. **Standard component interfaces.** A `ChatModel`, a `Tool`, a `Retriever`, a `VectorStore` — all with the same shape regardless of vendor. This is the real win: your code doesn't care if it's OpenAI or Anthropic underneath.
2. **The agent loop, pre-built.** You give an agent a model + a list of tools. It runs the loop for you: model requests a tool → LangChain executes it → feeds the result back → repeats until the model gives a final answer. You don't write the `while` loop or the message bookkeeping.
3. **Composition (LCEL).** A pipe syntax (`prompt | model | parser`) to chain steps into a reusable pipeline.

Under the hood the agent is doing *exactly* the function-calling round-trip from the tool-use tiles — LangChain just wraps it so you write less glue.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🧰 model + [tools] + prompt</span>
    <span class="darr">↓<span class="lbl">create_react_agent</span></span>
    <span class="dbox purple">🤖 LangChain agent loop</span>
    <span class="darr">↓ ↺<span class="lbl">tool→result→tool…</span></span>
    <span class="dbox orange">🔧 tools run, results fed back</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ final answer</span>
  </div>
  <div class="dcap">You supply model + tools; LangChain runs the tool-calling loop and message bookkeeping for you.</div>
</div>

## Concrete example (runnable, 2026-current)

```python
from langchain.agents import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def get_weather(city: str) -> str:
    """Current weather for a city."""
    return f"{city}: 41°C, sunny"       # real code hits an API

@tool
def convert_currency(amount: float, pair: str) -> str:
    """Convert an amount for a pair like 'AED/USD'."""
    return f"{amount} {pair} = {amount * 0.272:.2f}"

model = ChatOpenAI(model="gpt-5.4-mini")     # swap to ChatAnthropic in one line
agent = create_react_agent(model, tools=[get_weather, convert_currency])

result = agent.invoke({"messages": [
    {"role": "user", "content": "Weather in Dubai, and convert 500 AED to USD?"}]})
print(result["messages"][-1].content)
# Agent calls BOTH tools in the loop, then answers with weather + conversion.
```

Note: you defined tools with a decorator and got a full multi-tool agent in ~15 lines. That's the LangChain value — and note the modern agent constructor is built *on* LangGraph under the hood.

## How a company uses this — production lens

> **A Dubai marketing agency** prototyped a research assistant in LangChain in an afternoon — web-search tool + a retriever over past campaigns + a summarizer — precisely because the integrations already existed. It went to a client demo in two days. But at production scale they hit LangChain's classic wall: they needed a **hard step-cap** (an agent looped 15 times on an ambiguous query, costing ~$4 in one request), a **human-approval gate** before publishing, and the ability to **resume** a run after a crash. The high-level agent didn't expose those cleanly, so they migrated the *orchestration* to [LangGraph](langgraph-nodes-edges-state.md) while **keeping every LangChain component** (the tools, retriever, model wrappers). Common real-world pattern: prototype fast in LangChain, graduate the control-flow to LangGraph, reuse the components. Lesson learned: pin the version — LangChain's API churned across releases and an unpinned upgrade broke their build.

## Common mistakes

- **Treating it as magic.** The agent is just the tool-calling loop. When it misbehaves, debug the tools and schemas, not "LangChain."
- **No step/iteration cap.** High-level agents will loop; always bound iterations to control cost and runaway behavior.
- **Not pinning the version.** LangChain's API has moved fast; unpinned upgrades break things. Pin it.
- **Reaching for chains when one API call would do.** Don't add a framework for a single prompt; that's over-engineering.
- **Confusing LangChain with LangGraph.** LangChain = components + simple agents; LangGraph = explicit, controllable graphs for production.

## Interview tip
Say: *"LangChain's strength is breadth — standard interfaces and hundreds of integrations, so I can swap models or vector DBs in one line and prototype fast. Its high-level agents hide control I need in production — step caps, human approval, resume-after-crash — so I graduate orchestration to LangGraph while keeping LangChain's components."* Naming *both* the strength and the exact limit is the mature answer. Next: [LangGraph](langgraph-nodes-edges-state.md).
