# Gradient Descent

**What it is:** The algorithm that actually *trains* every neural network — it repeatedly nudges the weights in the direction that lowers the loss, like walking downhill in fog until you reach the valley floor.

## Why it matters for an AI Engineer

Every model you'll ever touch — the LLM you fine-tune, the classifier you ship — was trained by gradient descent. It's *the* learning algorithm. Understanding it explains the **learning rate** (a hyperparameter you'll set when fine-tuning), why training can **diverge** or **get stuck**, and why training big models takes so much compute (millions of downhill steps over billions of weights). "How does a model actually learn?" has exactly one answer at this level: gradient descent. Interviewers ask it to check you understand training as a process, not magic.

## The mechanism

Picture the loss as a landscape: weights are your position, height is the loss, and you want the lowest valley. You're in fog — you can't see the whole map — but you *can* feel the slope under your feet. So you take a step downhill, feel again, step again. That's gradient descent.

The **gradient** is the slope — it tells you which direction increases the loss fastest. So you move the *opposite* way (downhill). Each weight updates by:

`new_weight = old_weight − learning_rate × gradient`

- The **gradient** says *which direction and how steep*.
- The **learning rate** is your *step size* — a small number (e.g. 0.001) you choose.
  - Too big → you overshoot the valley, bounce around, or diverge to infinity.
  - Too small → training crawls, taking forever.

Repeat this update over and over; loss drops; the model "learns." The gradients themselves are computed by **[backprop](backprop-concept.md)** — backprop *finds* the slope, gradient descent *takes the step*. They're a pair.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📍 current weights</span>
      <span class="darr">→</span>
      <span class="dbox orange">📐 gradient<span class="sub">which way is up?</span></span>
      <span class="darr">→</span>
      <span class="dbox purple">👣 step downhill<span class="sub">− lr × gradient</span></span>
      <span class="darr">→<span class="lbl">repeat</span></span>
      <span class="dbox green">📉 lower loss</span>
    </div>
  </div>
  <div class="dcap">Feel the slope, step downhill, repeat. Millions of times = a trained model.</div>
</div>

**Variants worth naming:** computing the gradient over *all* data each step is slow, so we use **mini-batch stochastic gradient descent (SGD)** — estimate the slope from a small batch, step, repeat. Optimisers like **Adam** are smarter versions that adapt the step size per weight and dominate deep learning today.

## Concrete example

Minimising `loss = w²` (valley at `w = 0`), starting at `w = 5`, learning rate `0.1`. The gradient of `w²` is `2w`:

```python
w, lr = 5.0, 0.1
for step in range(5):
    grad = 2 * w              # slope at current w
    w = w - lr * grad         # step downhill
    print(round(w, 3), "loss:", round(w**2, 3))
# 4.0 loss 16.0 -> 3.2 loss 10.24 -> 2.56 loss 6.55 -> 2.048 ... marching toward 0
```

Watch `w` slide toward 0 and loss shrink each step. Now try `lr = 1.1` and `w` explodes to ±infinity — that's a learning rate too high, the single most common training failure.

## How a company uses this

A **Dubai bank** fine-tuning an open LLM on Arabic financial documents lives and dies by the learning rate. Their first fine-tune used too high a rate; the loss spiked and the model produced garbage ("catastrophic divergence"). They dropped the learning rate 10×, added a **warmup** (start tiny, ramp up) and **decay** (shrink it late in training) schedule, and used the **Adam** optimiser — standard practice. Training became stable and the model learned the domain vocabulary. No one re-derived calculus; they understood gradient descent well enough to diagnose "our step size is wrong" and turn the right knob.

## Common mistakes

- **Learning rate too high** → divergence; **too low** → glacial training. It's the hyperparameter you tune first.
- **Thinking it finds the *global* best.** It finds a *good* valley (local minimum); for big nets that's fine in practice, but it's not guaranteed-optimal.
- **Confusing gradient descent with backprop.** Backprop computes the gradients; gradient descent uses them to update weights.

## Interview tip

Say: *"Gradient descent minimises the loss by repeatedly stepping the weights opposite the gradient — `w = w − learning_rate × gradient`. The learning rate is the step size: too big diverges, too small crawls. In practice we use mini-batch SGD or Adam. Backprop computes the gradients; gradient descent applies them."* If you add *"fine-tuning an LLM is just gradient descent on new data, and the learning rate is the knob I'd tune first,"* you've tied theory to the actual job. See **[Loss functions](loss-functions.md)** for what it minimises.
