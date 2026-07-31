# v2 · Conversation Memory

**What you'll build:** upgrade v1 so HelpDesk **remembers the conversation**. Ask a follow-up like "and its population?" and it knows what "it" refers to. You change surprisingly little code — but you'll finally *feel* what statelessness means.

## Why this version

v1 forgot everything between calls because **the API is stateless** — it remembers nothing; you must resend the history every time. This version makes that idea concrete: memory isn't a setting you turn on, it's a list *you* keep and resend. This is the single most important mental model in LLM apps.

## What changes from v1

In v1 you sent a fresh one-message list every call. Now you keep a **growing `messages` list** on the server, append each user turn *and* each assistant reply, and send the whole list every time.

<div class="diagram">
  <div class="flow v">
    <div class="flow"><span class="dbox gray">v1</span><span class="darr">→</span><span class="dbox orange">[user msg]<span class="sub">one message, fresh each call</span></span></div>
    <div class="flow"><span class="dbox green">v2</span><span class="darr">→</span><span class="dbox blue">[system, user, assistant, user, …]<span class="sub">the whole growing list, resent</span></span></div>
  </div>
  <div class="dcap">Memory = keep the list and resend it. The model is stateless; your server holds the state.</div>
</div>

## The backend

```python
# app.py
from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI()
client = OpenAI()

# ponytail: ONE shared in-memory conversation — fine for a single-user demo, WRONG for real users.
#   Production upgrade (your stack): Supabase Auth -> user_id, load/save this user's messages in
#   Supabase Postgres (durable, isolated), Redis for hot session state. Never a global.
#   See the capstone overview's "deliberate shortcut" note.
history = [{"role": "system", "content": "You are HelpDesk, a helpful support assistant."}]

class Question(BaseModel):
    text: str

@app.post("/ask")
def ask(q: Question):
    history.append({"role": "user", "content": q.text})       # remember the question
    resp = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=history,                                     # send the WHOLE history
    )
    reply = resp.choices[0].message.content
    history.append({"role": "assistant", "content": reply})   # remember the answer
    return {"answer": reply}

@app.get("/")
def home():
    return FileResponse("index.html")
```

The frontend from v1 needs **no changes** — the memory lives entirely on the server. That's a good lesson by itself: a big behavioural change with zero UI change.

## The two lines that are the whole point

```python
history.append({"role": "user", "content": q.text})       # before the call
history.append({"role": "assistant", "content": reply})   # after the call
```

Forget the second one and the bot forgets its *own* answers — it'll remember your questions but not what it said. Both appends are required.

## Make it real — required for this version

- **Follow-ups work.** Ask "What's the capital of the UAE?" then "And its population?" — it answers correctly about that city.
- **Add a "Reset" button** that clears the history (a `POST /reset` that re-initialises the list to just the system message). Real chats need a "new conversation."
- **Commit and `git tag v2`.** Update the README: "v2 — added conversation memory."

## Try it, then notice the next gap

Have a long chat. Two things start to bug you: (1) the reply appears all at once after a pause — no live typing, and (2) you have no idea how many tokens this growing history is costing. Those are **v3** (streaming) and **v4** (cost) — again, features born from a problem you can now feel.

## Common mistakes

- **Not appending the assistant reply** — the classic bug; the bot loses its own last turn.
- **Sending only the latest message** — that's back to v1; you must send the full list.
- **Never resetting** — without a reset, the history grows forever (and gets expensive — which v4 addresses).
- **Assuming the API remembers** — it never does. Your list is the only memory.

## Interview tip

*"v2 added memory by keeping the `messages` list server-side and resending it each turn — appending both the user message and the assistant reply. The frontend didn't change at all, which drove home that 'conversation memory' is just state I hold and resend, because the API itself is stateless."* That's the exact answer to the common interview question "how does an LLM remember a conversation?"

*Next: v3 — stream the reply so it types out live, and give HelpDesk a personality.*
