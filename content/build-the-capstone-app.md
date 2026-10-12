# Build: The Capstone App — Phase 1

**The one-line idea:** instead of throwaway demos, you build **one real app** and grow it feature-by-feature — from a basic call to a deployed, multi-user product. Phase 2 then extends the *same* app with the advanced API capabilities you learn next.

## Why we even need this — and why ONE app, not many

Separate mini-projects teach each concept in isolation, but real work is never isolated: features pile onto a living codebase, and each new one has to coexist with the last. Growing a single app mirrors that exactly. You *feel* why memory matters the moment you add a follow-up question. You *feel* why token counting matters when your growing history starts costing real money. Each tile is a new version of the same repo — so you experience how learnings **stack into a real system**, not as trivia but as features a user can touch.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">v1<span class="sub">basic call</span></span>
    <span class="darr">+</span>
    <span class="dbox blue">v2<span class="sub">memory</span></span>
    <span class="darr">+</span>
    <span class="dbox purple">v3<span class="sub">streaming</span></span>
    <span class="darr">+</span>
    <span class="dbox orange">v4<span class="sub">cost</span></span>
    <span class="darr">+</span>
    <span class="dbox green">v5<span class="sub">structured</span></span>
    <span class="darr">→</span>
    <span class="dbox yellow">RAG · agents<span class="sub">later phases</span></span>
  </div>
  <div class="dcap">One repo, growing. Each tile adds a feature on top of the last — exactly how real products evolve.</div>
</div>

## The stack — production-shaped on purpose

You'll build this the way real products are built:

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🖥️ Next.js + TypeScript<span class="sub">UI · port 3000</span></span>
    <span class="darr">→<span class="lbl">fetch / stream (CORS)</span></span>
    <span class="dbox purple">⚙️ FastAPI<span class="sub">backend · port 8000</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🧠 OpenAI</span>
  </div>
  <div class="dcap">A TypeScript frontend talking to a Python API talking to the model — the standard production split.</div>
</div>

- **Backend — FastAPI (Python).** This is *your* code, hand-written, the focus of every tile. All LLM logic, state, streaming, cost, and structure live here.
- **Frontend — Next.js + TypeScript.** A thin client that calls your API and renders the result.

### Generate the UI with AI — own the backend

You're backend-focused, so **generate the Next.js UI with Claude Code (or similar)** instead of hand-writing React. That's not cutting corners — it's how real teams work, and it keeps your hours on the part that matters. The rule: **you must be able to read and tweak the generated UI.** Own these three seams where UI meets backend, because they're where things break:

1. **The fetch/stream call** — how the browser reads your `StreamingResponse` (the tricky part).
2. **CORS** — Next.js (`:3000`) → FastAPI (`:8000`) is cross-origin; you enable it on the backend (shown in v1).
3. **The request/response shapes** — you define the contract; the UI just conforms.

**Workflow each version:** write the FastAPI endpoint → document its contract (method, path, request JSON, response shape) → paste that to your AI tool: *"build a Next.js/TypeScript page that calls this contract"* → review the fetch/stream logic. Each tile below gives you the **backend in full** and the **contract** to hand off; the UI is generated.

## The app we're building: a Support Assistant

You'll build **"HelpDesk"** — a customer-support assistant for a fictional Dubai company (say, an e-commerce store). It's a perfect spine because it grows naturally through the *entire* roadmap:

- **This phase (API basics):** a chat assistant that answers, remembers, streams, tracks cost, and can output a structured ticket.
- **RAG phase:** it answers from the company's actual help docs instead of guessing.
- **Agents phase:** it can *act* — check an order status, issue a refund via tools.
- **Production / multi-user phase:** it becomes a **real product** — **Supabase Auth** for user accounts, and each user's chat history stored **per-user** in **Supabase Postgres** (durable) with **Redis** for hot session state, instead of one shared variable.
- **Deployment phase:** it goes live on the internet.

Same app, every phase. You're not restarting — you're shipping updates.

