# v1 · Basic Q&A Call

**What you'll build:** the skeleton of HelpDesk — a **FastAPI** backend with one `/ask` endpoint, and a **Next.js + TypeScript** page (generated with AI) that sends a question and shows the answer. No memory yet, no streaming. The smallest *real* app on the production stack — API on `:8000`, UI on `:3000` — proving the call pattern end to end.

## Why start here

Every feature in later versions hangs off this skeleton. Get the plumbing right once — browser talks to your server, server talks to the model, answer comes back to the browser — and the rest is adding to it. This version makes the **SDK call pattern** and **reading the response** real, inside an actual app instead of a notebook.

## The architecture

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🖥️ Next.js UI<span class="sub">:3000</span></span>
    <span class="darr">→<span class="lbl">POST /ask (CORS)</span></span>
    <span class="dbox purple">⚙️ FastAPI<span class="sub">:8000</span></span>
    <span class="darr">→<span class="lbl">create()</span></span>
    <span class="dbox orange">🧠 OpenAI</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ answer</span>
  </div>
  <div class="dcap">One question in, one answer out — across two processes. This is the pipe every later version widens.</div>
</div>

## The backend (write this yourself)

One endpoint — the exact call pattern you learned, wrapped in FastAPI. Because the UI runs on a different port (`:3000`), you must enable **CORS** or the browser blocks the request.

```python
# app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI()
client = OpenAI()

app.add_middleware(                          # let the Next.js dev server call us
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"], allow_headers=["*"],
)

class Question(BaseModel):
    text: str

@app.post("/ask")
def ask(q: Question):
    resp = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[{"role": "user", "content": q.text}],
    )
    return {"answer": resp.choices[0].message.content}
```

Run: `uvicorn app:app --reload` (serves on `http://localhost:8000`). Test it before touching the UI:

```bash
curl -X POST localhost:8000/ask -H "Content-Type: application/json" -d '{"text":"hi"}'
# -> {"answer":"Hello! How can I help?"}
```

## The contract (hand this to your AI tool)

This is what the frontend needs to know — nothing more:

```
POST http://localhost:8000/ask
Request body:  { "text": string }
Response body: { "answer": string }
```

## The frontend (generate with AI)

Create a Next.js app (`npx create-next-app@latest helpdesk-ui --typescript`), then prompt Claude Code: *"In this Next.js App-Router + TypeScript project, build a page with an input and a button that POSTs `{text}` to `http://localhost:8000/ask` and displays `answer`."* You'll get something like this — **read it**, this is the seam you own:

```tsx
// app/page.tsx
"use client";
import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");

  async function ask() {
    const res = await fetch("http://localhost:8000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),          // matches the contract
    });
    const data = await res.json();
    setAnswer(data.answer);
  }

  return (
    <main style={{ padding: 24 }}>
      <h2>🛎️ HelpDesk</h2>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question..." />
      <button onClick={ask}>Ask</button>
      <p>{answer}</p>
    </main>
  );
}
```

Run the UI with `npm run dev` (serves on `http://localhost:3000`). Open it, ask a question, see an answer. Two processes talking — that's v1.

## Make it real — required for this version

- **Both processes run** — FastAPI on `:8000`, Next.js on `:3000`, talking over CORS.
- **One repo, two folders** — `backend/` (FastAPI) and `frontend/` (Next.js). A monorepo mirrors real setups.
- **A `.env` for your key**, `.gitignore` it, commit a `.env.example`.
- **A README** with run steps for both, and a screenshot.
- **`git init`, first commit, `git tag v1`.** Milestone one of one growing repo.

## Try it, then notice the gap

Ask: *"What's the capital of the UAE?"* → good answer. Now ask a follow-up: *"And its population?"* → it has **no idea what "its" means.** The model forgot your first question entirely. That missing memory is exactly what **v2** adds — and now you'll *feel* why it matters.

## Common mistakes

- **Returning the whole response object** instead of `resp.choices[0].message.content`.
- **Hard-coding the key** — env var only.
- **Skipping the README/tag** — the growing-repo story is half the point of this capstone.

## Interview tip

*"v1 was the thinnest real slice — a FastAPI endpoint doing one `chat.completions.create` call, a Next.js/TS client over CORS, returning `choices[0].message.content`. I generated the UI and focused on the API contract. I deliberately shipped it with no memory so the next version had a concrete problem to solve."* Showing you build in thin, working slices — and know where to spend effort — is a senior signal.

*Next: v2 — give HelpDesk a memory so follow-up questions work.*
