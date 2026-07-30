# MCP Tools Inside LangGraph Agents

**The one-line idea:** an MCP adapter discovers remote tools and converts them into LangChain-compatible tools; LangGraph controls when they run, state transitions, retries, approvals, and persistence.

## Why it matters

MCP standardizes how tools are exposed. LangGraph orchestrates reliable workflows. Combining them avoids writing a custom integration for every service while retaining explicit graph control around sensitive actions.

## Integration flow

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">MCP servers<span class="sub">tools + schemas</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">MCP adapter</span>
    <span class="darr">→</span>
    <span class="dbox green">LangGraph ToolNode<span class="sub">state · policy · tracing</span></span>
  </div>
</div>

The official LangChain MCP adapter exposes `MultiServerMCPClient`. Load tools, bind them to the model, and place them in a `ToolNode`:

```python
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langgraph.graph import MessagesState, StateGraph, START
from langgraph.prebuilt import ToolNode, tools_condition

client = MultiServerMCPClient({
    "crm": {
        "transport": "http",
        "url": "https://crm.example.com/mcp",
    },
    "local_math": {
        "transport": "stdio",
        "command": "python",
        "args": ["math_server.py"],
    },
})

tools = await client.get_tools()
model = ChatOpenAI(model="gpt-5-mini").bind_tools(tools)

async def call_model(state: MessagesState):
    return {"messages": [await model.ainvoke(state["messages"])]}

builder = StateGraph(MessagesState)
builder.add_node("model", call_model)
builder.add_node("tools", ToolNode(tools, handle_tool_errors=True))
builder.add_edge(START, "model")
builder.add_conditional_edges("model", tools_condition)
builder.add_edge("tools", "model")
graph = builder.compile()
```

Tool discovery does not remove security responsibilities. Filter tools by user role, inject user-specific credentials through controlled runtime context or interceptors, validate arguments, and require approval before high-impact operations. Prefix tool names when multiple servers may expose collisions. Use explicit sessions only for legacy or genuinely stateful servers; stateless invocation is the safer default.

## How a company uses this

A case-management graph loads read-only search tools for all staff, but exposes “update case” only to authorized roles. A graph interrupt asks for approval before mutation. Traces connect the model decision, MCP tool call, service response, and resulting state update.

## Common mistakes

- Loading every discovered tool for every user.
- Passing permanent credentials in model-visible arguments.
- Assuming `handle_tool_errors=True` is a complete retry policy.
- Ignoring tool-name collisions.
- Letting a tool mutate state without idempotency or approval.

## Interview tip

Say: *“MCP supplies portable tool schemas; the adapter turns them into LangChain tools; LangGraph supplies controlled execution. I filter by authorization, inject identity outside model-visible text, use ToolNode plus explicit routing, and put approvals and idempotency around side effects.”*

