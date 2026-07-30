# Evaluation

**The one-line idea:** Evaluation is how you *prove* your LLM system works — turning "it looks good to me" into repeatable numbers you can put on a dashboard, gate a deploy on, and defend in an interview.

## Why we even need it

LLMs are non-deterministic. The same prompt can give a great answer today and a wrong one tomorrow, and there's no compiler error when quality drops. Without evaluation you are flying blind:

1. **You can't tell if a change helped.** You tweak a prompt, swap a model, change your chunking — did it get *better* or just *different*? Vibes don't scale past three examples. You need a score on a fixed test set.
2. **You can't catch regressions.** A model version update or a "harmless" prompt edit silently breaks 5% of answers. In production that's thousands of bad responses before anyone notices. Evaluation is the smoke alarm.

So evaluation is the discipline that makes LLM engineering *engineering*: define what "good" means, measure it on real examples, and only ship when the number moves the right way.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📝 test set</span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 your system</span>
    <span class="darr">→</span>
    <span class="dbox orange">📊 metrics</span>
    <span class="darr">→<span class="lbl">gate</span></span>
    <span class="dbox green">✅ ship / block</span>
  </div>
  <div class="dcap">Run your system over a fixed test set, score the outputs, and let the number decide whether to ship.</div>
</div>

## Why it matters for an AI Engineer

"How do you evaluate your LLM app?" is the question that separates people who built a demo from people who ran a system. Anyone can wire up an API call; only an engineer can tell you their faithfulness score, their regression-test pass rate, and how they caught the last hallucination before users did. Evaluation is also where cost and quality meet: you can't optimize what you can't measure, and every prompt/model/RAG decision downstream is really an evaluation decision.

## The families you'll learn (and when to reach for each)

| Metric family | Core idea | Best when |
|---|---|---|
| **Intrinsic (ROUGE, BLEU, Perplexity, BERTScore, METEOR)** | compare output to a reference with word/embedding overlap | you have gold reference text (summarization, translation) |
| **LLM-as-judge / Pairwise / Rubric** | let a strong LLM score or compare outputs | open-ended answers with no single "correct" string |
| **RAG metrics (RAGAS: faithfulness, relevancy, context precision/recall)** | measure retrieval *and* grounding separately | any RAG system — find whether retrieval or generation is at fault |
| **Retrieval ranking (Precision@K, MRR, NDCG)** | did the right chunk rank near the top? | tuning the retriever itself |
| **Hallucination rate** | fraction of answers with unsupported claims | trust-critical apps (legal, finance, medical) |
| **Process (golden datasets, human-in-the-loop, regression/CI, LangSmith/Langfuse, bias & red-teaming)** | the workflow that runs metrics continuously and safely | shipping and maintaining a real system |

The rule of thumb: **intrinsic metrics** when you have references, **LLM-as-judge** when you don't, **RAG metrics** to localize where a RAG bug lives, and **process tooling** to run all of it on every commit.

## Real world: how a company uses this

> **A Dubai bank's support assistant** shipped with no eval and got embarrassed: a prompt tweak meant to sound "friendlier" quietly started inventing account fees. After the incident they built a 200-example **golden dataset**, scored every release on **RAGAS faithfulness** (is the answer grounded in retrieved docs?) and **context recall** (did we even retrieve the right policy?), and wired it into **CI so a PR that drops faithfulness below 0.9 fails the build**. Same model, same product — but now a bad change is blocked before it reaches a customer, not after.

## Interview tip
Say: *"I evaluate on three levels: intrinsic metrics like ROUGE/BERTScore when I have reference text, LLM-as-judge with a rubric for open-ended answers, and RAGAS — faithfulness, answer relevancy, context precision and recall — to split retrieval bugs from generation bugs in RAG. All of it runs against a versioned golden dataset in CI via Langfuse, so a regression blocks the deploy. Hallucination rate and red-teaming gate anything trust-critical."* That answer shows you've operated a system, not just built one.

---

*Below: deep-dive articles on each evaluation metric and process.*
