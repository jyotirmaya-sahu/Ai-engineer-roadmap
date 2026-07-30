# Climb only when the rung below fails

**What it is:** the discipline that makes the [capability ladder](prompt-few-shot-rag-tools-fine-tune-pretrain.md) useful — you move up a rung *only* when you have **evidence**, not a hunch, that the cheaper option can't meet the requirement.

## Why it matters for an AI Engineer

The ladder tells you the *order*; this tells you *when to step*. Without it, engineers "future-proof" — they build the agent system on day one because "we'll probably need it." That's how a two-week feature becomes a three-month one that's harder to debug, costs 10× to run, and does the same thing. Senior engineers do the opposite: ship the cheap rung, *measure*, and let the failure tell them to climb. In an interview, this is the difference between "I'd use agents" (junior) and "I'd start with a scripted workflow and only add an agent if the branching turns out to be genuinely dynamic" (senior).

## The mechanism: evidence-driven climbing

A "failure" that justifies climbing is **a measured gap against a defined requirement**, not a vibe. So the loop is:

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🎯 Define the bar<span class="sub">accuracy / latency / cost</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">🔨 Build cheapest rung</span>
    <span class="darr">→</span>
    <span class="dbox orange">📏 Measure vs bar</span>
    <span class="darr">→<span class="lbl">meets it?</span></span>
    <span class="dbox green">✅ Ship — stop</span>
  </div>
  <div class="flow"><span class="darr">↓<span class="lbl">falls short + you know why</span></span></div>
  <div class="flow">
    <span class="dbox purple">⬆️ Climb one rung — repeat</span>
  </div>
  <div class="dcap">Climb only on a measured miss you can explain. No metric, no climb.</div>
</div>

Three rules make this concrete:

1. **Define the bar before you build.** "Good enough" is meaningless. Write it down: *"95% correct on our 200-question eval set, p95 under 3s, under AED 0.02/call."* Now "the prompt failed" is a fact, not an opinion.
2. **Diagnose *why* it failed before climbing.** A wrong answer doesn't automatically mean "climb." If the prompt missed because it lacked a fact → RAG (climb). If it missed because the instruction was vague → fix the prompt (stay). Climbing to fix a same-rung bug wastes the whole point.
3. **Climb exactly one rung.** Don't leap from prompt to fine-tune. Add few-shot, re-measure. Each rung you skip is a cheaper solution you never tested and a defense you can't give.

The payoff is **defensibility**. Because you have a number at every rung, you can always answer "why not the simpler thing?" — you *tried* it and it scored 82% against a 95% bar. That's the sentence that ends the debate.

## Worked example: resisting the climb

Requirement: an internal Q&A bot, bar = 90% on a 150-question eval, < AED 0.03/call.

- **Rung 1 — prompt** (frontier model, no context): 61%. Fails. *Why?* It doesn't know internal policies. Missing capability = knowledge → climb to RAG (correct climb).
- **Rung 3 — RAG**: 88%. *Close.* Diagnose the 12% misses: half are retrieval misses (wrong chunk fetched), half are the model ignoring context. Neither is a "need agents" signal — it's a *tuning* problem. Fix chunking + add "answer only from context" → 93%. **Ship. Do not climb to agents.**

A junior sees 88% and reaches for an agentic RAG loop. The senior sees 88%, reads the failures, and fixes them *on the same rung* for a fraction of the effort.

## How a company uses this

> **A Dubai insurance firm's claims-triage assistant.** The team was told to "use agents." The lead pushed back with the loop: bar = route 90% of claims to the right queue, p95 < 2s. A scripted **workflow** (if-else over a classifier + two RAG lookups) hit 91% in a week. An agent version was *tested in parallel* and scored the same 91% but ran 3× slower and cost 4× more per claim because it made redundant LLM calls to "decide" steps that were actually fixed. The workflow shipped; the agent was documented as "re-evaluate if routing rules become dynamic." That written trigger is the senior move — climbing isn't forbidden, it's *deferred until a measured need appears*.

## Common mistakes
- **No bar.** Without a defined target you can rationalize any architecture. Define accuracy/latency/cost *first*.
- **Climbing to fix a same-rung bug.** Bad chunking isn't a reason to add agents. Diagnose the failure's *cause* before assuming you need more power.
- **Building for imagined future needs.** "We'll need multi-agent eventually" — maybe, but build it when the need is real and measured. YAGNI applies to architecture.
- **Never climbing out of stubbornness.** The flip side: if you've genuinely measured that the cheap rung can't hit the bar, *climb* — don't ship 70% because you're attached to simplicity.

## Interview tip
Say: *"I climb the ladder on evidence, not anticipation. I define the accuracy, latency, and cost bar up front, build the cheapest rung, and measure. If it misses, I diagnose *why* — a missing capability means climb, a tuning problem means stay and fix. And I climb one rung at a time so I can always defend why I didn't jump straight to the expensive option."* This directly answers the interviewer's real question: *will this person over-engineer my system?*
