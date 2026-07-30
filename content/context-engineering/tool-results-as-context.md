# Tool Results as Context

**The one-line idea:** when a model calls a tool (an API, a database query, a calculator), the tool's output is fed *back into the context window* as a new message — and how you format, trim, and place that output is a context-engineering decision, not a free lunch.

## Why it matters for an AI Engineer

Tool use (a.k.a. function calling) is what turns a chatbot into an agent: the model asks for a weather lookup, a SQL query, a web search, and then reasons over what comes back. But every tool result is *more tokens in the window*. A single "search the docs" call can return 8,000 tokens of JSON; a database query can return 500 rows. In a multi-step agent, tool outputs are usually the *largest and fastest-growing* part of the context — they're what actually blows your budget on step 20. Treating raw tool output as something you can just dump back in is the number-one reason agents get slow, expensive, and confused. Handling tool results *as context you engineer* is exactly what separates a toy agent from a production one.

## The mechanism / how it works

Function calling is a structured loop the model and your code share:

1. You send the model the user message **plus tool schemas** (name, description, parameters).
2. The model, instead of answering, emits a **tool call**: `{name: "get_orders", arguments: {"user":"123"}}`.
3. **Your code runs the tool** and gets a result — this is where you, the engineer, decide what happens next.
4. You append the result as a **`tool`-role message** referencing the call's ID, and send the whole thing back.
5. The model reads the result *from its context* and either calls another tool or answers.

The critical, easy-to-miss point is step 3→4: **the tool result is not magic state, it's just text you append.** So you control it. A raw 500-row SQL dump can be filtered to the 5 relevant rows; a giant API JSON can be reduced to the 3 fields the model needs; a 20-page scraped page can be [summarized](summarization-pruning.md) before it enters the window. And you often **prune old tool results** on later steps — once the model has used a search result, the raw text can be dropped or condensed, keeping only the conclusion.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👤 user + 🔧 tool schemas</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🤖 emits tool call</span>
    <span class="darr">↓<span class="lbl">your code runs it</span></span>
    <span class="dbox orange">📦 raw result (maybe huge)</span>
    <span class="darr">↓<span class="lbl">FILTER / SHRINK — the engineering step</span></span>
    <span class="dbox blue">📋 trimmed tool message → back into window</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ model reasons over it</span>
  </div>
  <div class="dcap">The tool result re-enters the context as a message — shrink it before it does.</div>
</div>

## Concrete example

```python
# Shrink a tool result BEFORE it re-enters context.
def run_tool(call):
    if call.name == "search_orders":
        rows = db.query(...)                      # could be 500 rows
        top = rows[:5]                            # keep only what's useful
        return {"count": len(rows),              # summarize the rest, don't dump it
                "top_orders": [r.brief() for r in top]}

# in the agent loop:
tool_msg = {"role": "tool", "tool_call_id": call.id,
            "content": json.dumps(run_tool(call))}   # trimmed, not raw
messages.append(tool_msg)
resp = client.chat.completions.create(model="gpt-4.1", messages=messages, tools=TOOLS)
```

The discipline is entirely in `run_tool`: it returns a *curated* result, not the raw dump.

## How a company uses this

A Dubai logistics agent answers "where are my late shipments?" by calling a tracking API that returns 200 shipments of verbose JSON — easily 15K tokens. Feeding that raw would spike cost and latency and bury the answer. Their tool wrapper filters to `status = late`, keeps 6 fields per shipment, and returns a compact table (~800 tokens). Across a 12-step agent run this keeps total context under ~10K instead of 100K+, cutting per-run cost by ~90% and holding p95 latency in single-digit seconds. They also **evict** stale tool results: once a tracking result has been acted on, later steps carry only "checked shipments at 14:02, 6 were late," not the original payload.

## Common mistakes / misconceptions

- **Dumping raw tool output.** The single biggest agent-cost mistake. Curate in the tool wrapper.
- **Never evicting old results.** Every past tool result sitting in context is re-billed on every subsequent step. Prune what's been used.
- **Losing the tool_call_id link.** The result message must reference the call it answers, or the API errors or misattributes it.
- **Letting untrusted tool output act as instructions.** A web-search result containing "ignore your rules" is untrusted text — keep it clearly framed as data, and combine with [context isolation](context-isolation.md).

## Interview tip

Say: *"Tool results are just more context I append, so I engineer them — I filter and summarize the output in the tool wrapper before it re-enters the window, and I evict stale results on later agent steps. In multi-step agents, tool output is usually the biggest token sink, so this is where I control cost and latency."* Naming tool output as the dominant token cost in agents, and pruning it, signals you've actually shipped an agent.
