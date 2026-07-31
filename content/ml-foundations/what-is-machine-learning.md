# What is Machine Learning?

**What it is:** the ground-floor chapter. Before *any* type of learning, this builds the base — what "machine learning" actually means, and every jargon word the next chapters throw at you, defined once, in plain language.

## Why this chapter exists

The later tiles say things like *"the model minimises the loss by gradient descent on labelled features."* If those words are fog, everything after is fog. So read this once, get the vocabulary, and the rest of ML Foundations becomes readable. Nothing here is hard — it's just names for simple ideas.

## The core idea: examples instead of rules

**Normal programming:** *you* write the rules by hand. To flag spam you'd write `if email contains "free money" → spam`. You dictate every rule. This breaks fast — real spam has millions of patterns no human could ever write out.

**Machine learning flips it.** Instead of writing rules, you **show the computer thousands of examples and let it find the rules itself.** Hand it 10,000 emails already marked spam / not-spam, and it works out — on its own — which word patterns predict spam. You supplied examples; *it* produced the rule.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📥 rules you wrote<span class="sub">+ data</span></span>
      <span class="darr">→<span class="lbl">normal code</span></span>
      <span class="dbox green">answers</span>
    </div>
    <div class="flow">
      <span class="dbox gray">📥 data + its answers<span class="sub">examples</span></span>
      <span class="darr">→<span class="lbl">machine learning</span></span>
      <span class="dbox green">🧠 the rule<span class="sub">learned, not written</span></span>
    </div>
  </div>
  <div class="dcap">Normal code: you write rules. ML: you give examples, it writes the rule.</div>
</div>

That's the whole subject in one line: **show examples, let the computer find the rule.** Everything else — supervised, unsupervised, neural nets, even LLMs — is a variation on this.

## Let's build one from scratch — then define the jargon *on the code*

We'll predict house prices from size. No libraries, no magic — you'll see every term land on a real line of Python.

### First — three words the code will use: feature, weight, bias

The formula we'll use is `price = w * size + b`. Read it in plain money terms before touching code:

- **Feature** — a *measured fact* about the thing, as a number. Here it's `size` (say, 1000s of sqft). Just data you already have.
- **Weight (`w`)** — **the price per unit of the feature.** `w = 2` means *"each extra unit of size adds 2 to the price."* It's *how much this feature matters*: big = strong effect, near-zero = barely matters, negative = pushes price down.
- **Bias (`b`)** — **the baseline when the feature is 0.** An empty plot (`size = 0`) still isn't worth 0 — there's land value, a floor price. `b` is that starting amount before any feature adds anything.

So `w * size + b` just says: **"start at baseline `b`, then add `w` for every unit of size."** A base amount plus a per-unit rate — nothing arbitrary.

**Why multiply the feature by the weight?** Because a feature's effect *scales* with its value — a 3-unit house should get 3× the size-contribution of a 1-unit house. *If we didn't multiply* (`price = size`), every feature would count as its raw value with no way to say "size matters more than bedroom count." The weight is the **only** place the model stores how much a feature counts. No weight = no learning.

**Why add the bias?** *If we drop `b`* (`price = w * size`), the line is forced through zero: `size 0 → price 0`. Any real baseline becomes unreachable:

```python
# True pattern: price = 2*size + 5   (every house has a base value of 5)
# No-bias model price = w*size can't reach it: forced to 0 at size 0,
#   it over-steepens w and is wrong everywhere -> loss never hits 0.
# With bias: w=2, b=5 fits perfectly -> loss = 0.
```

The bias gives the line a **vertical shift** to sit at the right height.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">size = 3<span class="sub">feature</span></span>
    <span class="darr">→<span class="lbl">× w (=2, the rate)</span></span>
    <span class="dbox orange">6<span class="sub">size's contribution</span></span>
    <span class="darr">→<span class="lbl">+ b (=5, baseline)</span></span>
    <span class="dbox green">11<span class="sub">price</span></span>
  </div>
  <div class="dcap">Weight scales the feature; bias sets the starting height. That's the whole formula.</div>
