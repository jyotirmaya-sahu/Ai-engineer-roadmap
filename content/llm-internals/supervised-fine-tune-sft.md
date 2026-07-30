# Supervised Fine-Tuning (SFT)

**What it is:** The stage that takes a raw base model and trains it on curated example conversations, teaching it to *behave like a helpful assistant* instead of just autocompleting text.

## Why it matters for an AI Engineer

SFT is the bridge between "a model that knows things" and "a model that answers you." It's also the fine-tuning stage *you* are most likely to run yourself — teaching a model your format, tone, domain, or task from labeled examples. Knowing what SFT can and can't do (it changes *behavior/style*, not really *knowledge*) is key to deciding between fine-tuning, RAG, and prompting — one of the most common real design decisions in an AI Engineer role.

## The mechanism

SFT uses the same next-token-prediction machinery as pre-training, but on a much smaller, carefully written dataset of **prompt → ideal response** pairs (often full chat transcripts with system/user/assistant turns). Humans (or curated sources) write the "gold" responses that demonstrate the behavior you want.

Key detail: during SFT you typically compute the loss **only on the assistant's tokens**, not the user's — you're teaching the model *how to respond*, not how to write the prompt. The model adjusts its weights to make those ideal responses more likely.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">Base model<span class="sub">autocompletes</span></span>
    <span class="darr">→</span>
    <span class="dbox purple wide">SFT on prompt→response pairs</span>
    <span class="darr">→</span>
    <span class="dbox green">Assistant<span class="sub">follows instructions</span></span>
  </div>
  <div class="flow"><span class="dbox blue wide">Curated: user asks → ideal answer</span><span class="darr">↑<span class="lbl">training data</span></span></div>
  <div class="dcap">SFT trains a base model on curated prompt→response pairs, turning autocomplete into an instruction-following assistant.</div>
</div>

Data quality dominates. A few thousand *high-quality* examples often beat hundreds of thousands of mediocre ones — the "quality over quantity" finding (LIMA and similar work) is a load-bearing lesson here.

## Concrete example

Base model completion of `"Explain photosynthesis."` might drift into `"Explain respiration. Explain mitosis..."` — it pattern-matches a list of prompts. After SFT on examples like:

```
user: Explain photosynthesis.
assistant: Photosynthesis is how plants convert sunlight, water, and CO₂ into glucose and oxygen...
```

the same prompt now yields a direct, well-formed explanation. Nothing new was "learned" about biology — the model already knew it from pre-training — SFT just taught it to *deliver* the knowledge in assistant form.

For your own use, SFT via LoRA (a lightweight method that trains small adapter weights) lets you fine-tune on, say, your company's support tickets cheaply, without touching the full model.

## How this shows up in production

- **"Instruct" / "chat" models are SFT'd base models:** `Llama-3-8B-Instruct` = `Llama-3-8B` base + SFT (+ preference tuning). You almost always deploy the SFT'd variant.
- **Domain/format adaptation:** teams SFT (usually with LoRA) to lock in a JSON schema, a brand voice, or a niche task where prompting alone is unreliable.
- **The fine-tune vs. RAG decision:** SFT is right for *behavior, format, style, and task patterns*; RAG is right for *fresh or proprietary facts*. Trying to teach new facts via SFT is the classic mistake.

## Common misconceptions

- **"SFT teaches the model new facts."** Mostly no — it shapes behavior and can reliably surface knowledge, but cramming facts via SFT is unreliable and risks overfitting. Use RAG for facts.
- **"More SFT data is always better."** Curation beats volume; noisy examples actively degrade the model. A small, clean dataset is often optimal.
- **"SFT is a totally different algorithm from pre-training."** Same next-token objective — just a smaller, curated, response-focused dataset with loss masked to the assistant's tokens. (Masking = the loss is only computed on the assistant's reply, not the user's prompt: you're teaching the model *how to respond*, not to predict the question that was handed to it as context.)

## Interview tip

Say: *"SFT fine-tunes a base model on curated prompt–response pairs using the same next-token objective, with loss on the assistant tokens, to turn autocomplete into an instruction-following assistant. Quality beats quantity, and it changes behavior and format more than knowledge — so for fresh facts I'd reach for RAG, and for style/format/task I'd reach for SFT, often via LoRA."* That crisp SFT-vs-RAG framing is exactly what interviewers want to hear.
