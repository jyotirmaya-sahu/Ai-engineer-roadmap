# ML Foundations

**The one-line idea:** Machine learning is teaching a program to find patterns from examples instead of you hand-writing the rules — and this node gives you *just enough* of the theory to talk about it confidently in an interview.

## Why we even need it

You are going to be an **AI Engineer** — you'll spend your days calling LLM APIs, building RAG pipelines, and wiring up agents. You will almost never train a neural net from scratch. So why learn the theory at all?

Because the vocabulary is everywhere. An LLM *is* a giant neural network trained by gradient descent. "Fine-tuning" is training. "Overfitting" is why your fine-tuned model memorised the training set and got dumber. When a hiring manager asks *"what's a loss function?"* or *"why does temperature exist?"*, they're checking that you understand the machine under the API — not that you can derive backpropagation on a whiteboard. This node is **theory · light** on purpose: enough to reason and talk, not a math degree.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📊 Examples<span class="sub">features + labels</span></span>
    <span class="darr">→<span class="lbl">train</span></span>
    <span class="dbox purple">🧠 Model<span class="sub">adjusts weights</span></span>
    <span class="darr">→<span class="lbl">predict</span></span>
    <span class="dbox green">✅ New answers</span>
  </div>
  <div class="dcap">All of ML: show examples, let the model tune itself to minimise error, then use it on unseen data.</div>
</div>

## Why it matters for an AI Engineer

Three concrete payoffs:

1. **You debug LLM behaviour better.** Knowing that a model minimises a loss over training data explains hallucinations, why fine-tuning can overfit, and why more data usually beats a cleverer prompt.
2. **You pass the theory round.** Most Dubai AI Engineer loops have one "fundamentals" screen. It's shallow but binary — miss "what's the difference between validation and test set?" and you look junior.
3. **You speak the same language as ML/DS colleagues.** In a real team you'll sit next to data scientists. Bias-variance, regularization, and generalization are their daily words.

## The tiles, and when to reach for each

| Tile | Core idea | When it comes up |
|---|---|---|
| **[What is machine learning?](ml-foundations/what-is-machine-learning.md)** | examples instead of rules + all the jargon | **start here** — the base every tile below assumes |
| **[Supervised vs unsupervised](ml-foundations/supervised-vs-unsupervised.md)** | learn from labels vs find structure | first thing anyone asks about a problem |
| **[Train / validation / test](ml-foundations/train-validation-test.md)** | three data splits, three jobs | any honest evaluation, incl. LLM evals |
| **[Features & labels](ml-foundations/features-labels.md)** | inputs (X) and the answer (y) | framing any prediction task |
| **[Loss functions](ml-foundations/loss-functions.md)** | the number training tries to shrink | understanding what "training" optimises |
| **[Neurons & layers](ml-foundations/neurons-layers.md)** | the building block of every net | explaining what an LLM is made of |
| **[Activation functions](ml-foundations/activation-functions.md)** | the non-linearity that gives power | why nets beat linear models |
| **[Forward pass](ml-foundations/forward-pass.md)** | data flowing in → prediction out | this is literally LLM inference |
| **[Gradient descent](ml-foundations/gradient-descent.md)** | walk downhill to smaller loss | how *all* training works |
| **[Backprop (concept)](ml-foundations/backprop-concept.md)** | assign blame for the error, layer by layer | the one deep-learning idea to name-drop |
| **[Overfitting / underfitting](ml-foundations/overfitting-underfitting.md)** | memorising vs missing the pattern | diagnosing a bad fine-tune |
| **[Regularization](ml-foundations/regularization.md)** | penalise complexity to generalise | the fix for overfitting |
| **[Bias-variance](ml-foundations/bias-variance.md)** | the tradeoff behind both | the "senior" framing of model error |

## Real world: how a company uses this

> **A Dubai fintech** fine-tuned an open model to classify Arabic customer-support tickets. Their first run hit 99% accuracy on training data but 71% on real tickets — a textbook **overfitting** case caught only because they'd held out a proper **test set**. They added **regularization** (dropout + early stopping) and more varied examples; the gap closed to 94%/91%. Nobody derived a single equation — they just knew the concepts well enough to name the failure and fix it. That is exactly the level this node targets.

## Interview tip

Frame yourself right: *"I'm an AI Engineer, so I work at the API and application layer — but I understand the machine underneath. I know an LLM is a neural net trained by gradient descent to minimise a loss, I know why we split data into train/validation/test, and I can spot overfitting versus underfitting in an eval. I don't derive backprop, but I can explain what it does and why it matters."* That sentence tells an interviewer you're grounded without pretending to be a research scientist.

---

*Below: deep-dive articles on each foundation concept.*