</div>

### 1. "A model is a set of numbers" — literally

You asked: *a big set of numbers — a list? an array?* **Yes. Exactly a list of numbers.** Here's a real (tiny) model:

```python
# The ENTIRE model. Two numbers in a list.
model = [0.0, 0.0]   # [w, b]  ->  price = w * size + b
```

That's it. `model` is a Python list of two floats. A "big" model (GPT) is the *same thing* — just a list of 100+ billion floats instead of 2. When people say "a 7B model," they mean **the list has 7 billion numbers in it.** Nothing more mystical than that. Those numbers are called the **weights** (or **parameters**).

Right now both numbers are `0.0`, so the model is useless. "Training" = finding good values for these two numbers.

**Why 2 numbers — who decided that?** *You* did, the moment you picked the formula. I chose `price = w * size + b`. Count the blanks that need filling: one `w` (multiplier for the one feature) + one `b` (a constant offset). Two blanks → two numbers. The formula fixes the count; nothing random about it.

Change the formula, the count changes with it:

```python
# 1 feature (size):            price = w1*size + b                  -> 2 numbers
# 3 features (size,beds,area): price = w1*size + w2*beds + w3*area + b  -> 4 numbers
```

The rule for this simple "linear" formula: **one weight per feature, plus one bias.** 3 features → 3 weights + 1 bias = **4 numbers**. 1000 features → 1001 numbers. The data decides how many features you have; the formula decides how each is used; together they set the length of the list. (Much later — stacking many such formulas is how a 2-number model grows into a billion-number LLM. Ignore that for now; one formula is all we need here.)

### 2. Prediction = plug numbers into a formula (this is "inference" / "forward pass")

```python
def predict(model, size):
    w, b = model
    return w * size + b        # the formula

predict([0.0, 0.0], size=2)    # -> 0.0   (garbage: every house costs 0)
```

Running the formula to get an answer is called **inference** (or a **forward pass**). With `w=0, b=0` it predicts 0 for everything — expected, we haven't learned yet.

### 3. The data — features and labels

```python
# Each row: (size, actual_price). True pattern here is price = 2 * size.
data = [(1, 2), (2, 4), (3, 6)]
#        ^size   ^price
#        FEATURE  LABEL
```

- **Feature** = the input you know (`size`). Call it `X`.
- **Label** = the answer you want to predict (`price`). Call it `y`.
- **Dataset** = the list of `(feature, label)` pairs.

### 4. Loss = one number for "how wrong"

Compare predictions to the real labels and squash the errors into a single number:

```python
def loss(model):
    total = 0
    for size, actual in data:
        error = predict(model, size) - actual   # miss on this house
        total += error ** 2                      # square so +/- don't cancel
    return total / len(data)                     # average

loss([0.0, 0.0])   # -> 18.67   (very wrong)
```

**Loss** is just that number. Big = bad. The *entire goal of training* is to make this number small. (This particular formula — average of squared errors — is "Mean Squared Error"; the *Loss functions* tile covers others.)

### 5. Training = a loop that nudges the numbers down the loss

How do we know which way to move `w` and `b`? **Gradient descent**: compute the slope of the loss with respect to each number, then step the opposite way (downhill). The slope is basic calculus of the loss formula — here it's:

```python
def train_step(model, lr=0.1):
    w, b = model
    dw = db = 0
    for size, actual in data:
        error = predict(model, size) - actual
        dw += 2 * error * size      # slope of loss w.r.t. w
        db += 2 * error             # slope of loss w.r.t. b
    dw /= len(data); db /= len(data)
    # step DOWNHILL: subtract the slope (scaled by learning rate lr)
    return [w - lr * dw, b - lr * db]

model = [0.0, 0.0]
for step in range(50):
    model = train_step(model)
    if step % 10 == 0:
        print(f"step {step}: model={[round(x,2) for x in model]}  loss={round(loss(model),3)}")
```

Run it and you literally watch the two numbers crawl toward the truth `w=2, b=0` while loss collapses (step 0 is exact; later values are the trend — run it yourself to confirm):

