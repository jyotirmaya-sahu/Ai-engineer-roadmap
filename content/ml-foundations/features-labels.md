# Features & Labels

**What it is:** The two halves of every supervised example — **features** are the inputs you feed the model (the `X`), the **label** is the answer you want it to produce (the `y`).

## Why it matters for an AI Engineer

Framing a problem as "what are my features, what's my label?" is the fastest way to know if a task is even learnable. It also demystifies LLMs: during training an LLM's **features** are the tokens seen so far and its **label** is the next token. When you build a classifier or a fine-tune, you'll be assembling `(features, label)` pairs by hand — get this framing wrong and no amount of model tuning saves you. "Garbage in, garbage out" is really "bad features, bad model."

## The mechanism

Picture a spreadsheet. Each **row** is one example. Most columns are **features** — the descriptive inputs. One special column is the **label** — the thing you're trying to predict.

- **Features (`X`)**: the signals. For a house-price model: size, bedrooms, neighbourhood, age. For a support-ticket classifier: the ticket text (turned into numbers via embeddings). Features can be numeric (`size=120`), categorical (`neighbourhood=Marina`), or text/image turned into numbers.
- **Label (`y`)**: the answer. House price (a number → regression) or ticket category (a class → classification).

The model learns a function `f` such that `f(features) ≈ label`, then applies it to new rows where the label is unknown.

<div class="diagram">
  <div class="dstack">
    <span class="dbox gray">size · beds · area · age  →  <b>features (X)</b></span>
    <span class="dbox green">price  →  <b>label (y)</b></span>
  </div>
  <div class="dcap">Each row = one example. Many feature columns predict one label column.</div>
</div>

**Feature engineering** is the craft of turning raw data into good features: normalising numbers to a common scale, one-hot encoding categories, extracting "day of week" from a date, or embedding text into a vector. Classic ML lives or dies on this. The headline reason **deep learning** (and LLMs) took over is that neural nets *learn their own features* from raw data — you feed pixels or tokens, and internal layers discover the useful signals themselves, so you hand-engineer far less.

## Concrete example

Predicting whether a customer churns:

| tenure_months | monthly_spend | support_tickets | plan | **churned** |
|---|---|---|---|---|
| 3 | 40 | 5 | basic | **yes** |
| 36 | 120 | 0 | premium | **no** |

The first four columns are **features**; `churned` is the **label**. In code:

```python
import pandas as pd
df = pd.read_csv("customers.csv")

y = df["churned"]                      # label
X = df.drop(columns=["churned"])       # features = everything else

X = pd.get_dummies(X, columns=["plan"])  # feature engineering: encode category
# X now feeds the model; y is what it learns to predict
```

For an LLM fine-tune, the shape is the same, just as text: feature = the prompt, label = the ideal completion.

## How a company uses this

A **Dubai telecom** predicts churn to trigger retention offers. The label is simple (`churned in next 30 days: yes/no`), but their edge is **features**: they engineer 200+ of them from raw logs — call-drop rate last week, days since last top-up, roaming usage, competitor-region moves. The data team spends 80% of its effort on features, ~20% on the model, because a mediocre model on great features beats a great model on weak ones. When they later built an LLM assistant to explain churn risk, they fed those same engineered features as context — features became prompt content.

## Common mistakes

- **Leaking the label into the features.** If a "features" column is actually a consequence of the label (e.g. `cancellation_date` when predicting churn), the model cheats in training and fails live. Classic, brutal bug.
- **Forgetting to encode/scale features** — raw text or wildly different numeric ranges confuse many models.
- **Confusing "more features" with "better."** Irrelevant features add noise; relevance and quality beat quantity.

## Interview tip

Keep it concrete: *"Features are the inputs `X`, the label is the target `y`; the model learns `f(X) ≈ y`. In classic ML, feature engineering is most of the work; deep learning shifted that by learning features from raw data. The trap to avoid is label leakage — a feature that secretly encodes the answer."* Mentioning leakage unprompted signals real experience. See sibling **[Supervised vs unsupervised](supervised-vs-unsupervised.md)** — labels are exactly what supervised learning requires.
