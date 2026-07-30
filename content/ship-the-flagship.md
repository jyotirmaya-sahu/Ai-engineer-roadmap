# Ship the Flagship

**The one-line idea:** Take your best AI project, wrap it in a real API, run it on real cloud infrastructure with tracing, auth, and load-tested limits — so it's a *live service* a hiring manager can hit, not a notebook that only runs on your laptop.

## Why we even need it

Everything else on this roadmap is knowledge. This node is *proof*. A recruiter skims a hundred resumes; a "RAG chatbot (Jupyter notebook on GitHub)" reads as coursework. A URL that says "POST your question here, get a traced, evaluated answer back in 400ms" reads as an engineer who can ship.

The gap between "it works on my machine" and "it's a running service" is exactly the gap between a student and a hire. That gap is made of four unglamorous things: a serving layer, a deployment, observability, and hardening. None of them are hard individually — but a candidate who has done all four *once, end to end,* has already solved the problems the job will throw at them on week one. That's why one deployed flagship beats five notebook projects.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🧪 Notebook<span class="sub">runs once, on your laptop</span></span>
    <span class="darr">→<span class="lbl">this node</span></span>
    <span class="dbox purple">🌐 FastAPI</span>
    <span class="darr">→</span>
    <span class="dbox orange">📦 Container on AWS</span>
    <span class="darr">→</span>
    <span class="dbox blue">🔭 Traced + evaluated</span>
    <span class="darr">→</span>
    <span class="dbox green">🛡️ Hardened & live URL</span>
  </div>
  <div class="dcap">The four steps that turn a project into a service you can put on your resume.</div>
</div>

## Why it matters for an AI Engineer

The AI-Engineer job *is* this loop, forever: expose a model behind an API, run it somewhere reliable, watch what it does in production, and stop it from falling over or getting abused. Companies don't pay you to prototype — they pay you to keep an LLM feature *up*. When a Dubai fintech asks "walk me through how you'd deploy this," they're testing whether you've felt the pain of cold starts, token cost spikes, and a prompt-injection attempt at 2am. Shipping your flagship is how you earn the right to answer confidently.

## The steps you'll do (and when each matters)

| Step | What it does | When it's the priority |
|---|---|---|
| **[Wrap in FastAPI service](ship-the-flagship/wrap-in-fastapi-service.md)** | Turns your Python logic into an HTTP API with typed request/response and streaming | Always first — nothing else can happen until there's an endpoint |
| **[Containerize + deploy to AWS](ship-the-flagship/containerize-deploy-to-aws.md)** | Packages the app + its exact dependencies and runs it on cloud infra with a public URL | Once the API works locally and you need it reachable + reproducible |
| **[Wire Langfuse tracing + eval](ship-the-flagship/wire-langfuse-tracing-eval.md)** | Records every LLM call (prompt, tokens, cost, latency) and scores output quality | The moment real traffic hits — you cannot fix what you cannot see |
| **[Load test + harden (auth, rate limits)](ship-the-flagship/load-test-harden-auth-rate-limits.md)** | Finds the breaking point, then adds keys, rate limits, and timeouts so it survives abuse | Before you share the URL publicly or put it on a resume |

The order is deliberate: **serve → deploy → observe → harden.** Each step assumes the previous one exists.

## Real world: how a company uses this

> **A Dubai logistics startup** built an internal "ask-the-ops-manual" assistant. The data scientist had a working notebook in a week. Getting it *usable by the ops team* took three more weeks — and every one of those weeks was one step in this node: a FastAPI endpoint the internal dashboard could call, a container on AWS ECS so it survived the laptop being closed, Langfuse so they could see that 8% of answers were hallucinated and fix the prompt, and rate limits after one enthusiastic user fired 400 requests in a minute and ran up a $60 OpenAI bill by lunch. The model never changed. The *engineering around it* is what made it a product.

## Interview tip

Say: *"My flagship isn't a notebook — it's a live service. It's a FastAPI app with streaming and typed schemas, containerized and running on AWS behind a real URL. Every LLM call is traced in Langfuse so I can see cost and latency per request and run offline evals on quality, and it's hardened with API-key auth, per-key rate limits, and timeouts — I load-tested it to find where it breaks first."* That single sentence signals you've crossed the notebook-to-production line, which is the exact line the job sits on.

---

*Below: deep-dive articles on each deployment step.*
