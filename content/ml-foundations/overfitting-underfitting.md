# Overfitting / Underfitting

**What it is:** The two ways a model fails to generalise — **overfitting** is memorising the training data (great on it, terrible on new data), **underfitting** is being too simple to learn the pattern at all (bad on everything).

## Why it matters for an AI Engineer

This is the failure you'll actually diagnose. Fine-tune an LLM too hard on a small dataset and it *overfits* — it parrots your examples and loses its general ability. Give it too little signal and it *underfits* — it never learns your domain. Recognising which is happening, from the gap between training and validation scores, is a core practical skill and a guaranteed interview question. It's also the "why" behind holding out a validation set, using **[regularization](regularization.md)**, and gathering more data.

## The mechanism

A model's goal is to **generalise** — do well on data it has never seen. Two ways it misses:

- **Underfitting** — the model is too simple (too few parameters, trained too briefly, or important features missing). It can't even capture the training pattern, so it's *bad on training data and bad on new data*. High error everywhere. Analogy: a student who didn't study — fails the practice test *and* the real exam.
- **Overfitting** — the model is too complex relative to the data, so it memorises *noise and quirks* specific to the training set instead of the true underlying pattern. Result: *great on training data, poor on new data*. Analogy: a student who memorised last year's exact answer key — aces those questions, flunks the new exam.

The tell is the **gap between training and validation performance**:

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">Underfit<span class="sub">train ❌ · val ❌</span></span>
    <span class="darr">→<span class="lbl">add capacity / features</span></span>
    <span class="dbox green">Good fit<span class="sub">train ✅ · val ✅</span></span>
    <span class="darr">→<span class="lbl">too much capacity</span></span>
    <span class="dbox purple">Overfit<span class="sub">train ✅✅ · val ❌</span></span>
  </div>
  <div class="dcap">Read the gap: high error everywhere = underfit; low train but high val = overfit.</div>
</div>

- **Both errors high, close together** → underfitting → make the model *more* powerful (more capacity, better features, train longer).
- **Training error tiny but validation error much higher** → overfitting → make it *less* able to memorise (more data, regularization, early stopping, simpler model).

The sweet spot in the middle — low error on *both* — is good generalisation. This tradeoff is formalised in **[bias-variance](bias-variance.md)**: underfitting is high bias, overfitting is high variance.

## Concrete example

Fitting a curve to noisy data with polynomials of increasing degree:

```python
import numpy as np
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error

# true pattern is gently curved; data has noise
X = np.linspace(0, 1, 30).reshape(-1, 1)
y = np.sin(2 * X).ravel() + np.random.normal(0, 0.1, 30)
Xtr, Xte, ytr, yte = X[:20], X[20:], y[:20], y[20:]

for degree in [1, 4, 15]:
    p = PolynomialFeatures(degree)
    m = LinearRegression().fit(p.fit_transform(Xtr), ytr)
    tr = mean_squared_error(ytr, m.predict(p.transform(Xtr)))
    te = mean_squared_error(yte, m.predict(p.transform(Xte)))
    print(f"degree {degree:2d}: train={tr:.3f}  test={te:.3f}")
# degree 1  -> train high, test high      : UNDERFIT (too simple, a straight line)
# degree 4  -> train low,  test low        : GOOD FIT
# degree 15 -> train ~0,   test huge       : OVERFIT (memorised the noise)
```

Degree 15 nails the training points perfectly and fails the test set — the signature of overfitting.

## How a company uses this

A **Dubai insurance firm** built a fraud-detection model that scored 99.6% on training data and everyone celebrated — until it flagged barely half of real fraud in production. Classic overfitting: with only a few thousand fraud cases, a deep model had memorised those specific claims rather than learning general fraud signals. The gap between the 99.6% training score and the ~70% validation score was screaming it, but nobody had looked at validation. The fix was textbook: more data, a simpler model, and regularization (dropout + early stopping), which closed the gap to ~92%/89%. The whole incident was a failure to *watch the train-vs-validation gap*.

## Common mistakes

- **Only looking at training accuracy.** A high training score alone tells you nothing — the validation gap is the signal.
- **Assuming a bad model is always underfitting.** Poor real-world results with *great* training scores is overfitting, and the fix is the opposite.
- **Thinking more training is always better.** Past a point, more epochs just deepen overfitting — that's why **early stopping** exists.

## Interview tip

Say: *"Underfitting is too simple — high error on both training and validation. Overfitting is memorising the training data — low training error but high validation error. I diagnose by the gap between train and validation scores: close and high means underfit, wide means overfit. The overfit fix is more data, regularization, or a simpler model; the underfit fix is more capacity or better features."* Add the LLM angle — *"over-fine-tuning an LLM on a small set overfits and erodes its general ability"* — to show it's not just textbook to you.
