# Trade-off Defense

**What it is:** the drill of justifying every design choice against the option you *didn't* pick — turning "I used X" into "I used X over Y because Z, and I'd switch to Y when W."

## Why it matters for an AI Engineer

This is the most common follow-up in any technical round: *"Why did you choose that?"* Junior candidates answer with what they used ("I used a vector database"). Senior candidates answer with a **comparison** ("I used pgvector over a dedicated vector DB because our scale didn't justify new infra, and I'd migrate above ~5M vectors"). There are almost no absolute right answers in AI engineering — only trade-offs — so interviewers are literally testing whether you *think in trade-offs*. Master this and you sound experienced even on topics you've only studied, because you're demonstrating judgment, not just recall. In Dubai's lean teams, cost/simplicity trade-offs come up constantly.

## The mechanism: the four-part defense

Every good trade-off answer has the same shape. Practice it until it's automatic:

1. **State the choice.** "I used recursive chunking at ~500 tokens."
2. **Name the alternative.** "The main alternatives are fixed-size chunking or semantic chunking."
3. **Give the *because* — tied to a real axis.** Pick the axis that matters: *cost, latency, quality/accuracy, complexity, reliability, or time-to-ship.* "Fixed-size cut clauses in half hurting accuracy; semantic chunking was more accurate but 3× slower and more complex to run. Recursive was the sweet spot for quality vs simplicity."
4. **State the switch condition.** "I'd move to semantic chunking if documents were long and mixed-topic enough that recursive recall dropped below my bar."

The switch condition (step 4) is what most candidates omit and what impresses most — it proves you understand the choice is *contextual*, not dogma.

Internalize the **core axes** so you can always find the *because*:

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">💰 Cost</span>
    <span class="dbox orange">⚡ Latency</span>
    <span class="dbox purple">🎯 Quality</span>
    <span class="dbox gray">🔧 Complexity</span>
    <span class="dbox green">🛡️ Reliability</span>
    <span class="dbox yellow">⏱️ Time-to-ship</span>
  </div>
  <div class="dcap">Every trade-off is one axis traded for another — name which, and you have your answer.</div>
</div>

## Concrete example: a bank of ready defenses

Rehearse these until they're reflexes — they cover most AI Engineer rounds:

| Choice | Alternative | Because (axis) | Switch when |
|---|---|---|---|
| **RAG** | Fine-tuning | Knowledge changes often; RAG is cheaper to update (cost, time) | Task is narrow, stable, high-volume → fine-tune |
| **Hosted API** | Self-host open model | Faster to ship, no GPU ops (time, complexity) | Volume high enough that per-token cost > GPU cost, or data-residency demands it |
| **pgvector** | Dedicated vector DB | Reuses existing Postgres, less infra (complexity) | Above ~5M vectors or need advanced filtering |
| **Hybrid search** | Pure vector | Catches exact terms vectors miss (quality) | Corpus is purely semantic, no keywords/IDs |
| **Smaller/cheaper model** | Frontier model | 10× cheaper, fast enough (cost, latency) | Task needs frontier reasoning and quality gates fail |
| **Pipeline** | Agent | Deterministic, testable, cheaper (reliability, cost) | Steps are genuinely dynamic/open-ended |

Notice every row has all four parts. That's the pattern to reproduce live.

## How a company uses this (production lens)

Trade-off thinking isn't just interview theatre — it's the actual job. A Dubai startup chose a hosted API over self-hosting for their first LLM product to ship in 6 weeks (time-to-ship axis). Eight months later, at ~2M requests/day, the API bill hit ~$18k/month and *crossed* the switch condition — self-hosting a fine-tuned open model on reserved GPUs penciled out at ~$6k/month. They migrated. The engineer who'd *documented the switch condition up front* looked prescient; the decision was already made, just waiting for the number to cross. That's what naming switch conditions buys you in real life.

## Common mistakes
- **Answering with the choice, not the comparison.** "I used X" without "over Y" fails the round.
- **Defending a choice as universally best.** There are no universally best choices in AI eng; absolutism reads as inexperience.
- **Vague *because*.** "It's better" — better on *which axis*? Always name cost/latency/quality/complexity/reliability/time.
- **No switch condition.** Omitting when you'd change your mind loses the senior signal.

## Interview tip
Before the interview, list every non-trivial decision in your project and write its four-part defense (choice / alternative / because+axis / switch-when). When asked "why X?", deliver all four in ~20 seconds. The phrase *"I'd revisit that if…"* is your secret weapon — it converts a defensive question into proof of judgment. This drill powers your answers in [System design](system-design.md) and [Project deep-dive defense](project-deep-dive-defense.md).
