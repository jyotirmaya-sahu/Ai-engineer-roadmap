# Pre-training

**What it is:** The first, massive training phase where a model learns language by predicting the next token over a huge corpus of text — producing a "base model" that knows a lot but doesn't yet follow instructions.

## Why it matters for an AI Engineer

Pre-training is where the model's *knowledge and capabilities* actually come from — everything later (fine-tuning, RLHF) only *shapes* what pre-training created. It explains why models "know" facts, why their knowledge has a **cutoff date**, why they **hallucinate** (they're pattern-completers, not databases), and why base models are cheap to adapt but expensive to build. When you pick between a base and an instruct model, or reason about a knowledge cutoff, you're reasoning about pre-training.

## The mechanism: next-token prediction

The training objective is almost absurdly simple: **given a run of text, predict the next token.** Take billions of documents, and at every position, ask the model to guess the following token, then nudge its weights toward the right answer (cross-entropy loss). No human labels required — the "answer" is just the next word in the text. This is **self-supervised** learning: the data labels itself.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">'The Eiffel Tower is in ___'</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Model predicts next token</span>
    <span class="darr">→</span>
    <span class="dbox yellow">Predicted: 'Paris'</span>
  </div>
  <div class="flow"><span class="darr">↓</span></div>
  <div class="flow">
    <span class="dbox">Compare to actual next token</span>
    <span class="darr">→</span>
    <span class="dbox orange">Update weights</span>
    <span class="darr">→<span class="lbl">repeat trillions of times</span></span>
    <span class="dbox purple">🧠 Model</span>
  </div>
  <div class="dcap">Self-supervised next-token prediction: guess, compare to the real next token, nudge weights, repeat at scale.</div>
</div>

Repeat this trillions of times across the internet, books, code, and more, and to get good at predicting the next token the model is *forced* to learn grammar, facts, reasoning patterns, translation, coding conventions, and style — because all of those help it guess better. Capability emerges as a side effect of compression: predicting text well *requires* understanding it.

## What it learns (and what it doesn't)

- **Learns:** vocabulary, syntax, world facts, common-sense associations, coding patterns, reasoning heuristics, multiple languages — all statistically.
- **Doesn't yet learn:** to be a helpful *assistant*. A raw base model given "What is the capital of France?" might continue with *"What is the capital of Germany? What is the capital of..."* — it completes text, it doesn't answer. Turning it into an assistant is the job of SFT and instruction tuning (later stages).

## Concrete example

A base model prompted with `"def fibonacci(n):"` will happily continue writing a plausible function body — because it saw millions of Python files and learned the pattern. Prompted with `"Once upon a"`, it continues `"time"`. It's a supercharged autocomplete. That same next-token engine, applied to `"The capital of France is"`, outputs `" Paris"` — knowledge that was never explicitly taught, only absorbed from text.

## How this shows up in production

- **Knowledge cutoff:** the model only knows what was in its pre-training corpus up to a date. Anything newer needs RAG or tools — this is *why* RAG exists.
- **Hallucination roots:** because the objective is plausible-continuation, the model will confidently produce fluent-but-wrong text when it lacks the fact. It's optimizing likelihood, not truth.
- **Build vs. adapt economics:** pre-training a frontier model costs millions in compute; almost everyone *adapts* an existing base/instruct model instead. Understanding this shapes buy-vs-build decisions.

## Common misconceptions

- **"The model looks things up in a stored database."** No — facts are baked into weights as statistical patterns during pre-training. There's no lookup table; that's why it can mis-remember.
- **"Base models can chat."** Raw base models complete text but don't reliably follow instructions or stay safe. Chat behavior comes from later alignment stages.
- **"It was trained on the whole live internet."** It's a *frozen snapshot* up to a cutoff, heavily filtered/deduplicated — not a live feed. Hence stale knowledge without tools.

## Interview tip

Say: *"Pre-training is self-supervised next-token prediction over a huge corpus. To predict text well the model has to absorb grammar, facts, and reasoning, so capability emerges as a byproduct. The output is a base model — knowledgeable but not instruction-following; that's what SFT and RLHF add later. It also explains the knowledge cutoff and why models hallucinate: they optimize plausibility, not truth."* Framing capability as an emergent side-effect of next-token prediction is the insightful answer.
