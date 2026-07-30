# Neurons & Layers

**What it is:** The Lego bricks of every neural network — a **neuron** is a tiny function that weighs its inputs and fires a number; a **layer** is a row of neurons; stack the layers and you have a network, including the ones behind every LLM.

## Why it matters for an AI Engineer

When someone says an LLM "has 70 billion parameters," those parameters are the *weights inside its neurons*. Understanding the neuron demystifies the whole field: there's no magic, just millions of "multiply, add, apply a squish" operations arranged in layers. This is the mental model that lets you reason about model *size*, *cost*, and *why bigger models cost more to run* — more neurons means more multiplications per token. Interviewers use "what's a neuron?" to check you understand the substrate, not just the API.

## The mechanism

A single **neuron** does three steps:

1. **Weight each input.** Every input `x` has a weight `w` (how much this neuron cares about it). Multiply them: `x₁·w₁ + x₂·w₂ + …`.
2. **Add a bias.** A constant `b` that shifts the result — lets the neuron activate more or less easily.
3. **Apply an activation function.** Squish the sum through a non-linear function (see **[Activation functions](activation-functions.md)**) to get the neuron's output.

So one neuron computes: `output = activation( Σ(xᵢ·wᵢ) + b )`. The **weights and bias are the learnable parameters** — training adjusts exactly these numbers.

A **layer** is many neurons side by side, all reading the same inputs but with different weights, so each learns a different feature. Networks stack layers:

- **Input layer** — your raw features enter.
- **Hidden layers** — the middle; each layer transforms the previous layer's output into higher-level features. "Deep" learning = many hidden layers.
- **Output layer** — produces the final prediction (one number for regression, probabilities per class for classification).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 Inputs<span class="sub">x₁ x₂ x₃</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">● ● ●<span class="sub">hidden layer 1</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">● ● ●<span class="sub">hidden layer 2</span></span>
    <span class="darr">→</span>
    <span class="dbox green">📤 Output</span>
  </div>
  <div class="dcap">Each dot is a neuron. Each layer builds richer features from the last. Stack enough and you get an LLM.</div>
</div>

Why stack at all? A single layer can only learn simple relationships. Early layers learn low-level patterns (edges in an image, word fragments in text); deeper layers combine those into abstract concepts (faces, meaning). This *hierarchy of features* is the entire point of depth.

## Concrete example

One neuron, worked by hand. Inputs `[2, 3]`, weights `[0.5, −1]`, bias `1`:

`sum = 2·0.5 + 3·(−1) + 1 = 1 − 3 + 1 = −1`
Apply ReLU activation (`max(0, x)`): `output = max(0, −1) = 0` → this neuron stays silent.

In code, a layer is just a matrix multiply:

```python
import numpy as np
x = np.array([2, 3])                 # inputs
W = np.array([[0.5, -1],             # 2 neurons, each with 2 weights
              [1.0,  0.2]])
b = np.array([1, -0.5])
z = W @ x + b                        # [-1.0, 1.9]
out = np.maximum(0, z)              # ReLU -> [0.0, 1.9]
```

An LLM does this same `W @ x + b` and activation, just with billions of weights across ~80+ layers, once per token.

## How a company uses this

A **Dubai property portal** ships a small neural net (a few layers, thousands of neurons) to score listing quality from photos and text. It runs cheaply on CPU because it's tiny. When they later adopted an LLM for description-writing, the *same* neuron-and-layer machinery underneath is why the LLM needs a GPU: it has ~10⁵× more neurons, so each generated token costs vastly more compute. Understanding neurons is understanding the cost curve — the engineering team sizes GPU budgets by reasoning about parameter count and tokens per second.

## Common mistakes

- **Thinking neurons are brain-like.** The name is a loose analogy; it's just weighted sums plus a squish.
- **Believing more layers is always better.** Too deep without enough data → overfitting and hard-to-train networks.
- **Forgetting the bias.** Without bias, every neuron is forced through the origin and loses flexibility.

## Interview tip

Say: *"A neuron computes a weighted sum of its inputs plus a bias, then applies a non-linear activation. A layer is a set of neurons; stacking layers lets the network learn a hierarchy of features. An LLM's billions of parameters are exactly these weights and biases."* If you can add *"depth is what lets early layers learn simple patterns and deep layers learn abstract ones,"* you've shown you understand *why* we stack — not just that we do.
