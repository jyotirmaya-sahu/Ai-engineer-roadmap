# Regularization

**What it is:** A set of techniques that deliberately hold a model back from memorising its training data — you trade a little training-set performance for much better performance on new, unseen data.

## Why it matters for an AI Engineer

Regularization is *the* answer to overfitting, so it's the natural follow-up question after "what's overfitting?" in an interview. It's also practical: when you fine-tune an LLM, the knobs that stop it from memorising your small dataset — **dropout**, **early stopping**, **weight decay** — are all regularization. Knowing them lets you fix a fine-tune that's gone stale, and lets you speak precisely instead of vaguely saying "add more data."

## The mechanism

Overfitting happens when a model becomes *too complex* and starts fitting noise (see **[overfitting / underfitting](overfitting-underfitting.md)**). Regularization pushes back by penalising complexity or injecting a little friction, so the model prefers *simpler, more general* patterns. The main tools:

- **L2 regularization (weight decay)** — add a penalty to the loss proportional to the *size of the weights* (`loss + λ·Σw²`). Big weights = a model leaning hard on specific features = a sign of memorising. The penalty nudges all weights toward small values, forcing the model to spread its bets. `λ` controls the strength.
- **L1 regularization** — penalise the *absolute* weight (`λ·Σ|w|`). This drives some weights to *exactly zero*, effectively deleting useless features (automatic feature selection).
- **Dropout** — during training, randomly "switch off" a fraction (say 20%) of neurons each step. The network can't rely on any single neuron, so it learns redundant, robust features. Turned off at inference. The workhorse for deep nets and LLMs.
- **Early stopping** — watch validation loss during training and *stop* the moment it starts rising (even while training loss keeps falling). That turning point is where memorising begins.
- **Data augmentation** — artificially expand the dataset (rotate/crop images, paraphrase text) so the model sees more variety and can't memorise.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 Model wants to memorise</span>
    <span class="darr">→<span class="lbl">regularize</span></span>
    <span class="dstack">
      <span class="dbox orange">weight decay (L2)</span>
      <span class="dbox orange">dropout</span>
      <span class="dbox orange">early stopping</span>
    </span>
    <span class="darr">→</span>
    <span class="dbox green">✅ generalises</span>
  </div>
  <div class="dcap">Regularization adds friction against memorising, so the model learns the general pattern.</div>
</div>

The unifying idea: **make it slightly harder to fit the training data perfectly, which paradoxically improves performance on data you actually care about.**

## Concrete example

Same overfitting-prone model, with and without L2 (in scikit-learn, `Ridge` = linear regression + L2; `alpha` is `λ`):

```python
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.preprocessing import PolynomialFeatures
from sklearn.metrics import mean_squared_error
# ... Xtr, ytr, Xte, yte from a noisy degree-15 polynomial fit ...

p = PolynomialFeatures(15)
Ptr, Pte = p.fit_transform(Xtr), p.transform(Xte)

plain = LinearRegression().fit(Ptr, ytr)        # overfits: test error huge
reg   = Ridge(alpha=1.0).fit(Ptr, ytr)          # L2 penalty tames the weights

print("plain test MSE:", mean_squared_error(yte, plain.predict(Pte)))  # large
print("ridge test MSE:", mean_squared_error(yte, reg.predict(Pte)))    # much smaller
```

Same degree-15 model, but the L2 penalty shrinks the wild coefficients so it stops chasing noise — test error drops sharply. In a neural net you'd reach for **dropout** and **early stopping** instead, same goal.

## How a company uses this

A **Dubai retail group** fine-tuning an LLM to write product descriptions in their brand voice had only ~2,000 examples — a recipe for overfitting, where the model would regurgitate training descriptions verbatim (a copyright and staleness risk). They applied three regularizers together: **dropout** inside the fine-tuning, **early stopping** on a validation set (training halted at epoch 3 of a planned 10, right where validation loss bottomed), and **weight decay**. The result generalised — fresh, on-brand copy for products it had never seen, instead of parroting. Without regularization the fine-tune was worse than useless.

## Common mistakes

- **Over-regularizing** — too much penalty/dropout swings you into *underfitting*; the model gets too simple. It's a dial, not a switch.
- **Applying dropout at inference.** Dropout is a *training-only* trick; leaving it on in production randomly corrupts predictions.
- **Reaching for regularization when you're underfitting.** If train and validation are both bad, you need *more* capacity, not less.
- **Ignoring the cheapest regularizer: more data.** Often more diverse data beats any clever penalty.

## Interview tip

Say: *"Regularization fights overfitting by penalising complexity so the model generalises. L2 / weight decay shrinks large weights, L1 zeros out useless features, dropout randomly disables neurons during training to force redundancy, and early stopping halts when validation loss turns up. When I fine-tune an LLM on a small dataset, dropout plus early stopping is what stops it memorising."* Naming the specific techniques *and* their fine-tuning relevance is what separates a strong answer from "add more data." See **[bias-variance](bias-variance.md)** for why this works: regularization trades a bit of bias for a large drop in variance.
