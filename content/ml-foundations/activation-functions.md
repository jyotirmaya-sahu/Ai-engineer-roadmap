# Activation Functions

**What it is:** The little non-linear "squish" applied to each neuron's output — the one ingredient that lets a neural network learn curves and complex patterns instead of only straight lines.

## Why it matters for an AI Engineer

Activations are why deep learning works *at all*. Without them, a 100-layer network collapses into the power of a single straight line — no matter how deep, it could only draw linear relationships. Every LLM depends on activation functions (modern ones use GELU/SwiGLU inside their feed-forward blocks). You won't tune them by hand as an AI Engineer, but "why do neural nets need activation functions?" is a classic interview question that separates people who *get* the mechanism from people who memorised buzzwords.

## The mechanism

Recall a neuron: it computes a weighted sum `z = Σ(x·w) + b`. If you *stopped there*, every layer would just be a linear transformation, and stacking linear transformations gives you… another linear transformation. The whole network would be equivalent to one line. Useless for anything curved (which is almost everything real).

The **activation function** breaks that. It applies a *non-linear* function to `z` before passing it on. That non-linearity is what lets layers combine into rich, curved decision boundaries. The common ones:

- **ReLU** — `max(0, z)`. If input is negative, output 0; otherwise pass it through. Dead simple, cheap, and the default workhorse for hidden layers. Its cheapness is why it dominated deep learning.
- **Sigmoid** — squashes any number into `(0, 1)`, an S-curve. Used for a final probability in binary classification. Saturates (flattens) at the ends, which slows learning in deep nets.
- **Tanh** — like sigmoid but ranges `(−1, 1)`, zero-centred.
- **Softmax** — used at the *output* of a classifier / an LLM: turns a vector of raw scores (logits) into probabilities that sum to 1.
- **GELU / SwiGLU** — smoother ReLU-like functions used inside modern transformers, including LLMs.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">z = Σx·w + b<span class="sub">raw sum</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">⚡ activation<span class="sub">ReLU / GELU…</span></span>
    <span class="darr">→</span>
    <span class="dbox green">neuron output<span class="sub">non-linear</span></span>
  </div>
  <div class="dcap">The activation is the non-linear gate that gives depth its power.</div>
</div>

Rule of thumb: **ReLU-family for hidden layers, softmax for classification outputs, sigmoid for a single binary probability.**

## Concrete example

Same inputs through different activations:

```python
import numpy as np
z = np.array([-2.0, 0.5, 3.0])

relu    = np.maximum(0, z)                 # [0.   0.5  3. ]  negatives killed
sigmoid = 1 / (1 + np.exp(-z))             # [0.12 0.62 0.95] squashed to (0,1)

logits  = np.array([2.0, 1.0, 0.1])        # an LLM's raw scores over 3 tokens
softmax = np.exp(logits) / np.exp(logits).sum()
# softmax -> [0.66 0.24 0.10]  probabilities summing to 1
```

That softmax step is exactly what an LLM does to turn its output **logits** into next-token probabilities before sampling — the bridge to the whole Sampling & Generation node.

## How a company uses this

A **Dubai health-tech** team building a diagnostic-support classifier learned this empirically. Their early deep model used **sigmoid** activations in hidden layers and trained painfully slowly — the sigmoid "saturates," its gradient shrinks toward zero in deep stacks, and learning stalls (the vanishing-gradient problem). Swapping hidden layers to **ReLU** — which doesn't saturate on the positive side — cut training time dramatically and improved accuracy, with no other change. It's a textbook example of an activation choice being the bottleneck. Their final layer stayed **softmax** to output calibrated probabilities per diagnosis, which clinicians needed for thresholding.

## Common mistakes

- **Believing "activation" means the whole layer.** It's just the non-linear step *inside* each neuron.
- **Using sigmoid/tanh in deep hidden layers** and hitting vanishing gradients — ReLU-family avoids this.
- **Forgetting softmax at a classifier's output**, so the model emits raw logits instead of probabilities.
- **Thinking you can skip activations to "keep it simple"** — then the network is just a linear model in disguise.

## Interview tip

The money answer: *"Activation functions add non-linearity. Without them, stacking layers collapses to a single linear transformation, so the network could only learn straight-line relationships. ReLU is the default for hidden layers because it's cheap and avoids vanishing gradients; softmax turns logits into probabilities at the output."* Tie it in: *"An LLM's softmax over the vocabulary is what produces the next-token probabilities we then sample from."* See sibling **[Neurons & layers](neurons-layers.md)** for where the activation sits, and **[Loss functions](loss-functions.md)** for what those output probabilities feed into.
