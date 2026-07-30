# RLHF

**What it is:** Reinforcement Learning from Human Feedback — the alignment stage that tunes a model using *human preferences* ("response A is better than B") rather than hand-written gold answers, making it more helpful, honest, and harmless.

## Why it matters for an AI Engineer

RLHF is *why* ChatGPT and Claude feel polished, refuse harmful requests, and match human taste in ways plain SFT can't. It explains model behaviors you deal with daily: **refusals**, **hedging**, **verbosity/sycophancy**, and the general "assistant personality." Understanding RLHF lets you reason about *why* a model over-refuses or flatters, and it's a very common interview topic because it's the core of "alignment."

## Why SFT isn't enough

SFT teaches the model to imitate good answers, but for many prompts it's hard to *write* the single ideal response — yet easy to *judge* which of two responses is better. RLHF exploits that: humans **rank/compare** outputs instead of authoring them. This scales better and captures fuzzy qualities (tone, helpfulness, safety) that are hard to specify explicitly.

## The mechanism (three steps)

1. **Start from an SFT model** — already a decent assistant.
2. **Train a reward model.** Show humans multiple responses to the same prompt; they pick the better one. Train a separate model to predict these human preferences, outputting a scalar "how good is this response" **reward** score. The reward model is essentially an automated human-taste judge.
3. **Optimize the LLM against the reward model** using reinforcement learning (classically **PPO**). The LLM generates responses, the reward model scores them, and the LLM's weights shift to produce higher-scoring responses. A **KL-divergence penalty** keeps it from drifting too far from the SFT model — otherwise it would "reward-hack," producing gibberish that games the reward model.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">SFT model</span>
    <span class="darr">→</span>
    <span class="dbox">Generate responses</span>
    <span class="darr">→</span>
    <span class="dbox purple wide">Reward model scores them</span>
  </div>
  <div class="flow"><span class="dbox blue wide">Human preference data</span><span class="darr">↑<span class="lbl">trains reward model</span></span></div>
  <div class="flow"><span class="darr">↓</span></div>
  <div class="flow">
    <span class="dbox orange wide">RL update (PPO) toward higher reward</span>
    <span class="darr">→<span class="lbl">KL penalty: stay near SFT</span></span>
    <span class="dbox green">Aligned model</span>
  </div>
  <div class="dcap">Three steps: start from SFT, train a reward model on human preferences, then optimize with PPO plus a KL leash.</div>
</div>

## Concrete example

Prompt: *"How do I pick a lock?"* The SFT model might give step-by-step instructions. During RLHF, humans consistently prefer a response that declines-or-adds-safety-context over one that gives a burglary tutorial. The reward model learns to score the safer response higher, and PPO nudges the LLM toward that behavior — so the deployed model responds helpfully but responsibly. The same process shapes preferences for clarity, correctness, and not making things up.

## How this shows up in production

- **The "instruct/chat" models you call are RLHF-aligned:** base → SFT → RLHF (or DPO). This is what makes them safe and pleasant enough to ship.
- **Over-refusal / sycophancy come from here:** if preference data rewards caution or agreeableness too heavily, the model over-declines or flatters. Recognizing this helps you diagnose and prompt around it.
- **RLHF is expensive and finicky:** it needs a reward model and unstable RL training, which is exactly why the simpler **DPO** (see its own note) became popular as a lighter alternative.

## Common misconceptions

- **"RLHF teaches the model new knowledge."** No — it shapes *preferences and behavior*. Knowledge still comes from pre-training.
- **"Humans write the answers in RLHF."** They *compare/rank* answers; a reward model turns those comparisons into a score. Writing gold answers is SFT, not RLHF.
- **"RLHF makes the model objectively correct."** It aligns to *human preference*, which can encode bias, over-caution, or sycophancy. Preference ≠ truth.

## Interview tip

Say: *"RLHF has three parts: start from an SFT model, train a reward model on human preference comparisons, then optimize the LLM against that reward with RL (PPO) plus a KL penalty to stay near the SFT model and avoid reward hacking. It works because judging outputs is easier than writing them, and it's what produces helpful, harmless behavior — but it can also cause over-refusal and sycophancy."* Mentioning the KL penalty and reward hacking signals real depth.
