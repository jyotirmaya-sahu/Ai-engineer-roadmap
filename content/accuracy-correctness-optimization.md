# Accuracy & Correctness Optimization

**The one-line idea:** Evaluation *measures* how wrong your LLM is — this node is the toolbox that actually *makes it less wrong*: ground it in sources, make it check its own work, and teach it to say "I don't know" instead of confidently making things up.

## Why we even need it

Measuring a hallucination rate of 8% doesn't fix it. Once evaluation tells you the system is wrong too often, you need levers that *raise* accuracy. Two facts make this hard:

1. **A base LLM is a fluent guesser, not a truth machine.** It predicts the next likely token, so a plausible-sounding wrong answer scores just as high internally as the correct one. Nothing in vanilla generation forces the output to be true, grounded, or even self-consistent.
2. **The model has no built-in "I'm not sure" reflex.** Ask it something it doesn't know and it answers anyway, in the same confident tone. For a Dubai bank or hospital assistant, a confident wrong answer is worse than no answer — it costs trust, money, and sometimes lawsuits.

So this node is a family of techniques that bolt correctness *onto* generation: force it to cite, constrain its output shape, make it critique and vote, and give it an honest exit hatch when it doesn't know.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ question</span>
    <span class="darr">→</span>
    <span class="dbox blue">📚 ground in sources</span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 generate</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔍 critique / verify / vote</span>
    <span class="darr">→<span class="lbl">unsure?</span></span>
    <span class="dbox yellow">🙋 abstain / escalate</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ grounded answer</span>
  </div>
  <div class="dcap">Correctness is layered on: ground the input, verify the output, and route the low-confidence cases to a human.</div>
</div>

## Why it matters for an AI Engineer

Evaluation is the interview question "how do you *know* it works." This node is the follow-up: "the faithfulness score is 0.7 — now what do you *do*?" Junior engineers answer "better prompt." Real engineers reach for grounding, constrained decoding, self-consistency, and abstention thresholds — concrete mechanisms with known cost/latency trade-offs. These techniques are also the difference between a demo and a system a regulated Dubai enterprise will actually deploy.

## The techniques you'll learn (and when to reach for each)

| Technique | Core idea | Best when |
|---|---|---|
| **Grounding & citation-forcing** | make every claim quote a retrieved source | RAG / any factual Q&A — kills unsupported claims |
| **"I don't know" calibration** | teach the model to refuse when context is thin | trust-critical apps where a wrong answer is costly |
| **Constrained / structured decoding** | restrict output to valid JSON/enum/grammar | tool calls, extraction, anything a program parses |
| **Generate → critique → revise** | model reviews and fixes its own draft | complex reasoning, code, long answers |
| **Verification & validators** | run the output through a checker (code, schema, rules) | when correctness is machine-checkable |
| **Voting / self-consistency** | sample N times, take the majority answer | math/reasoning where one sample is flaky |
| **Confidence & abstention** | score certainty, answer only above a threshold | balancing coverage vs. wrong-answer risk |
| **Escalation to human** | hand low-confidence cases to a person | high-stakes decisions, the safety net |
| **Error-analysis workflow** | read your failures, cluster them, fix the biggest bucket | *always* — this is how you know which lever to pull |

The meta-rule: **error analysis first** tells you *which* of the other eight to spend effort on. Grounding + abstention handle most factual apps; verification + voting handle reasoning apps; escalation is the backstop for anything high-stakes.

## Real world: how a company uses this

> **A Dubai health-insurance claims assistant** was hallucinating coverage limits ~9% of the time — unacceptable when a wrong "yes, that's covered" becomes a payout dispute. They didn't retrain anything. They ran **error analysis** on 300 failures, found most were "answered despite thin retrieval," and layered fixes: **citation-forcing** (every coverage claim must quote a policy clause or the answer is rejected), **"I don't know" calibration** (refuse when no clause scores above a retrieval threshold), and **escalation** of refusals to a human agent. Hallucination on answered questions dropped below 1%; the abstained 6% went to humans instead of to customers as wrong answers. Same model, same documents — only correctness engineering changed.

## Interview tip
Say: *"Evaluation tells me the hallucination rate; this is how I lower it. I start with error analysis to find the biggest failure bucket, then reach for the matching lever: citation-forcing and abstention for factual RAG, constrained decoding for anything parsed, generate-critique-revise plus validators for reasoning and code, self-consistency for math, and human escalation as the backstop for high-stakes cases. Each has a cost/latency price, so I only add the ones error analysis says I need."* That shows you optimize deliberately, not by vibes.

---

*Below: deep-dive articles on each accuracy technique.*
