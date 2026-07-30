# Define SLAs (latency/cost/accuracy)

**What it is:** turning the fuzzy answers from [clarifying requirements](clarify-requirements.md) into three hard numbers — a latency ceiling, a cost budget, and an accuracy bar — that every later design decision must satisfy.

## Why it matters for an AI Engineer

An architecture is only "right" *relative to a target*. Without numbers, "fast enough" and "accurate enough" are opinions, and you can rationalize any design. Pin the three SLAs and suddenly every choice is forced: a 2-second latency ceiling kills a 5-agent reasoning loop; a $0.005/query budget kills always-calling-the-frontier-model; a 99% accuracy bar on a legal question forces citations and human review. **SLAs are the constraints that turn design from art into engineering** — and stating them unprompted is a top-tier seniority signal, because it shows you know that "it works in a demo" and "it holds at production scale and cost" are different claims.

## The mechanism: three dials, always in tension

The three SLAs form a triangle — you rarely max all three, and naming the trade-off is the whole point.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">⚡ Latency<span class="sub">p95 &lt; ? ms</span></span>
    <span class="darr">↔</span>
    <span class="dbox blue">💰 Cost<span class="sub">$ / query, $ / month</span></span>
    <span class="darr">↔</span>
    <span class="dbox green">🎯 Accuracy<span class="sub">% correct on eval set</span></span>
  </div>
  <div class="dcap">Pick your priority. Pushing one dial usually costs you another — say which you'd trade.</div>
</div>

**Latency.** Always quote **p95 or p99, not the average** — the average hides the slow tail that actually annoys users. For a chat UI, first-token latency matters more than total (streaming makes it *feel* fast). Typical bars: interactive chat p95 < 2–3s to first token; a batch job has no latency SLA at all, only throughput. Name whether it's *perceived* (stream tokens) or *total* latency.

**Cost.** Express it two ways: **per query** (drives model-tier and token choices) and **per month** (drives whether the whole thing is viable). Cost = (input tokens + output tokens) × price, summed over calls. A design that makes three LLM calls per query costs 3× a single-call design — that's a real SLA lever, not a detail.

**Accuracy.** Vague "be accurate" is useless. Force it to a *measurable* form: "≥ 95% correct on a 200-question eval set," or "≥ 98% of high-stakes answers either correct or an honest 'I don't know'." Tie the bar to the **cost of a mistake** from clarification — low-stakes → 90% is fine and you optimize for speed/cost; high-stakes → the bar climbs and you add verification, which costs latency and money. That's the triangle in action.

The senior move: **state your priority explicitly.** "This is a customer-facing chat, so I'll prioritize latency, hold cost to a per-query budget, and accept 92% accuracy with a graceful fallback — I'd only trade latency for accuracy if this were high-stakes."

## Worked numbers

Support assistant, clarified as: 100k queries/day, chat UI, medium-stakes.

- **Latency SLA:** p95 first-token < 1.5s, p95 full answer < 6s (streamed).
- **Cost SLA:** target $0.01/query → 100k/day × $0.01 = **$1,000/day ≈ $30k/month.** That number instantly tells you: you *cannot* call a frontier model on every query. You'll route — cache + small model for the 60% easy queries, mid-tier for the rest — to pull the blended cost under budget.
- **Accuracy SLA:** ≥ 90% correct on a 300-question eval, with a hard rule that unsupported claims trigger "I don't have that info" rather than a guess.

Notice the cost SLA *derived* the routing architecture. That's the point: SLAs aren't decoration, they force the design.

## How a company uses this

> **A Dubai fintech** set a chat-support SLA of p95 < 2s and $0.008/query. Their v1 called GPT-class frontier on every turn: accuracy was great (96%) but p95 hit 4s and cost was $0.03/query — **four times over budget** and twice too slow. Rather than accept it, they re-designed against the SLA: a **semantic cache** served 35% of repeat questions in <100ms and $0, a small model handled another 40%, and only the hard 25% hit the frontier model. Blended result: p95 1.8s, $0.007/query, accuracy 93%. They traded 3 points of accuracy for hitting *both* the latency and cost SLAs — a deliberate, defended trade, exactly what the number-first approach enables. Without the SLA there was nothing forcing that redesign.

## Common mistakes
- **Quoting the average latency.** Averages lie; the p95/p99 tail is what users feel and what pages you at 2am.
- **A cost SLA with no math.** "It'll be cheap" is not an SLA. Multiply tokens × price × volume — the monthly number often kills the naive design.
- **Unmeasurable accuracy.** "It should be accurate" can't be tested. Force it to "X% on a defined eval set," which also implies you'll *build* that eval set.
- **Maxing all three.** Claiming fast *and* cheap *and* most-accurate signals inexperience. Name your priority and the trade you'd make.

## Interview tip
Say: *"Let me set the SLAs before I build. I'll quote latency as p95 to first token, cost as both per-query and per-month against the volume we discussed, and accuracy as a percentage on an eval set — scaled to the cost of a wrong answer. This is chat and medium-stakes, so I prioritize latency and cost and accept ~92% with a safe fallback."* Now every box you draw in [sketching components](sketch-components.md) has a target to justify it against — and when they add pressure in [bottleneck analysis](find-bottlenecks-iterate.md), you'll already know which dial you're defending.
