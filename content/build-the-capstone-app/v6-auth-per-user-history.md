# v6 · Auth & Per-User History

**What you'll build:** kill the global `history` variable. Add **Supabase Auth** so real users log in, and store **each user's conversation in Supabase Postgres**, keyed by their user id. Now two people using HelpDesk get their own private, durable chat histories that survive a server restart.

## Why this version

Everything through v5 shared one in-memory conversation — fine for you alone, catastrophic for real users (everyone would see and pollute the same chat, and a restart wipes it). This is the single biggest jump from "demo" to "product." You already know Supabase and Redis, so this isn't about learning tools — it's about wiring them into the app correctly: **who is this request from, and where does their history live?**

## The architecture change

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">before<span class="sub">v1–v5</span></span>
      <span class="darr">→</span>
      <span class="dbox orange">global history = [...]<span class="sub">one shared list, in memory</span></span>
    </div>
    <div class="flow">
      <span class="dbox green">after<span class="sub">v6</span></span>
      <span class="darr">→</span>
      <span class="dbox blue">Postgres: messages WHERE user_id = ?<span class="sub">per-user, durable</span></span>
    </div>
  </div>
  <div class="dcap">History moves from a process global to a per-user database query. The request must now carry "who am I".</div>
</div>

Two new responsibilities on the backend:
1. **Identify the user** — the frontend sends the Supabase auth token (JWT); the backend verifies it and extracts the `user_id`.
2. **Load/save that user's history** — instead of a global, read the user's messages from Postgres before the call, append the new turns after.

## Step 1 — the database

In Supabase, one table:

```sql
create table messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id),
  role        text not null,          -- 'system' | 'user' | 'assistant'
  content     text not null,
  created_at  timestamptz default now()
);
create index on messages (user_id, created_at);
-- Row Level Security: a user can only see their own rows
alter table messages enable row level security;
create policy "own messages" on messages
  for all using (auth.uid() = user_id);
```

**RLS is the safety net:** even if your backend code had a bug, Postgres itself refuses to return another user's rows. Belt and suspenders.

## Step 2 — verify the user on each request

The frontend (Supabase client handles login/signup) sends the JWT in an `Authorization: Bearer <token>` header. The backend verifies it:

```python
# auth.py
from fastapi import Header, HTTPException
from supabase import create_client
import os

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

def get_user_id(authorization: str = Header(...)) -> str:
    token = authorization.removeprefix("Bearer ").strip()
    res = sb.auth.get_user(token)          # verifies the JWT with Supabase
    if not res or not res.user:
        raise HTTPException(401, "Invalid or expired token")
    return res.user.id                      # the user_id we key everything on
```

## Step 3 — history from the DB, not a global

```python
# app.py (the ask endpoint, v6)
from fastapi import Depends
from auth import get_user_id, sb

SYSTEM = {"role": "system", "content": "You are HelpDesk, a support assistant."}

def load_history(user_id: str):
    rows = (sb.table("messages").select("role, content")
              .eq("user_id", user_id).order("created_at").execute().data)
    return [SYSTEM] + [{"role": r["role"], "content": r["content"]} for r in rows]

def save_message(user_id: str, role: str, content: str):
    sb.table("messages").insert(
        {"user_id": user_id, "role": role, "content": content}).execute()

@app.post("/ask")
async def ask(q: Question, user_id: str = Depends(get_user_id)):
    save_message(user_id, "user", q.text)
    history = load_history(user_id)                 # this user's conversation only

    def token_stream():
        collected = ""
        stream = client.chat.completions.create(
            model="gpt-5.4-mini", messages=history, stream=True)
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                collected += delta
                yield delta
        save_message(user_id, "assistant", collected)   # persist the reply

    return StreamingResponse(token_stream(), media_type="text/plain")
```

The shared global is gone. `Depends(get_user_id)` means every request is authenticated before it runs — no token, no answer.

## Step 4 — the frontend (generate with AI)

Supabase has a JS client that handles the whole login flow. Prompt your AI tool: *"Add Supabase Auth email login to this Next.js app; after login, send the session access token as an `Authorization: Bearer` header on every fetch to the backend."* The seam you own: **the token must be attached to each request**, or the backend returns 401.

## The request flow, end to end

Here's the whole v6 path a message takes — login, auth check, per-user history, generate, save. The diamond is the decision point; it branches **No → reject** and **Yes → continue**.