> **Deliberate shortcut (and its upgrade path):** in the API-basics tiles, conversation history is a **single global variable** — fine for one user learning the concepts, wrong for a real app where thousands of users each have their own chat. We keep it simple *on purpose* so you learn one idea at a time. The production refactor uses **your existing stack**: gate the API behind **Supabase Auth** (verify the JWT on each request, extract the user id), store each user's messages in a **Supabase Postgres** table (`messages` keyed by `user_id` + `conversation_id`) so history is durable and isolated, and optionally cache the active conversation in **Redis** for speed. `history` stops being a global and becomes "load this user's conversation from the DB." Each API-basics tile marks the exact line with a `ponytail:` note.

## The milestones (each tile = one version)

**Part A — grow the features** (this API phase):

| Version | You add | Concept it makes real |
|---|---|---|
| **[v1 · Basic Q&A call](build-the-capstone-app/v1-basic-q-a-call.md)** | a web page that sends one question, shows one answer | SDK setup & call pattern, reading the response |
| **[v2 · Conversation memory](build-the-capstone-app/v2-conversation-memory.md)** | multi-turn — it remembers the whole chat | messages & roles, statelessness |
| **[v3 · Streaming + persona](build-the-capstone-app/v3-streaming-persona.md)** | replies type out live; a system-prompt personality | streaming, system/user/assistant |
| **[v4 · Token & cost tracking](build-the-capstone-app/v4-token-cost-tracking.md)** | shows tokens + cost per reply; trims old history | usage & token counting, context window |
| **[v5 · Structured output](build-the-capstone-app/v5-structured-output.md)** | when it can't help, it emits a structured JSON ticket | JSON mode, schema validation |

**Part B — make it a real, multi-user, deployed product** (uses your Supabase + Redis):

| Version | You add | Concept it makes real |
|---|---|---|
| **[v6 · Auth & per-user history](build-the-capstone-app/v6-auth-per-user-history.md)** | Supabase Auth + per-user history in Postgres (RLS) | authentication, per-user durable storage |
| **[v7 · Redis & concurrency](build-the-capstone-app/v7-redis-concurrency.md)** | Redis cache-aside + per-user locking | caching pattern, concurrency safety |
| **[v8 · Deploy to production](build-the-capstone-app/v8-deploy-to-production.md)** | live on the internet: Vercel + container + managed data | containers, secrets, prod CORS, health/rate-limit |

Build them **strictly in order** — each starts from where the last ended. After v8, complete **LLM APIs — Advanced**, then continue in [Capstone Phase 2](build-the-capstone-app-phase-2.md) with v9.

## How to work through it (the rules)

1. **One public GitHub repo, grown across all five tiles.** Not five repos — one, that evolves.
2. **Tag each version.** `git tag v1`, `v2`, … after each milestone works. Your commit history becomes a visible story of your learning.
3. **Write every line yourself.** Each tile gives architecture + key snippets; *you* assemble and extend the previous version.
4. **Keep it running at every step.** v1 must work before v2. A broken v3 is worse than a working v2.
5. **README grows too** — a short "what's new in this version" note per milestone, plus a screenshot/GIF.

## Real world: why this beats scattered demos

In a job you inherit a codebase and add features to it under real constraints — the exact skill this builds. And for your portfolio, one substantial evolving project ("here's my support assistant, from a basic call all the way to RAG + agents, tagged version by version") tells a far stronger story than five toy scripts. Dubai hiring managers can *see* the progression in your git history. This capstone is designed to become the **flagship project** you point to in interviews.

## Interview tip

*"I built one assistant app and grew it the way real products grow — v1 was a single API call, then I added conversation memory, streaming, per-request cost tracking with history truncation, and structured JSON output for edge cases. Later I extended the same app with RAG and tools. It's all one repo, tagged by version, so you can see each capability land."* That narrative shows you build *systems*, not snippets.

---

*Below: the eight Phase 1 milestones. Build them into one repo, in order; Phase 2 continues at v9.*
