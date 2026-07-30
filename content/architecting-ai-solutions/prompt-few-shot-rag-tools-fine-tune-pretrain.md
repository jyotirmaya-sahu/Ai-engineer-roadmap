# Prompt → few-shot → RAG → tools → fine-tune → pretrain

**What it is:** the *capability ladder* — the six ways to make an LLM do what you want, ordered from cheapest and fastest to most expensive and slowest. It's the mental map every other decision in this node hangs off.

## Why it matters for an AI Engineer

Interviewers ask "how would you build X?" and the wrong answer isn't a wrong *technology* — it's **starting at the wrong rung.** Reach for fine-tuning when a prompt would do and you've burned a month and a GPU budget for nothing. Reach for a bare prompt when the task needs private data and you ship a hallucination machine. Knowing the ladder — and that each rung *adds a specific capability the one below lacks* — is what lets you pick correctly in thirty seconds and defend it.

## The mechanism: what each rung adds

Each rung solves a problem the rung below *cannot*. That's the whole logic — you climb only to unlock the next missing capability.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📝 Prompt<span class="sub">instructions only</span></span>
    <span class="darr">↓<span class="lbl">+ examples of the format</span></span>
    <span class="dbox gray">🔢 Few-shot<span class="sub">show, don't tell</span></span>
    <span class="darr">↓<span class="lbl">+ external knowledge</span></span>
    <span class="dbox blue">📚 RAG<span class="sub">look facts up</span></span>
    <span class="darr">↓<span class="lbl">+ actions in the world</span></span>
    <span class="dbox orange">🛠️ Tools<span class="sub">call APIs, run code</span></span>
    <span class="darr">↓<span class="lbl">+ baked-in behavior</span></span>
    <span class="dbox purple">🎓 Fine-tune<span class="sub">change the weights a little</span></span>
    <span class="darr">↓<span class="lbl">+ a whole new brain</span></span>
    <span class="dbox purple">🧠 Pretrain<span class="sub">train from scratch</span></span>
  </div>
  <div class="dcap">Each rung adds one capability the rung below cannot provide.</div>
</div>

1. **Prompt** — you *tell* the model what to do in plain English. Free, instant. Unlocks: general reasoning and knowledge the model already has.
2. **Few-shot** — you *show* the model 2–5 examples of input→output inside the prompt. Still just a prompt, but now it copies a format or style reliably. Unlocks: consistent output shape, edge-case handling — without any training.
3. **RAG** — you retrieve relevant text at question-time and paste it in. Unlocks: **private, current, or too-large-to-memorize knowledge** (your docs, today's prices). The model still doesn't *know* it; it reads it fresh each time.
4. **Tools (function-calling)** — the model can call functions: query a database, hit an API, run code, send an email. Unlocks: **acting on the world and fetching live/computed data**, not just reading static text.
5. **Fine-tune** — you nudge the model's weights on your own examples (usually LoRA, a few hundred to a few thousand rows). Unlocks: **a behavior/style/format baked in** so you don't re-send it every call — cheaper per request, lower latency, and skills a prompt can't reliably force. It does *not* reliably add new facts (that's what RAG is for).
6. **Pretrain** — train a model from scratch on billions of tokens. Unlocks: a fundamentally new base model. Costs millions. Almost no company does this — you'll list it to show you know where the ladder ends.

The key insight: **rungs 1–4 are things you do to the *input*; rungs 5–6 change the *model itself*.** That line is where cost, time, and risk jump by an order of magnitude.

## Worked example: same task, four rungs

Task: "Classify support tickets as billing / technical / other."

- **Prompt:** `"Classify this ticket: {text}. Reply with one word."` — works ~85% on easy cases, ships in one line.
- **Few-shot:** add three labelled examples in the prompt → ~93%, handles your weird edge cases, still one API call.
- **RAG:** if categories depend on a policy doc ("refunds over AED 5000 are 'billing-escalation'"), retrieve that policy into the prompt.
- **Fine-tune:** if you have 5,000 labelled tickets and need 98% at low latency and low cost-per-call, fine-tune a small model — now the examples live in the weights, not in every prompt, so each call is shorter and cheaper.

Notice you'd only fine-tune at *volume* where the per-call savings pay back the training cost. Below that, few-shot wins.

## How a company uses this

> **A Dubai bank's KYC document-review tool.** First version: a prompt asking a frontier model to extract fields from Emirates ID scans — 90% accurate, but AED 0.04/call × 2M docs/month = AED 80k/month, and each call re-sent a 600-token instruction block. They had 50k human-verified extractions, so they **fine-tuned a small model**: the instructions moved into the weights, prompts dropped to ~40 tokens, cost fell ~70%, latency halved, and accuracy rose to 96% on their specific forms. The frontier model stayed as a **fallback** for low-confidence cases — a two-rung architecture. The trigger to climb was concrete: proven volume + a labelled dataset + a hard cost target, not "fine-tuning sounds better."

## Common mistakes
- **Fine-tuning to add knowledge.** Fine-tuning teaches *behavior and style*, not facts. Need the model to know your 2026 price list? That's RAG. This is the single most common architecture error.
- **Skipping few-shot.** People jump from "the prompt is flaky" straight to fine-tuning. Three good examples fix most flakiness for free.
- **Treating "tools" as advanced.** Tool-calling is often *simpler* than RAG for structured data — a `get_order_status(id)` function beats embedding your orders table.
- **Listing pretrain as a real option.** It signals you don't know the cost. Name it only to bound the ladder.

## Interview tip
Say: *"I think of six rungs — prompt, few-shot, RAG, tools, fine-tune, pretrain — cheapest to costliest. Rungs one to four change the input; five and six change the model, and that's where cost and time jump 10×. I start at the bottom and climb only when I've got evidence the rung below can't meet the requirement."* Then see [Climb only when the rung below fails](climb-only-when-the-rung-below-fails.md) for the discipline that goes with it.
