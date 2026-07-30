# OpenAI GPT

**What it is:** OpenAI's family of frontier, closed-weight models — the GPT series plus the reasoning-focused "o-series" — with the broadest tooling ecosystem and, for many teams, the default first stop.

## Why it matters for an AI Engineer

GPT is the model most tutorials, libraries, and job postings assume you know. Its SDK, function calling, structured outputs, and assistant/agent tooling are mature and widely copied, so fluency here transfers everywhere. Interviewers expect you to know its tiers and the split between fast "chat" models and slower "reasoning" models, and to compare it against Claude and Gemini on real tradeoffs. It's often the fastest way to prototype and validate an idea before you optimize cost.

## The mechanism / how it works

OpenAI splits its lineup into two philosophies you must not confuse:

- **GPT chat models** (e.g. the GPT-4-class and smaller "mini" variants) — general-purpose, fast, tunable. The everyday workhorse for chat, RAG, extraction, and tool use. Comes in a full-size tier and cheaper *mini/nano* tiers for high-volume simple work.
- **o-series reasoning models** — trained to "think" with long internal chains before answering. They spend extra hidden **reasoning tokens** (which you pay for) to solve hard math, logic, and coding problems the chat models miss. Slower and pricier per task, so you reach for them only when the task genuinely needs deep reasoning.

All are closed-weight, accessed via API. Practical features you'll use:

- **Structured outputs / JSON mode** — force replies to match a JSON schema exactly, so downstream code can parse them reliably.
- **Function/tool calling** — the model emits a structured call to your function; the backbone of agents.
- **Multimodal input** — vision and audio on the main models.
- **Batch API** — submit large jobs at ~50% discount for non-urgent work.

<div class="diagram">
  <div class="flow">
    <span class="dbox green">GPT-mini<span class="sub">cheap · fast · volume</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">GPT (full)<span class="sub">general default</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">o-series<span class="sub">deep reasoning · pricey</span></span>
  </div>
  <div class="dcap">Two families: fast chat models for most work, o-series reasoning models only when the task needs real thinking.</div>
</div>

## Concrete example — structured output

```python
from openai import OpenAI
client = OpenAI()  # OPENAI_API_KEY

resp = client.chat.completions.create(
    model="gpt-4.1-mini",
    response_format={"type": "json_object"},
    messages=[
        {"role": "system", "content": "Return JSON with keys vendor and total_aed."},
        {"role": "user", "content": "Invoice from Al Futtaim, total AED 4,200."},
    ],
)
print(resp.choices[0].message.content)   # {"vendor": "Al Futtaim", "total_aed": 4200}
print(resp.usage)                        # tokens for cost tracking
```

Note the roles and `usage` object mirror the pattern across all providers — learn one API and the rest feel familiar. See [Working with LLM APIs](../working-with-llm-apis.md).

## How a company uses this

A Dubai proptech prototyped a listings assistant on **GPT-mini** in a week because the ecosystem let them wire function calling and JSON output fast. In production, 90% of queries (search, filtering, summaries) stayed on the cheap mini model; only the rare "compare these five mortgage offers and rank them" query escalated to an **o-series** reasoning model. They moved nightly bulk enrichment of new listings onto the **Batch API** for a ~50% cost cut since it wasn't time-sensitive. The engineering lesson: GPT's tiering plus batch turned a fast prototype into an affordable product without switching providers.

## Common mistakes
- **Using o-series for everything** — you pay for hidden reasoning tokens on tasks a fast chat model solves instantly. Reserve reasoning models for genuinely hard problems.
- **Skipping structured outputs** and then regex-parsing free text — brittle; use JSON schema enforcement.
- **Ignoring the Batch API** for offline jobs — leaving a ~50% discount unused.
- **Assuming GPT is strictly best** — on long-context or specific reasoning tasks Claude or Gemini may win; benchmark on your data.

## Interview tip
Say: *"GPT is my fast-prototyping default because the tooling — structured outputs, function calling, batch — is mature. I separate the fast chat tiers from the o-series reasoning models: mini for high-volume simple work, full GPT as a general default, and o-series only when a task needs deep reasoning, since those burn extra reasoning tokens. For real selection I benchmark it against Claude and Gemini on the actual task rather than assume it's best everywhere."*
