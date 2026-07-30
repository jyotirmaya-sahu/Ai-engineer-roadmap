# Anthropic Claude

**What it is:** A family of frontier, closed-weight models from Anthropic, known for strong reasoning, long context, careful instruction-following, and a safety-first design — a top default for quality-critical and agentic work.

## Why it matters for an AI Engineer

Claude is one of the two or three models you'll actually reach for in production, so you need to know its shape: what its tiers cost, where it's strong (long documents, coding, multi-step agents, honest "I don't know" behavior), and how its API works. Interviewers expect you to compare it concretely against GPT and Gemini rather than say "they're all the same." Its long context and tool-use reliability make it a common pick for RAG and agent systems — exactly the AI-Engineer workloads Dubai employers hire for.

## The mechanism / how it works

Claude ships in **tiers** so you right-size cost vs capability:

- **Haiku** — smallest, fastest, cheapest. For classification, routing, extraction, high-volume simple tasks.
- **Sonnet** — the balanced workhorse. Strong reasoning at moderate cost; the everyday default for RAG answers, coding, and most app logic.
- **Opus** — the most capable, most expensive. For the hardest reasoning, long agentic chains, and tricky coding.

Under the hood it's a transformer accessed only via API (closed-weight — see [Closed vs open](closed-vs-open.md)). Key traits that shape engineering decisions:

- **Long context (~200k tokens)** — fits large documents and long agent histories ([Context length](context-length.md)).
- **The Messages API** with clean `system` / `user` / `assistant` roles and first-class **tool use** (function calling), which is why it's popular for agents.
- **Extended thinking** — on request the model reasons at length before answering, trading latency and tokens for accuracy on hard problems.
- **Prompt caching** — you can cache a large, stable prefix (a long system prompt or document) so repeated calls skip re-processing it, cutting cost and latency dramatically at scale.

## Concrete example

```python
from anthropic import Anthropic
client = Anthropic()  # reads ANTHROPIC_API_KEY

resp = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=500,
    system="You are a precise financial analyst. Answer only from the context.",
    messages=[{"role": "user", "content": "Given Q3 revenue of AED 4.2M and Q2 of AED 3.5M, what's the growth %?"}],
)
print(resp.content[0].text)
print(resp.usage)  # input_tokens / output_tokens — how you get billed
```

The `system` field sets behavior; `resp.usage` gives the token counts you use for [cost estimation](cost-estimation.md). Swapping `model=` between Haiku/Sonnet/Opus is how you trade cost for capability with zero other code changes.

<div class="diagram">
  <div class="flow">
    <span class="dbox green">Haiku<span class="sub">cheap · fast · simple</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">Sonnet<span class="sub">balanced default</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">Opus<span class="sub">hardest reasoning</span></span>
  </div>
  <div class="dcap">One API, three tiers — change the model string to move along the cost/capability curve.</div>
</div>

## How a company uses this

A Dubai legal-tech startup runs contract review on Claude. They route: **Haiku** first-passes every clause to tag its type (cheap, ~200 tokens each), then only flagged risky clauses go to **Sonnet** for a full reasoned analysis. They wrap the firm's 30-page style guide in **prompt caching**, so it's processed once and reused across thousands of clause calls — cutting input cost on that prefix by ~90% and shaving seconds off latency. At ~50k clauses/day this tiering plus caching turned an unaffordable "everything through the top model" design into a viable product. This is [model tiering](model-tiering-by-task.md) and caching working together.

## Common mistakes
- **Defaulting to Opus for everything** — Sonnet handles most work at a fraction of the cost; reserve Opus for genuinely hard tasks.
- **Ignoring prompt caching** on stable long prefixes — you leave large, easy savings on the table.
- **Not reading `usage`** — if you don't track tokens per call you can't estimate or control spend.
- **Assuming it's identical to GPT** — Claude tends to follow long, structured instructions and admit uncertainty more readily; test on *your* task rather than assuming parity.

## Interview tip
Say: *"Claude is my go-to for quality-critical and agentic work — strong reasoning, ~200k context, reliable tool use, and prompt caching for cheap repeated prefixes. I use its three tiers to right-size: Haiku for high-volume simple tasks, Sonnet as the default, Opus only for the hardest reasoning. I'd benchmark it head-to-head with GPT and Gemini on the actual task rather than pick by reputation."*
