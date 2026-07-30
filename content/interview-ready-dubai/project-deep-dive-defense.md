# Project Deep-Dive Defense

**What it is:** the round where the interviewer picks one project from your portfolio and drills into it for 20–40 minutes — "walk me through it," then a barrage of *why*, *what-if*, and *how-does-it-scale* — and you have to defend every decision as if you'd shipped it at work.

## Why it matters for an AI Engineer

For a candidate with a career gap and no recent job title in AI, **your projects are your experience.** This round is where a self-built RAG assistant can carry the same weight as production work — *if* you defend it like a professional. It's also the highest-yield prep: one project you know cold generates answers for system design, trade-off defense, failure modes, and behavioral stories simultaneously. Interviewers use the depth of your project answers to gauge whether you *actually built and understood* it or followed a tutorial. Shallow answers here sink otherwise-strong candidates.

## The mechanism: how to prepare and perform

**Pick one flagship project and go deep — not five shallow ones.** Depth beats breadth every time. Choose the one closest to real AI Engineering work (ideally a RAG or agent app with deployment).

**Prepare the 2-minute walkthrough.** A crisp arc: *the problem → who it's for → your architecture → the hard part you solved → the result.* Rehearse it; a rambling walkthrough loses them in the first minute.

**Then prepare for the drill.** Anticipate and pre-answer the predictable attack angles:

- **"Why did you choose X?"** — every tool/approach needs a [trade-off defense](trade-off-defense.md) (choice / alternative / because / switch-when).
- **"How does it scale?"** — what breaks at 100× traffic or 100× documents? Have a number.
- **"How do you know it works?"** — your [eval](rag-retrieval-eval.md) story: gold set, recall@k, faithfulness.
- **"What would you do differently?"** — shows growth; have a real answer, not "nothing."
- **"How would you deploy this for real?"** — the [production](deploy-llmops-cost.md) version: tracing, cost, guardrails.
- **"What was the hardest bug?"** — a STAR-style debugging story with a measured before/after.

The meta-skill: **turn every question into evidence of judgment.** You're not defending code; you're demonstrating how you think.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🗣️ 2-min walkthrough<span class="sub">problem→arch→hard part→result</span></span>
    <span class="darr">↓<span class="lbl">interviewer drills in</span></span>
    <span class="dbox orange">❓ Why X? · Scale? · Eval? · Bugs? · Deploy?</span>
    <span class="darr">↓<span class="lbl">each answer = trade-off + number</span></span>
    <span class="dbox green">✅ Reads as real production experience</span>
  </div>
  <div class="dcap">Your project is the stage; every follow-up is a chance to show judgment.</div>
</div>

## Concrete example: a defensible project narrative

> **Walkthrough:** *"I built a contract-Q&A assistant for a small law firm's use case. Users ask natural-language questions about contracts and get cited answers. Architecture: PDF ingestion → recursive chunking on clause boundaries → embeddings in pgvector → hybrid retrieval + reranking → Claude with a citation-enforcing prompt → an output check that every claim is grounded. The hard part was accuracy on clause-spanning questions — I diagnosed it with a recall@5 gold set, found chunking was slicing clauses, and fixed it with clause-boundary splitting + parent-child retrieval. Recall went 0.6 → 0.9."*
>
> **Under fire — "why pgvector not Pinecone?"** *"At ~5k chunks it's overkill to add managed infra; pgvector reused the Postgres I already had. I'd switch above ~5M vectors or if I needed advanced metadata filtering."*
>
> **"How does it scale to a million contracts?"** *"Retrieval stays fine with proper indexing, but reranking every query gets expensive — I'd cap reranking to top-30 candidates and add caching. My p95 budget would be ~2s; I'd load-test to confirm."*

Every answer names a trade-off, a number, and a switch condition. That's the target texture.

## How a company uses this (production lens)

Hiring managers treat this round as a proxy for a code review or design discussion you'd have *on the job*. A Dubai AI lead described their filter bluntly: they ask "what breaks at 10× scale?" and "how did you measure quality?" — if the candidate has real numbers (recall@5, p95 latency, cost/query) and a switch condition, they pass; if they wave hands, they don't, regardless of how polished the demo looked. The candidates who convert built *one* project deeply enough to answer any production question about it — which is exactly what building it for real would have taught them.

## Common mistakes
- **Breadth over depth.** Five tutorial-level projects lose to one you understand cold.
- **Can't defend choices.** "I used LangChain because the tutorial did" is disqualifying. Know *why*.
- **No eval story.** "It seemed to work" signals you never measured — the biggest tell of a tutorial follow.
- **"Nothing" to the improvement question.** Shows no reflection; always have a genuine next step.
- **Rambling walkthrough.** Not having a tight 2-minute version wastes your best moment.

## Interview tip
Write out every decision in your flagship project and its four-part defense, plus your eval numbers, scale story, and hardest-bug narrative — then rehearse the 2-minute walkthrough until it's automatic. The goal: no question about your own project can surprise you. When you can answer "what breaks at 10× and how did you measure quality?" with real numbers, a self-built project carries the weight of a paid one — which is exactly what a career-gap candidate needs. Draws on [Trade-off defense](trade-off-defense.md), [Failure-mode analysis](failure-mode-analysis.md), and [RAG & retrieval eval](rag-retrieval-eval.md).
