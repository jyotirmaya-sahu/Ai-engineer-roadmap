# AI System Design Interview

**The one-line idea:** The AI system design interview is a 40-minute conversation where you turn a vague prompt ("design a support bot") into a defensible architecture by driving a fixed loop — *clarify requirements → set SLAs → sketch components → find bottlenecks and iterate* — out loud.

## Why we even need it

Almost every AI Engineer loop in Dubai now has a design round, and it's the one candidates fumble most. Not because they don't know RAG or agents — they do — but because they treat the interview as a trivia test ("do I know what a vector DB is?") when it's actually a **behavior test**: *can you take an ambiguous business ask and steer it to a system that won't fall over at 2am?*

The failure mode is universal. The interviewer says "design a customer-support assistant," and the nervous candidate immediately starts drawing boxes — embeddings here, a vector DB there, an LLM at the end. Ten minutes in, the interviewer asks "how many users?" and the candidate realizes they built for the wrong scale, the wrong latency, and the wrong cost. They designed before they understood.

This node teaches the **framework that prevents that** — a repeatable loop you run every single time, so you never freeze on a blank whiteboard and never design the wrong thing.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ Clarify<span class="sub">what & why</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">📏 SLAs<span class="sub">latency/cost/accuracy</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧩 Sketch<span class="sub">components</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">🔍 Bottlenecks<span class="sub">& iterate</span></span>
    <span class="darr">→<span class="lbl">loop back</span></span>
    <span class="dbox green">✅ Defensible design</span>
  </div>
  <div class="dcap">The interview is a loop, not a straight line — every "what if" sends you back to sketch and re-defend.</div>
</div>

## Why it matters for an AI Engineer

The design round is where they decide your **level and your offer band**. A junior recites components; a senior *drives the conversation*, names trade-offs before being asked, and puts numbers on everything. The exact same knowledge — RAG, agents, serving — scores as "mid" if you list it and "senior" if you sequence it under real constraints of scale, latency, cost, and failure. This node is the meta-skill that turns everything else in the roadmap into an offer.

It's also the most *transferable* skill here. The framework is identical whether they ask you to design a support bot, a document pipeline, or a research agent. Learn the loop once and you can attack any prompt they invent.

## The pieces you'll learn (and when to reach for each)

| Piece | What it does | Reach for it when… |
|---|---|---|
| [Clarify requirements](ai-system-design-interview/clarify-requirements.md) | pin down scope, users, data, and the real goal | the very first thing, always — never draw a box before this |
| [Define SLAs](ai-system-design-interview/define-slas-latency-cost-accuracy.md) | put numbers on latency, cost, and accuracy | right after clarifying — SLAs decide the whole architecture |
| [Sketch components](ai-system-design-interview/sketch-components.md) | draw the boxes and data flow | once you know the requirements and SLAs |
| [Find bottlenecks & iterate](ai-system-design-interview/find-bottlenecks-iterate.md) | stress the design, fix the weakest link | after the first sketch, and every time they add a constraint |
| [Design a support RAG assistant](ai-system-design-interview/design-a-support-rag-assistant.md) | full worked example: knowledge Q&A | the classic RAG prompt — the most common question |
| [Design a doc-processing pipeline at scale](ai-system-design-interview/design-a-doc-processing-pipeline-at-scale.md) | full worked example: batch ingestion at millions of docs | throughput/cost prompts, not latency-first ones |
| [Design a coding / research agent](ai-system-design-interview/design-a-coding-research-agent.md) | full worked example: multi-step autonomy | the agentic prompt — tools, loops, and control |
| [Capacity & cost (QPS, tokens, $)](ai-system-design-interview/capacity-cost-qps-tokens.md) | back-of-envelope math for load and spend | whenever they ask "how big / how expensive?" |
| [Failure-mode analysis](ai-system-design-interview/failure-mode-analysis.md) | name what breaks and how you'd catch it | when they push "what if X fails?" — or before they do |
| [Data pipeline design](ai-system-design-interview/data-pipeline-design.md) | how data gets in, stays fresh, and stays correct | any system where the data isn't static |

## Real world: how a company uses this

> **A Dubai bank** ran a design loop for an AI Engineer role: *"Design an assistant that answers employees' HR-policy questions."* Two candidates, same résumé. Candidate A drew a RAG diagram in ninety seconds and waited for approval. Candidate B spent the first four minutes asking: *how many employees, how often do policies change, does it need Arabic, what's the tolerance for a wrong answer on a compliance question, is chat latency or nightly-batch acceptable?* — then designed for **500 daily users, weekly policy updates, bilingual, and a hard "cite the source or say I don't know" rule because a wrong benefits answer is a legal risk.** Same technology, but B's design was defensible and B got the senior band. The framework — not the tech — was the differentiator.

## Interview tip
Open every design round the same way: *"Before I draw anything, let me make sure I'm solving the right problem — can I ask a few questions about scale, latency, the data, and what 'good' means here?"* That one sentence signals seniority in the first ten seconds. Then narrate the loop as you go: clarify, set SLAs, sketch, hunt bottlenecks, iterate. Interviewers are grading your *process*, not your first diagram — a candidate who visibly runs a repeatable framework beats one who happens to draw a correct box.

---

*Below: deep-dive articles on each part of the framework and each worked example.*