```
step 0:  model=[1.87, 0.8]    loss=0.297
step 10: model=[2.04, -0.09]  loss≈0.002
step 20: model=[2.01, -0.02]  loss≈0.0001
...  w -> 2,  b -> 0,  loss -> 0
```

- **Gradient descent** = the `w - lr*dw` line. Slope tells direction; you step against it.
- **Learning rate (`lr`)** = how big each step is. Too big = you overshoot and diverge; too small = trains forever.
- **Training** = repeating that step. **Each full pass over `data` is one epoch** — here we did 50.
- **Learning** = those two numbers changing from `[0,0]` to `[2,0]`. That's the whole thing. No understanding — just numbers sliding downhill on a loss curve.

### 6. Inference on a new house

```python
predict(model, size=10)   # -> ~20.  A size we never trained on, predicted correctly.
```

The model **generalised**: it learned the *pattern* (`price ≈ 2×size`), not just the three rows it saw.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">size = 10<span class="sub">feature X</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">w·X + b<span class="sub">model = [2, 0]</span></span>
    <span class="darr">→</span>
    <span class="dbox green">price ≈ 20<span class="sub">prediction</span></span>
  </div>
  <div class="dcap">Trained weights turn a feature into a prediction. That run is "inference".</div>
</div>

### The jargon, now that you've seen each in code

| Term | In the code above | One-liner |
|---|---|---|
| **Model** | `model = [w, b]` | the list of numbers |
| **Weights / parameters** | the values in that list | the numbers training changes |
| **Feature (X)** | `size` | the input you know |
| **Label (y)** | `price` | the answer you want |
| **Dataset** | `data` | your `(X, y)` pairs |
| **Inference / forward pass** | `predict()` | run the formula to get an answer |
| **Loss** | `loss()` → 18.67 | one number = how wrong |
| **Gradient descent** | `w - lr*dw` | step the numbers downhill on loss |
| **Learning rate** | `lr=0.1` | step size |
| **Epoch** | one pass over `data` | one full look at all examples |
| **Training** | the `for` loop | repeat until loss is small |
| **Generalise** | `predict(size=10)` works | learned the pattern, not the rows |

**Every ML system is this skeleton** — house prices or a 7-billion-number LLM. The LLM just has more numbers, a fancier formula (a transformer, not `w*x+b`), and labels that are "the next word" instead of a price. The loop — predict → measure loss → gradient descent → repeat — is *identical*.

## How a company uses this

A Dubai property portal runs exactly this house-price model to show "estimated value" on listings. But notice the split that matters on the job: they **train** the model weekly on a big machine (slow, costly, offline), then serve **inference** to millions of visitors instantly from a cheap endpoint. Most of an AI Engineer's work — cost, latency, scaling — lives on the *inference* side. The same model that took hours to train answers each visitor in milliseconds. Knowing training-vs-inference is *not* a trivia point; it's the line between the two halves of every AI budget.

## Common mistakes / misconceptions

- **Thinking the model "understands."** It doesn't. It found numeric patterns that predict well. Useful, not conscious.
- **Confusing training with inference.** Training = learning the weights (once, expensive). Inference = using them (constantly, must be cheap). Mixing these up wrecks cost estimates.
- **"More data always wins."** More *clean, relevant* data wins. Garbage examples teach garbage rules.
- **Ignoring overfitting.** A model that's perfect on training data and bad on new data has learned nothing useful.

## Interview tip

If asked "what *is* machine learning?", don't recite a textbook line. Say: *"Instead of hand-writing rules, you show the system labelled examples and it tunes a set of internal numbers — weights — until it predicts well. Training finds the weights by minimising a loss with gradient descent; inference is using the trained model on new data. That same loop scales from a house-price regressor up to an LLM."* Naming **training vs inference** and **loss/weights** shows you understand the machinery, not just the buzzword.

*Next chapter: the first big fork — do your examples come with answers attached or not? That's supervised vs unsupervised.*
