# Clarify requirements

**What it is:** the first four minutes of any AI design round — you refuse to draw a single box until you've pinned down *who uses this, what data it touches, what "good" means, and what constraints are non-negotiable*.

## Why it matters for an AI Engineer

Every design prompt is deliberately vague. "Design a support assistant" is missing the ten facts that decide the entire architecture: 50 users or 5 million, English or bilingual, data that changes hourly or never, a wrong answer that's annoying or a wrong answer that's a lawsuit. If you skip clarification you'll design confidently for the wrong system, and the interviewer will spend the rest of the round watching you unwind it. **Clarifying first is the single strongest seniority signal** — juniors start drawing, seniors start asking. It also buys you thinking time and, crucially, it makes the interviewer *a collaborator* who's now invested in your design.

## The mechanism: a four-bucket interrogation

Don't ask random questions — sweep four buckets in order. Each answer eliminates whole branches of the design tree.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👥 Users & scale<span class="sub">who, how many, how often</span></span>
    <span class="darr">↓</span>
    <span class="dbox blue">📂 Data<span class="sub">what, where, how fresh, private?</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">🎯 Quality bar<span class="sub">what does "good" mean, cost of a mistake</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">⛓️ Constraints<span class="sub">latency, budget, compliance, on-prem?</span></span>
  </div>
  <div class="dcap">Four buckets. Sweep them before drawing anything — each answer prunes the design.</div>
</div>

1. **Users & scale.** Who's the user (internal staff vs public customers)? How many, and what's the peak? Is usage bursty (Monday-morning spikes) or flat? This sets your QPS and whether you need autoscaling or a queue.
2. **Data.** What knowledge does the system need? Where does it live (PDFs, a database, an API)? How often does it change? Is it sensitive (PII, financial, medical)? This decides RAG vs fine-tune vs plain prompt, and whether data can leave the building.
3. **Quality bar.** What does a *correct* answer look like, and **what's the cost of a wrong one?** A wrong movie recommendation is fine; a wrong drug-interaction answer is a disaster. High-stakes → citations, human review, "I don't know" as a valid output. This shapes evaluation and guardrails.
4. **Constraints.** Hard latency ceiling? Monthly budget? Must run on-prem or in a specific cloud region (huge in the UAE for data-residency)? Any language requirement (Arabic + English)?

The discipline: **restate what you heard before moving on.** "So — internal HR team, ~500 people, policies update weekly, answers must cite the source doc, and it needs Arabic. Latency's flexible but a wrong compliance answer is unacceptable. Did I get that right?" That confirmation locks the scope and prevents a mid-round pivot.

## Worked example: same prompt, two designs

Prompt: *"Design an AI assistant for our e-commerce site."* Watch how two answers to the clarifying questions produce completely different systems:

- **Answer set A:** public shoppers, 100k/day, product catalog changes hourly, "good" = helpful product suggestions, a wrong answer is low-stakes, sub-second latency required. → **Design:** low-latency semantic search over the catalog + a small fast model, aggressive caching, no human review. Latency-first.
- **Answer set B:** internal merchandising team, 30 users, catalog + sales data, "good" = accurate analytics you can trust for pricing decisions, a wrong number misleads a buyer, latency irrelevant. → **Design:** text-to-SQL over the warehouse with a verification step, a stronger model, an "I'm not sure" fallback. Accuracy-first, latency ignored.

Same six words in the prompt, two opposite architectures. That gap is *entirely* decided by clarification.

## How a company uses this

> **A Dubai real-estate portal** briefed an AI Engineer with "build us a property-search chatbot." The engineer's clarifying sweep surfaced the killer fact buried in bucket 2: listings update every few minutes via an agent feed, and a stale "available" listing that's actually sold generates furious customer calls. That single answer moved the design away from a nightly-rebuilt vector index (which would always be minutes stale) toward **live SQL filters over the listings DB with an LLM only for the natural-language front-end.** Freshness, not embeddings, was the real requirement — and only clarification revealed it. Skipping the sweep would have shipped a system that was wrong by design.

## Common mistakes
- **Drawing before asking.** The cardinal sin. Even if you're sure it's "just RAG," ask first.
- **Asking trivia instead of decisions.** "What embedding model?" is premature. Ask questions whose answers *change the architecture* — scale, freshness, stakes, constraints.
- **Not restating.** If you don't confirm the scope out loud, you and the interviewer may be designing two different systems for twenty minutes.
- **Treating it as one question.** "How many users?" isn't enough. Sweep all four buckets; the constraint that sinks your design is usually in the bucket you skipped.

## Interview tip
Say, up front: *"Before I design anything I want to nail the requirements — let me ask about users and scale, the data and how fresh it needs to be, what 'good' means and the cost of a wrong answer, and any hard constraints on latency, budget, or where the data can live."* Then restate what you heard. This immediately frames you as someone who solves the *right* problem — and it sets up the next step, [defining SLAs](define-slas-latency-cost-accuracy.md), because the numbers you just gathered are what you'll turn into hard targets.
