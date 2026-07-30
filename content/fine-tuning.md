# Fine-tuning

**The one-line idea:** Fine-tuning is taking a pre-trained LLM and continuing its training on *your* data, so the model's own weights change — permanently baking a new skill, tone, or format into it instead of describing what you want in every prompt.

## Why we even need it

A base LLM already knows language and reasoning. Most of the time you steer it with a **prompt** (instructions) or feed it facts at query time with **RAG** (retrieval). Those two cover ~90% of real AI-Engineer work and you should always try them first. But they hit walls:

1. **Prompting can't teach a genuinely new behavior.** You can *ask* for a JSON shape, a house writing style, or a niche classification, but a prompt is just words the model reads — if the base model was never good at the task, no amount of instruction fixes it, and long instruction blocks cost tokens on *every* call.
2. **RAG adds knowledge, not skill.** RAG is great when the answer lives in a document. It does nothing when the problem is *how* the model behaves — following your exact 12-step medical-coding format, always answering in Emirati-dialect Arabic, or reliably extracting fields from messy contracts.

Fine-tuning is the third lever: when the *behavior* needs to change, you show the model hundreds or thousands of examples and nudge its weights until the new behavior is built in. Now a short prompt gets the right output every time, and you can often drop down to a smaller, cheaper model.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 Base LLM</span>
    <span class="darr">→<span class="lbl">+ your examples</span></span>
    <span class="dbox orange">🏋️ train (weights change)</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Specialized model</span>
  </div>
  <div class="dcap">Fine-tuning updates the model's own weights so the new skill is permanent, not re-instructed every call.</div>
</div>

## Why it matters for an AI Engineer

Fine-tuning is a **"should-know," not a first reach.** The senior signal isn't "I can fine-tune" — it's "I know it's usually the *wrong* first answer, and I can name exactly when it's the right one." When you *do* need it, the game-changer of 2023–2026 is **PEFT (Parameter-Efficient Fine-Tuning)**: instead of retraining all 7 billion weights (needs a datacenter), you train a tiny add-on — **LoRA** and **QLoRA** let you fine-tune a serious model on a single rented GPU for a few dollars. That's what makes fine-tuning a normal team's tool, not just a big-lab luxury. Dubai enterprises fine-tune for domain tone (Arabic/English banking), strict output formats, and to shrink cost by moving a task off GPT-4-class models onto a cheap tuned open model.

## The strategies you'll learn (and when to reach for each)

| Tile | Core idea | Reach for it when |
|---|---|---|
| **[Long-context vs RAG vs fine-tune](fine-tuning/long-context-vs-rag-vs-fine-tune.md)** | the three ways to give a model what it lacks | deciding your *very first* approach |
| **[When fine-tuning is the wrong answer](fine-tuning/when-fine-tuning-is-the-wrong-answer.md)** | the anti-patterns that waste weeks | before you commit to a tuning project |
| **[Data-volume thresholds](fine-tuning/data-volume-thresholds.md)** | how many examples you actually need | scoping whether you have enough data |
| **[LoRA](fine-tuning/lora.md)** | train tiny low-rank adapters, freeze the rest | the default efficient fine-tune |
| **[QLoRA](fine-tuning/qlora.md)** | LoRA on a 4-bit-quantized base | fitting big models on one small GPU |
| **[Adapters](fine-tuning/adapters.md)** | swappable trained modules per task | serving many tasks from one base |
| **[Quantization](fine-tuning/quantization.md)** | store weights in 4/8-bit to save memory | shrinking models to train or serve |
| **[Data prep & formatting](fine-tuning/data-prep-formatting.md)** | build the chat/instruction dataset right | the step that decides success |
| **[Unsloth](fine-tuning/unsloth.md)** | 2× faster, lower-memory tuning library | fast, cheap single-GPU runs |
| **[HF PEFT / TRL](fine-tuning/hf-peft-trl.md)** | the standard Hugging Face tuning stack | production/team-standard workflows |
| **[Train & evaluate](fine-tuning/train-evaluate.md)** | run the loop, then prove it improved | every project, before shipping |
| **[RLHF / DPO](fine-tuning/rlhf-dpo.md)** | tune on *preferences* (A better than B) | aligning tone/helpfulness/safety |
| **[Distillation & merging](fine-tuning/distillation-merging.md)** | shrink a big model / combine tuned ones | cost-cutting and multi-skill models |

## Real world: how a company uses this

> **A Dubai insurance firm** needed to extract 20 structured fields from Arabic-and-English claim PDFs. GPT-4-class prompting hit ~86% field accuracy but cost too much at 40k claims/month. They **QLoRA-tuned an open 8B model** on 3,000 hand-corrected examples — one afternoon on a single rented A100 (~$15). Result: 94% accuracy, running on their own hardware at a fraction of the per-call cost, with data never leaving the UAE (a compliance win). Same task — prompting *scoped* it, fine-tuning *shipped* it.

## Interview tip
Say: *"Fine-tuning changes the model's weights, so I use it for behavior — format, tone, a narrow skill — not for knowledge, which is RAG's job. I always try prompting and RAG first; if the behavior still isn't there and I have a few hundred to a few thousand clean examples, I QLoRA-tune a small open model. That gets me higher accuracy at lower cost than calling a frontier model on every request."* That framing shows you treat fine-tuning as a deliberate, last-resort lever — the senior instinct.

---

*Below: deep-dive articles on each fine-tuning topic.*
