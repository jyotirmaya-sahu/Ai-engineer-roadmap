# Train / Validation / Test

**What it is:** Splitting your data into three separate piles — one to *learn* from, one to *tune* on, and one *untouched* pile to get an honest final grade.

## Why it matters for an AI Engineer

This is the single most important discipline in all of ML, and it maps directly onto your day job. When you build an **LLM eval set**, you're building a test set. When you A/B test two prompts, you need a held-out set so you don't fool yourself. Every "our model got 99% accuracy!" claim that later collapses in production is a story about a broken data split. Interviewers ask this to see if you understand *honest measurement* — the thing that separates people who ship working systems from people who ship overfit demos.

## The mechanism

You split your labelled data three ways:

- **Training set (~70–80%)** — the model *learns* its weights from these. It's allowed to see the answers here.
- **Validation set (~10–15%)** — used *during* development to tune choices you make *about* the model: which learning rate, how many layers, when to stop training, which prompt. You check performance here repeatedly.
- **Test set (~10–15%)** — locked in a vault. You touch it *once*, at the very end, to report the number you'll actually trust. Because the model never learned from it and you never tuned to it, it's the closest thing to "how will this do on real, unseen data."

The golden rule: **the test set must stay pristine.** The moment you make a decision based on test performance, it's no longer a fair test — you've leaked information and your grade is inflated.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🗂️ All data</span>
    <span class="darr">→</span>
    <span class="dbox blue">🏋️ Train<span class="sub">learn weights · 70%</span></span>
    <span class="dbox orange">🎚️ Validation<span class="sub">tune choices · 15%</span></span>
    <span class="dbox green">🔒 Test<span class="sub">grade once · 15%</span></span>
  </div>
  <div class="dcap">Three piles, three jobs. Never let the model learn or tune on the test pile.</div>
</div>

**Why validation is separate from test:** if you tuned your model against the *test* set, you'd slowly bend the model to fit those specific examples — you'd be "training on the test set" indirectly. Validation is the sacrificial set you *are* allowed to overtune to; test stays clean as the tiebreaker.

**Cross-validation** is a common upgrade: instead of one fixed split, rotate which slice is validation across k folds and average. It squeezes more signal from small datasets — worth naming.

## Concrete example

```python
from sklearn.model_selection import train_test_split

# 1) carve off the test set first, and never touch it again
X_temp, X_test, y_temp, y_test = train_test_split(
    X, y, test_size=0.15, random_state=42
)
# 2) split the rest into train + validation
X_train, X_val, y_train, y_val = train_test_split(
    X_temp, y_temp, test_size=0.176, random_state=42  # 0.176*0.85 ≈ 0.15
)

model.fit(X_train, y_train)
tune_hyperparams(model, X_val, y_val)   # look at val as much as you like
final_score = model.score(X_test, y_test)  # look at test EXACTLY once
```

The comment on the last line is the whole lesson.

## How a company uses this

A **Dubai bank** building a loan-default model splits **by time**, not randomly: train on 2022–2024 loans, validate on early-2025, test on late-2025. Random splitting would leak future patterns into training and produce a rosy number that dies in production. Their MLOps pipeline *freezes* the test set in object storage; a CI check fails the build if any training code reads from that path. For their LLM chatbot, the same team keeps a 500-example "golden" eval set that product managers never see during prompt iteration — it's the test set, protecting them from tuning prompts to memorised examples.

## Common mistakes

- **Peeking at the test set to pick a model.** The most common self-deception in ML. Now your "honest" number is a lie.
- **Random splits on time-series or grouped data.** Same user (or future info) landing in both train and test = leakage.
- **No validation set** — so you tune on test and overfit your own evaluation.
- **Too-small test set** — a 20-example test gives a noisy grade; trust it accordingly.

## Interview tip

Say: *"Train to learn weights, validation to tune hyperparameters and prompts, test locked away for one honest final measurement. If I touch the test set to make a decision, it's contaminated. For time-based or user-grouped data I split by time or by group to avoid leakage."* Then land the AI-Engineer connection: *"My LLM eval set is a test set — I keep it out of the prompt-iteration loop for the same reason."* That shows the concept isn't academic to you.
