# RLHF / DPO

**The one-line idea:** instead of training on "here's the one right answer," you train on *preferences* — "answer A is better than answer B" — so the model learns fuzzy, subjective qualities like helpfulness, tone, and safety that you can't write as a single correct label.

## Why it matters for an AI Engineer

Standard fine-tuning ([SFT](hf-peft-trl.md)) teaches the model to imitate exact target outputs. But some goals have no single correct answer — "be more helpful," "sound warmer," "refuse harmful requests politely," "prefer the concise reply." You can't label those; you can only say which of two responses is *better*. **RLHF** (Reinforcement Learning from Human Feedback) is how ChatGPT-class models were aligned, and **DPO** (Direct Preference Optimization) is the simpler, now-dominant way to do the same thing. For an AI engineer, this is the tool for aligning a model's *behavior and values* to your product — a "nice-to-have" senior topic that shows you understand how frontier models are actually made.

## The mechanism / how it works

Both start from the same data: **preference pairs** — a prompt with a **chosen** (better) and **rejected** (worse) response, judged by humans or a strong LLM.

**RLHF — the classic three-step pipeline:**
1. **SFT** — first fine-tune normally on good examples.
2. **Reward model** — train a separate model to score any response, learning from the preference pairs (chosen should score higher than rejected).
3. **RL (PPO)** — use that reward model as a coach: the LLM generates, the reward model scores, and PPO nudges the LLM toward higher-reward outputs — with a **KL penalty** keeping it from drifting too far from the original model (or it "hacks" the reward and outputs gibberish). Powerful, but three models and a fiddly, unstable RL loop.

**DPO — the shortcut that mostly replaced it.** DPO proves you can skip the separate reward model and the RL loop entirely. It uses a clever loss that directly raises the probability of the **chosen** response and lowers the **rejected** one, while a reference (frozen original) model anchors it from drifting. One model, one stable training loop, standard gradient descent — same preference-alignment result, far simpler. This is why DPO is the default in 2026.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📝 Prompt + chosen ✅ / rejected ❌ pair</span>
    <span class="darr">↓</span>
    <span class="dbox orange">DPO loss: ↑ P(chosen) · ↓ P(rejected)</span>
    <span class="darr">↓<span class="lbl">reference model anchors drift</span></span>
    <span class="dbox green">✅ Model prefers the better response</span>
  </div>
  <div class="dcap">DPO trains straight on preference pairs — no separate reward model, no RL loop.</div>
</div>

## Concrete example

```python
# pip install trl peft
from trl import DPOTrainer, DPOConfig
from datasets import load_dataset

# Each row: {"prompt": ..., "chosen": <better reply>, "rejected": <worse reply>}
ds = load_dataset("json", data_files="prefs.jsonl")["train"]

trainer = DPOTrainer(
    model=model,               # your SFT-tuned model (with LoRA)
    ref_model=None,            # TRL uses a frozen copy as the reference automatically
    args=DPOConfig(output_dir="dpo-out", beta=0.1, num_train_epochs=1,
                   learning_rate=5e-6),   # note: much LOWER LR than SFT
    train_dataset=ds,
    peft_config=peft_cfg,
)
trainer.train()
```

`beta` controls how tightly the model stays near the reference — higher = more conservative. DPO typically runs *after* an SFT pass, at a small learning rate.

## How a company uses this

A Dubai customer-service platform's SFT model was accurate but occasionally curt and over-eager to give financial opinions it shouldn't. Rather than hand-write thousands of "perfect" replies, they collected **~2,000 preference pairs** — agents picking the better of two model drafts (warmer tone, proper "consult an advisor" disclaimers). A single **DPO** pass shifted the model's default behavior toward the preferred style and refusals without a separate reward model or unstable RL run — a few hours of training on top of the existing LoRA. Preference data was cheaper to collect (pick A or B) than authoring gold answers, and the behavior change was exactly what SFT couldn't express as a single label.

## Common mistakes
- **Reaching for RLHF/DPO when SFT would do.** If you *can* write the correct answer, just SFT on it — preference tuning is for the fuzzy stuff.
- **Learning rate too high** — DPO is sensitive; use ~1e-6 to 5e-6, far below SFT.
- **Low-quality/inconsistent preference pairs** — noisy "which is better" labels teach nothing.
- **Confusing the two in interviews** — DPO removes the reward model and RL loop that RLHF needs.

## Interview tip
Say: *"RLHF and DPO train on preferences — chosen vs rejected — instead of a single gold label, which is how you align fuzzy things like tone, helpfulness, and safe refusals. Classic RLHF needs an SFT model, a separate reward model, and a PPO loop with a KL penalty; DPO collapses that into one stable loss on the pairs, so it's my default. I use it after SFT, at a much lower learning rate."* Related: [HF PEFT / TRL](hf-peft-trl.md) (DPOTrainer), [Train & evaluate](train-evaluate.md).
