# v5 · Structured Output

**What you'll build:** the final API-phase upgrade. When HelpDesk **can't answer** a question (needs a human — an order lookup, a refund), it stops replying in prose and instead emits a **structured JSON ticket** — validated and ready for another system to ingest. This is where your chat app starts talking to *other software*, not just humans.

## Why this version

Real assistants sit inside a business. A prose "sorry, I'll raise a ticket" is useless to a ticketing system — it needs `{category, urgency, summary, order_id}`. This version makes **JSON mode** and **schema validation** real, and teaches the crucial split between *talking to a user* (free text) and *talking to a system* (strict structure). It's also the bridge to tools/agents later, where structured output *is* the interface.

## The idea — two modes of reply

<div class="diagram">
  <div class="flow v">
    <div class="flow"><span class="dbox gray">user question</span><span class="darr">→</span><span class="dbox purple">HelpDesk decides</span></div>
    <div class="flow"><span class="dbox green">can answer<span class="sub">→ normal streamed prose</span></span><span class="dbox orange">can't answer<span class="sub">→ structured JSON ticket</span></span></div>
  </div>
  <div class="dcap">Same assistant, two output shapes: prose for the human, JSON for the ticketing system.</div>
</div>

The simplest reliable design: a **separate endpoint** `/ticket` that takes the conversation and asks the model — in **JSON mode** — to produce a ticket. Keep chat (v1–v4) as-is; add ticket creation as a new, structured path. (Merging both into one auto-deciding call is a nice stretch goal.)

## Define the schema first

The ticket shape is the contract with the downstream system.

```python
# schema.py
from pydantic import BaseModel
from typing import Literal

class Ticket(BaseModel):
    category: Literal["order", "refund", "technical", "account", "other"]
    urgency: Literal["low", "medium", "high"]
    summary: str
    order_id: str | None      # null if not mentioned
```

## The ticket endpoint

```python
# app.py (add to your v4 app)
import json
from fastapi import HTTPException
from pydantic import ValidationError
from schema import Ticket

TICKET_SYSTEM = (
    "From the support conversation, produce a ticket as JSON with keys: "
    "category (order|refund|technical|account|other), urgency (low|medium|high), "
    "summary (one sentence), order_id (or null if not mentioned). "
    "Base it only on the conversation. Do not invent an order_id."
)

@app.post("/ticket")
def make_ticket():
    resp = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=history + [{"role": "user", "content": TICKET_SYSTEM}],
        response_format={"type": "json_object"},   # JSON mode: guarantees valid JSON
    )
    raw = resp.choices[0].message.content
    try:
        ticket = Ticket(**json.loads(raw))          # validate the SHAPE
    except (ValidationError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"Bad ticket: {e}")
    return ticket
```

Contract for the UI (hand to your AI tool): `POST http://localhost:8000/ticket`, no body, returns the `Ticket` JSON. Prompt: *"add a 'Raise ticket' button that POSTs to /ticket and shows the returned JSON."* After a conversation the bot couldn't resolve, one click produces a clean, typed ticket.

## The two-layer guarantee (say this in your README)

- **JSON mode** (`response_format`) guarantees the output is **syntactically valid JSON** — no "Here's your ticket:" preamble, no trailing prose.
- **Pydantic** guarantees it's the **right JSON** — correct fields, allowed `category`/`urgency` values, right types. Reject and 422 otherwise.

You need *both*. JSON mode alone can still give you valid JSON with wrong fields.

## Make it real — required for this version

- **A working ticket path** — after an unresolved chat, "Raise ticket" returns validated JSON.
- **Validation that actually rejects bad output** — test by loosening the prompt and watching Pydantic catch a bad `category`.
- **No invented data** — confirm `order_id` is `null` when the user never gave one.
- **Commit and `git tag v5`.** README: "v5 — structured JSON tickets (JSON mode + schema validation)."

## You've completed the API phase — look at what you built

One repo, five tagged versions: a support assistant that answers, remembers, streams with a persona, tracks and controls cost, and emits structured tickets. That's a genuine portfolio project. And it's *not finished* — it's the spine you'll keep growing:
- **RAG phase:** HelpDesk answers from NoonBazaar's real help docs instead of guessing.
- **Agents phase:** it *acts* — looks up an order, issues a refund via tools (your `Ticket` schema is a preview of tool-calling).
- **Production / multi-user phase:** Supabase Auth + per-user history in Postgres + Redis session cache.
- **Deployment phase:** it goes live.

## The big picture — where this is heading (just a preview)

> **Don't worry about the details here.** This is a *map of the destination*, not a lesson. Several boxes (RAG, agents, vector DB) are things you **haven't learned yet** — that's fine. The point is only to see that everything you build plugs into one growing system. Each later phase teaches one box, then you add it. Skim this, then move on.

**What's real today (v1–v5)** is the simple middle path:

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🖥️ Next.js UI</span>
    <span class="darr">→</span>
    <span class="dbox purple">⚙️ FastAPI<span class="sub">/ask · /ticket</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🧠 OpenAI</span>
    <span class="darr">→<span class="lbl">stream back</span></span>
    <span class="dbox green">✅ reply</span>
  </div>
  <div class="dcap">Today's app — the whole thing you've built so far. Everything below just adds boxes around this core.</div>
</div>

**The full target** — the same core, wrapped by what each future phase adds (each row is one phase you'll learn later):

<div class="diagram">
  <div class="flow v">
    <div class="flow"><span class="dbox gray">🖥️ Next.js UI</span><span class="darr">→</span><span class="dbox blue">🔑 Auth<span class="sub">Part B · v6</span></span><span class="darr">→</span><span class="dbox purple">⚙️ FastAPI core<span class="sub">v1–v5 ✓</span></span><span class="darr">→</span><span class="dbox orange">🧠 OpenAI</span></div>
    <div class="flow"><span class="dbox blue">🗄️ Postgres + ⚡ Redis<span class="sub">history · Part B · v6–v7</span></span><span class="darr">·</span><span class="dbox orange">🔍 RAG + 🧮 Vector DB<span class="sub">later phase</span></span><span class="darr">·</span><span class="dbox green">🤖 Agents + 🛠️ Tools<span class="sub">later phase</span></span></div>
  </div>
  <div class="dcap">✓ = built. Part B (next, in this node) adds auth + storage. RAG and Agents are separate phases much later — ignore their internals for now.</div>
</div>

**When you'll build each piece:**
- **Part B (right after v5, in this node):** Auth + Postgres + Redis — the boxes you *are* about to learn.
- **RAG phase (later):** the Vector DB + retrieval box — answering from real documents.
- **Agents phase (later):** the tools box — taking actions.

So: everything you don't recognise yet is a *future lesson*, not something you're expected to know now.

## Common mistakes

- **Parsing prose as JSON** without JSON mode — brittle; breaks on any stray text.
- **Trusting `json.loads` alone** — valid JSON can have wrong fields; validate with Pydantic.
- **Letting the model invent an `order_id`** — instruct "do not invent," use `null`.
- **No error path** — return a clean 422, not a 500, on bad extraction.

## Interview tip

*"v5 added structured output — a ticket endpoint using JSON mode so the output is always valid JSON, plus Pydantic validation so it's always the *right* JSON, returning 422 on failure. It's the point where the assistant starts talking to other systems, not just users — which is the same structured-output idea that underpins tool-calling and agents."* That framing ties the whole API phase to what comes next.

*Next — Part B: make it a real product. v6 adds Supabase Auth + per-user history, killing the global variable so thousands of users each get their own private, durable chat.*
