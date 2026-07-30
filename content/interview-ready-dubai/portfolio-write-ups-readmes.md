# Portfolio Write-ups + READMEs

**What it is:** turning your projects into a portfolio that *sells for you* — GitHub READMEs and short write-ups a busy Dubai hiring manager can skim in 90 seconds and think "this person can do the job."

## Why it matters for an AI Engineer

For a career-gap candidate with no recent AI job title, your GitHub *is* your résumé. But here's the brutal reality: a hiring manager spends **under two minutes** on your profile before deciding to reply or move on. A brilliant project with a one-line "RAG app" README is invisible — they can't tell it apart from a tutorial clone. A well-written README turns the *same code* into evidence of production thinking. This is pure leverage: a few hours of writing multiplies the value of months of building, and it's the step most candidates skip, so doing it well makes you stand out instantly.

## The mechanism: what a hire-worthy README contains

Structure every flagship project's README so a skimmer gets the story top-to-bottom without reading code:

1. **One-line hook + a screenshot/GIF.** "Contract-Q&A assistant: ask questions about legal contracts, get cited answers." A visual proves it's real and runs — the single highest-impact element.
2. **The problem & who it's for.** Two sentences of context. Shows you build for users, not for a tutorial checkbox.
3. **Architecture diagram.** A simple boxes-and-arrows of the data flow (ingest → chunk → embed → retrieve → rerank → LLM → guardrail). Signals systems thinking at a glance.
4. **Key decisions & trade-offs.** A short bulleted list: "pgvector over Pinecone because…", "hybrid search because…". This is what separates you from tutorial-followers — it proves *judgment*.
5. **Results / evaluation.** Real numbers: "recall@5 improved 0.6 → 0.9 after clause-boundary chunking", "p95 latency ~2s", "~$0.004/query". Numbers are credibility.
6. **How to run it.** Clear setup steps. If a manager (or you, in-interview) can't run it in 5 minutes, it reads as unfinished.
7. **What I'd do next.** Shows reflection and awareness of limitations.

The mental model: **write for a skimmer who decides in 90 seconds.** Front-load the hook, the visual, and the numbers.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👀 Manager skims 90s</span>
    <span class="darr">↓</span>
    <span class="dbox orange">🖼️ Hook + GIF → "it's real"</span>
    <span class="darr">↓</span>
    <span class="dbox blue">📐 Diagram + trade-offs → "they think in systems"</span>
    <span class="darr">↓</span>
    <span class="dbox purple">📊 Numbers → "they measured it"</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ "Let's talk to them"</span>
  </div>
  <div class="dcap">A README is a landing page — every element earns the next 20 seconds of attention.</div>
</div>

## Concrete example: README skeleton

```markdown
# Contract-Q&A Assistant
Ask natural-language questions about legal contracts, get answers **with citations**.
![demo](docs/demo.gif)

## Problem
Lawyers waste hours hunting clauses across long contracts. This retrieves the
exact clause and answers in plain language, citing the source.

## Architecture
PDF → recursive chunk (clause boundaries) → embeddings (pgvector) →
hybrid retrieval + rerank → Claude (citation-enforced prompt) → grounding check.
![architecture](docs/arch.png)

## Key decisions
- **pgvector over managed vector DB** — ~5k chunks doesn't justify new infra.
- **Hybrid search (BM25 + vector)** — clause IDs are exact-match; pure vectors missed them.
- **Parent-child retrieval** — match the precise clause, return the full section for context.

## Results
- recall@5: **0.6 → 0.9** after clause-boundary chunking (20-question gold set)
- p95 latency ~2s · ~$0.004 / query

## Run it
`cp .env.example .env` (add API key) · `pip install -r requirements.txt` · `python app.py`

## Next
Add re-indexing pipeline for changed contracts; LLM-judge faithfulness on live traffic.
```

That README makes tutorial-level code look like production work — because it documents production *thinking*.

## How a company uses this (the hiring lens)

Dubai hiring managers and recruiters routinely open your GitHub *before* the first call, and lean teams often have the engineer who'll interview you glance at it to decide what to ask. A README with an architecture diagram and eval numbers does two things: it gets you the interview, and it *pre-seeds your [project deep-dive](project-deep-dive-defense.md)* — they walk in already impressed and ask deeper, friendlier questions. Candidates with polished write-ups report noticeably higher reply rates on cold applications, because the README does the convincing before a human has to be persuaded.

## Common mistakes
- **A one-line README.** The most common and most costly. Indistinguishable from a fork of a tutorial.
- **No visual.** A GIF/screenshot is the fastest "it's real" signal; skipping it wastes your best asset.
- **No numbers.** Without eval metrics you look like you never measured — the tutorial tell again.
- **Broken setup steps.** If it doesn't run, months of work reads as abandoned.
- **Wall of code, no story.** Managers skim prose and diagrams, not your `utils.py`.

## Interview tip
Before you apply anywhere, spend an afternoon making your flagship project's README skimmable: hook, GIF, architecture diagram, trade-offs, and real numbers. Pin that repo. In interviews you can literally screen-share the README as your talking-points map. Treat writing as part of building — the code isn't "done" until someone who's never seen it understands it in 90 seconds. This is the prerequisite for [Apply to Dubai roles + mentor outreach](apply-to-dubai-roles-mentor-outreach.md).
