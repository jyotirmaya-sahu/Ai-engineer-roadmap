# Loss Functions

**What it is:** A single number that measures *how wrong* the model's predictions are — the score that training exists to make as small as possible.

## Why it matters for an AI Engineer

"Training a model" literally means "adjusting weights to reduce the loss." If you don't know what loss is, the word "training" is a black box. It also explains LLM behaviour: LLMs are trained to minimise **cross-entropy loss** on next-token prediction — that one fact explains why they're fluent (they got very good at predicting likely text) *and* why they hallucinate (predicting *plausible* text is not the same as predicting *true* text). When you fine-tune, the loss is what's dropping. Interviewers ask "what's a loss function?" as a litmus test for whether you understand the optimisation underneath.

## The mechanism

Training is a feedback loop, and loss is the feedback:

1. Model makes a prediction.
2. **Loss function** compares prediction to the true label → a number (0 = perfect, bigger = worse).
3. Training nudges the weights to lower that number (see **[Gradient descent](gradient-descent.md)**).
4. Repeat millions of times.

The loss you pick depends on the task:

- **Regression → Mean Squared Error (MSE).** Average of `(prediction − actual)²`. Squaring punishes big misses hard and keeps it always positive. Predict 90 when the answer is 100 → error 10 → loss contribution 100.
- **Classification → Cross-Entropy loss.** Measures how far the model's predicted *probabilities* are from the truth. If the true class is "cat" and the model said cat with 0.9 probability, loss is small; if it said 0.1, loss is large. It rewards being *confident and correct* and savagely punishes being *confident and wrong*.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 Prediction</span>
    <span class="dbox gray">🎯 True label</span>
    <span class="darr">→</span>
    <span class="dbox orange">📏 Loss function<span class="sub">how wrong?</span></span>
    <span class="darr">→</span>
    <span class="dbox green">📉 shrink it<span class="sub">adjust weights</span></span>
  </div>
  <div class="dcap">Loss turns "wrong" into a number the model can systematically reduce.</div>
</div>

Key insight: **the loss function defines what "good" means.** Choose the wrong loss and the model optimises the wrong thing. There's also *loss* (used in training, must be smoothly differentiable) versus a *metric* like accuracy (what humans care about, but too "steppy" to train on directly) — good to distinguish.

## Concrete example

Cross-entropy for one prediction, by hand. True class is index 0 ("cat"). Model outputs probabilities `[0.7, 0.2, 0.1]`:

Cross-entropy = `−log(probability assigned to the true class)` = `−log(0.7)` ≈ **0.357**.

If the model had been more confident and correct — `[0.95, 0.03, 0.02]` — loss = `−log(0.95)` ≈ **0.051** (much lower, good). If it were confidently wrong — `[0.05, …]` — loss = `−log(0.05)` ≈ **3.0** (huge). In code:

```python
import numpy as np
def cross_entropy(true_idx, probs):
    return -np.log(probs[true_idx])

print(cross_entropy(0, np.array([0.7, 0.2, 0.1])))   # 0.357
print(cross_entropy(0, np.array([0.05, 0.9, 0.05])))  # 3.00  (confidently wrong)
```

That `−log` shape is *exactly* the loss every LLM minimises, summed over every token in the training corpus.

## How a company uses this

A **Dubai logistics firm** predicting delivery times chose loss deliberately. Their first model used plain MSE, which treated a 30-minute *early* and 30-minute *late* prediction as equally bad. But customers hate *late* far more than *early*, so the team switched to an **asymmetric (quantile) loss** that penalises late predictions ~3× harder. Same features, same model architecture — changing only the loss function shifted predictions to run slightly conservative and cut angry "where's my order?" tickets by a fifth. The lesson: the loss encodes the business's definition of "wrong."

## Common mistakes

- **Using accuracy as a loss.** Accuracy isn't smoothly differentiable, so you can't gradient-descend on it; you train on cross-entropy and *report* accuracy.
- **Wrong loss for the task** — MSE on a classification problem, or a symmetric loss when errors have asymmetric cost.
- **Ignoring class imbalance** — with 99% "no fraud," a naive loss lets the model predict "no" always; you weight the loss to fix it.

## Interview tip

Nail the one-liner: *"A loss function scores how wrong the model is; training minimises it. Regression uses MSE, classification uses cross-entropy. Crucially, LLMs are trained to minimise cross-entropy on next-token prediction — which is why they're fluent but not automatically truthful."* That last connection is the kind of insight that makes an interviewer nod.
