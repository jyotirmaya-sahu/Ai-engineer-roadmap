# Forward Pass

**What it is:** Running data *forward* through the network — inputs enter, flow layer by layer, and a prediction comes out the other end. When you call an LLM API, you're triggering a forward pass.

## Why it matters for an AI Engineer

This is the concept that maps *most directly* onto your job. Every LLM API call — every token generated — is a forward pass through the model. Understanding it explains **latency** (more layers and more parameters = slower forward pass = higher time-to-first-token), **cost** (each forward pass burns GPU compute), and **why streaming exists** (tokens come out one forward pass at a time). "Walk me through what happens when you send a prompt to an LLM" is a real interview question, and the honest answer is "a forward pass, repeated per token."

## The mechanism

The forward pass is inference — the network *using* what it learned, not learning. Data moves in one direction, input → output:

1. **Inputs enter** the first layer (features, or for an LLM, token embeddings).
2. **Each layer transforms** its input: multiply by that layer's weights, add bias, apply the activation (`out = activation(W·x + b)`). The output becomes the *next* layer's input.
3. **This repeats** through every hidden layer — each producing higher-level features.
4. **The output layer** emits the prediction — a number, or (via softmax) probabilities over classes / next tokens.

That's it. No answers, no gradients, no learning — just arithmetic flowing forward. Contrast with the **backward pass** (see **[Backprop (concept)](backprop-concept.md)**), which only happens *during training* to update weights. In production, you run forward passes all day and never a backward one.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📥 Input</span>
      <span class="darr">→</span>
      <span class="dbox purple">Layer 1</span>
      <span class="darr">→</span>
      <span class="dbox purple">Layer 2</span>
      <span class="darr">→</span>
      <span class="dbox purple">Layer N</span>
      <span class="darr">→</span>
      <span class="dbox green">📤 Prediction</span>
    </div>
  </div>
  <div class="dcap">Forward pass = one directional flow, input to output. This IS inference.</div>
</div>

**The LLM twist:** an LLM's forward pass produces probabilities for *one* next token. To write a sentence, it runs a forward pass, samples a token, appends it, and runs *another* forward pass — autoregressively, once per token. A 200-token answer = 200 forward passes. That's why longer outputs cost more and take longer, and why the model streams token by token.

## Concrete example

A two-layer forward pass, fully worked:

```python
import numpy as np

def forward(x, W1, b1, W2, b2):
    h = np.maximum(0, W1 @ x + b1)   # hidden layer + ReLU
    out = W2 @ h + b2                # output layer
    return out

x  = np.array([1.0, 2.0])
W1 = np.array([[0.5, -0.2], [0.1, 0.4]]); b1 = np.array([0.0, 0.1])
W2 = np.array([[1.0, -1.0]]);             b2 = np.array([0.5])

print(forward(x, W1, b1, W2, b2))   # -> a single prediction
```

Data goes in, flows through, prediction comes out — no labels involved. That is a forward pass, and conceptually identical to what runs (billions of weights larger) each time you hit a chat completion endpoint.

## How a company uses this

A **Dubai ride-hailing app** serving an LLM support assistant obsesses over the forward pass because it *is* their latency and cost. Each user message triggers dozens-to-hundreds of forward passes (one per generated token) on GPU. To hit a sub-2-second first response they (a) stream tokens so the user sees output after the *first* forward pass instead of waiting for all of them, (b) use **prompt caching** so the forward pass over the long, unchanging system prompt is computed once and reused, and (c) route short queries to a smaller model whose forward pass is cheaper. Every one of those optimisations is "make the forward pass do less work."

## Common mistakes

- **Confusing forward pass with training.** The forward pass alone doesn't learn anything — it just predicts. Learning needs the backward pass too.
- **Forgetting an LLM does *one forward pass per token*,** not one per response — this is the key to reasoning about latency and cost.
- **Thinking inference is free.** Each forward pass is real GPU compute; at scale it's the dominant bill.

## Interview tip

Give the walkthrough: *"A forward pass runs input through each layer — multiply, add bias, activate — until the output layer produces a prediction. For an LLM, one forward pass yields probabilities for the next token; it repeats autoregressively, one forward pass per token, which is why streaming and prompt caching matter for latency and cost."* Connecting the forward pass to production cost is exactly the AI-Engineer framing interviewers want.
