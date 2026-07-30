# Tool-result trimming

**What it is:** Shrinking a tool's output *before* it gets appended to the agent's context — stripping the noise so only the useful part costs tokens on every future step.

## Why it matters for an AI Engineer

Tool results are the single biggest driver of [context growth](context-window-overflow-on-long-runs.md). A web fetch, a SQL dump, an API response, a stack trace — these routinely return tens of thousands of tokens of mostly-junk. And because history is re-sent every step, a fat tool result you appended on step 3 is *re-billed on steps 4, 5, 6…* Trimming is the cheapest, highest-leverage cost control you can add: often a one-hour change that cuts an agent's bill by half.

## The mechanism — trim at the boundary

The rule: **the model should never see more of a tool result than it needs to act.** You intercept every tool result before it enters context and reduce it. Common trimming tactics, roughly in order of preference:

1. **Ask the tool for less.** Best of all — add `limit`, `fields`, or pagination to the tool call itself so the junk is never generated. `SELECT name, price` beats `SELECT *`.
2. **Structured extraction.** For HTML/JSON, parse out the fields you care about and drop the rest. A 40 KB product page → a 200-token `{title, price, availability}`.
3. **Truncation with a marker.** Cap raw output at N tokens/chars and append `…[truncated, 38KB omitted]` so the model knows more exists.
4. **Head + tail.** For logs, keep the first and last ~50 lines (the start and the error are what matter); drop the middle.
5. **Summarize on the way in.** For genuinely useful long text, run a cheap model to condense it before it enters the main agent's context.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🔧 tool returns<span class="sub">40KB HTML</span></span>
    <span class="darr">→<span class="lbl">trim</span></span>
    <span class="dbox purple">✂️ extract / cap / summarize</span>
    <span class="darr">→</span>
    <span class="dbox green">📄 500 bytes into context</span>
  </div>
  <div class="dcap">Trim at the boundary: the model only ever sees the useful slice, and only that slice gets re-billed every step.</div>
</div>

## Concrete example — a trimming wrapper

```python
import json

MAX_CHARS = 4000   # ~1K tokens

def trim(name, result: str) -> str:
    if name == "fetch_page":                 # HTML → extracted fields
        data = extract_fields(result)        # your parser
        return json.dumps(data)              # tiny structured result
    if name == "run_sql":                    # cap row dumps
        rows = result.splitlines()
        if len(rows) > 50:
            return "\n".join(rows[:50]) + f"\n…[{len(rows)-50} more rows omitted]"
    if len(result) > MAX_CHARS:              # generic head+tail for logs
        head, tail = result[:MAX_CHARS//2], result[-MAX_CHARS//2:]
        return f"{head}\n…[{len(result)-MAX_CHARS} chars omitted]…\n{tail}"
    return result

# in the agent loop:
raw = call_tool(name, args)
history.append({"role": "tool", "content": trim(name, raw)})   # trimmed, not raw
```

The critical detail: **always leave a breadcrumb** (`…omitted…`) so the model can decide to re-query for detail rather than assuming it saw everything.

## Worked numbers

An agent calls `fetch_page` 6 times, each returning ~10 K tokens of HTML. Untrimmed, that's 60 K tokens sitting in context, re-sent on every remaining step. Over the next 10 steps that's **~600 K re-billed input tokens ≈ $1.80** (Sonnet input pricing) *just for HTML boilerplate*. Trim each fetch to 500 tokens: 3 K in context, ~30 K re-billed ≈ **$0.09**. Same task, **20× cheaper** on that dimension — from one wrapper function.

## How a company uses this

A Dubai e-commerce team's price-monitoring agent fetched competitor product pages. Raw pages averaged 45 KB; the agent only needed price and stock status. Untrimmed, monitoring 200 products cost ~$14/run and occasionally overflowed. They added a `fetch_page` post-processor that runs a CSS-selector extraction to `{price, in_stock, currency}` — **~150 tokens per page**. Cost dropped to **~$0.40/run**, overflow disappeared, and accuracy *improved* because the model was no longer distracted by nav menus and cookie banners. This is the pattern: trimming usually helps quality *and* cost at once.

## Common mistakes
- **Trimming so hard the answer is gone** — dropping the exact field the agent needed. Extract deliberately, don't blind-truncate important tools.
- **No truncation marker** — the model then hallucinates about the omitted part or assumes the data ends there.
- **Trimming after it's already in context** — you must trim *before* appending, or you've already paid to store it.
- **Ignoring the re-send multiplier** — teams see "10 K tokens, no big deal" and forget it's re-billed every subsequent step.

## Interview tip
Say: *"Tool results are the biggest source of context bloat, and they get re-billed every step because history is re-sent. So I trim at the boundary — prefer asking the tool for fewer fields, then structured extraction, then head+tail truncation with an 'omitted' marker so the model can re-query. A single trimming wrapper often cuts an agent's token bill by 10–20× and improves quality by removing noise."* The re-send-multiplier point is what separates a real answer from a textbook one.