<div style="max-width:560px;margin:1.5rem auto;">
<svg viewBox="0 0 620 900" width="100%" font-family="ui-sans-serif,system-ui,sans-serif" role="img" aria-label="v6 request flow">
  <defs>
    <marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#64748b"/></marker>
  </defs>
  <g stroke="#64748b" stroke-width="1.6" fill="none">
    <line x1="290" y1="66" x2="290" y2="104" marker-end="url(#ah)"/>
    <line x1="290" y1="168" x2="290" y2="206" marker-end="url(#ah)"/>
    <line x1="290" y1="270" x2="290" y2="300" marker-end="url(#ah)"/>
    <path d="M362,346 H470 V376" marker-end="url(#ah)"/>
    <line x1="290" y1="392" x2="290" y2="430" marker-end="url(#ah)"/>
    <line x1="290" y1="494" x2="290" y2="532" marker-end="url(#ah)"/>
    <line x1="290" y1="596" x2="290" y2="634" marker-end="url(#ah)"/>
    <line x1="290" y1="698" x2="290" y2="736" marker-end="url(#ah)"/>
  </g>
  <g font-size="11" fill="#64748b" text-anchor="middle">
    <text x="300" y="90">login → JWT</text>
    <text x="415" y="337">No</text>
    <text x="303" y="416">Yes</text>
    <text x="300" y="520">load this user's history</text>
    <text x="300" y="622">history + question</text>
    <text x="300" y="724">save the reply</text>
  </g>
  <g text-anchor="middle">
    <!-- User -->
    <rect x="220" y="26" width="140" height="40" rx="8" fill="#f1f5f9" stroke="#94a3b8"/>
    <text x="290" y="51" font-size="14" font-weight="600" fill="#0f172a">👤 User logs in</text>
    <!-- Next.js -->
    <rect x="180" y="104" width="220" height="64" rx="8" fill="#e0e7ff" stroke="#6366f1"/>
    <text x="290" y="130" font-size="14" font-weight="600" fill="#0f172a">🖥️ Next.js UI</text>
    <text x="290" y="150" font-size="11" fill="#475569">POST /ask + Bearer &lt;JWT&gt;</text>
    <!-- Auth middleware -->
    <rect x="170" y="206" width="240" height="64" rx="8" fill="#dbeafe" stroke="#3b82f6"/>
    <text x="290" y="232" font-size="14" font-weight="600" fill="#0f172a">🔑 FastAPI auth middleware</text>
    <text x="290" y="252" font-size="11" fill="#475569">verify the JWT with Supabase</text>
    <!-- Diamond decision -->
    <polygon points="290,300 372,346 290,392 208,346" fill="#fef9c3" stroke="#eab308"/>
    <text x="290" y="350" font-size="13" font-weight="600" fill="#0f172a">valid token?</text>
    <!-- No box -->
    <rect x="380" y="376" width="180" height="52" rx="8" fill="#fee2e2" stroke="#ef4444"/>
    <text x="470" y="399" font-size="13" font-weight="600" fill="#0f172a">❌ 401 — reject</text>
    <text x="470" y="416" font-size="11" fill="#475569">no token, no answer</text>
    <!-- Yes: extract user_id -->
    <rect x="195" y="430" width="190" height="52" rx="8" fill="#dcfce7" stroke="#22c55e"/>
    <text x="290" y="453" font-size="13" font-weight="600" fill="#0f172a">✅ extract user_id</text>
    <text x="290" y="470" font-size="11" fill="#475569">from the verified token</text>
    <!-- Load history -->
    <rect x="165" y="532" width="250" height="64" rx="8" fill="#dbeafe" stroke="#3b82f6"/>
    <text x="290" y="558" font-size="14" font-weight="600" fill="#0f172a">🗄️ Load history — Postgres</text>
    <text x="290" y="578" font-size="11" fill="#475569">messages WHERE user_id = ?  (⚡Redis cache in v7)</text>
    <!-- OpenAI -->
    <rect x="190" y="634" width="200" height="64" rx="8" fill="#f3e8ff" stroke="#a855f7"/>
    <text x="290" y="660" font-size="14" font-weight="600" fill="#0f172a">🧠 OpenAI</text>
    <text x="290" y="680" font-size="11" fill="#475569">stream the reply</text>
    <!-- Save + reply -->
    <rect x="175" y="736" width="230" height="64" rx="8" fill="#dcfce7" stroke="#22c55e"/>
    <text x="290" y="762" font-size="14" font-weight="600" fill="#0f172a">💾 Save turn → 🖥️ show user</text>
    <text x="290" y="782" font-size="11" fill="#475569">insert assistant message in Postgres</text>
  </g>
</svg>
</div>

*Every request now carries "who am I" (the JWT), and history is loaded/saved per `user_id` — no global anywhere.*

## Make it real — required for this version

- **Two accounts, two histories.** Log in as user A, chat; log in as user B, chat — confirm they can't see each other's messages.
- **Durability.** Restart the FastAPI server; a user's history is still there (it's in Postgres, not memory).
- **RLS on.** Confirm a raw query with the wrong user can't read another's rows.
- **Commit and `git tag v6`.** README: "v6 — Supabase Auth + per-user history in Postgres."

## Common mistakes

- **Trusting a `user_id` sent from the frontend.** Never. Derive it from the verified token server-side — a client can lie about a body field, not about a signed JWT.
- **Skipping RLS** and relying only on your `where user_id = ?`. RLS is the backstop for when your code has a bug.
- **Using the service key in the browser.** The service key bypasses RLS — it lives only on the backend. The frontend uses the anon key.
- **Loading unbounded history** — a 500-message user now blows cost/context. Keep the v4 truncation *after* loading from the DB.

## Interview tip

*"v6 made it multi-user: Supabase Auth issues a JWT, the FastAPI backend verifies it to derive the user_id — never trusting a client-sent id — and loads/saves that user's history in Postgres with Row Level Security as a backstop. History went from a process global to a per-user, durable, isolated store."* Naming **RLS** and **"never trust a client-sent user id"** are exactly the security signals interviewers listen for.

*Next: v7 — put Redis in front of Postgres for fast session state under concurrency.*
