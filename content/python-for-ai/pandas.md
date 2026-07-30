# Pandas

**The one-line idea:** Pandas is a spreadsheet inside Python. Its `DataFrame` is a table of rows and columns you can load, filter, and analyze with a few lines — perfect for datasets, evaluation results, and prepping data for LLMs.

## Why this matters for an AI Engineer

You constantly wrangle tabular data: an eval dataset of test questions + expected answers, a CSV of LLM outputs to score, logs of latency and cost per call, labeled examples for prompt tuning. Pandas loads, filters, and summarizes all of it in a handful of readable lines. When you evaluate a RAG system — "what's the average faithfulness score, and which questions scored below 0.7?" — that analysis *is* Pandas. It's the default tool for any "data in a table" task.

## The DataFrame

A `DataFrame` is a 2-D table; each column is a `Series`. You usually load one from a file.

```python
import pandas as pd

# From a CSV file (the common case)
df = pd.read_csv("eval_results.csv")

# Or build one directly from a dict of columns
df = pd.DataFrame({
    "question":    ["How long is the visa?", "Refund window?", "Office hours?"],
    "score":       [0.92, 0.45, 0.88],
    "model":       ["gpt-5", "gpt-5", "gpt-5-mini"],
})

df.head()        # first 5 rows
df.shape         # (3, 3) -> rows, columns
df.columns       # Index(['question', 'score', 'model'])
df.describe()    # count, mean, min, max for numeric columns
```

`read_csv` also has siblings: `read_json`, `read_parquet`, `read_excel` — same idea, different formats.

## Selecting columns and rows

```python
df["score"]                 # one column (a Series)
df[["question", "score"]]   # multiple columns (a DataFrame)

df.iloc[0]                  # first row by POSITION
df.loc[0, "score"]          # value at row label 0, column "score"
```

## Filtering — the everyday operation

You select rows with a **boolean condition** in square brackets. This is how you answer "which rows meet X?"

```python
# Rows where the model scored poorly
low = df[df["score"] < 0.7]

# Combine conditions with & (and) / | (or) — each condition in ()
bad_mini = df[(df["score"] < 0.7) & (df["model"] == "gpt-5-mini")]

# "is it one of these?"
subset = df[df["model"].isin(["gpt-5", "gpt-5-mini"])]
```

`df["score"] < 0.7` produces a column of True/False; putting it in `df[...]` keeps only the True rows. That one pattern covers most filtering you'll do.

## Adding columns and transforming

```python
# New column from a calculation on existing ones
df["passed"] = df["score"] >= 0.7

# Apply a function to each value (e.g., length of each question)
df["q_len"] = df["question"].apply(len)

# Vectorized string ops
df["model_upper"] = df["model"].str.upper()
```

## Grouping and aggregating — the analysis payoff

`groupby` splits rows into groups and computes a summary per group. This is how you compare models, categories, or dates at a glance.

```python
# Average score per model
df.groupby("model")["score"].mean()
# model
# gpt-5         0.685
# gpt-5-mini    0.880

# Multiple stats at once
df.groupby("model")["score"].agg(["mean", "min", "count"])
```

In one line you've answered "which model performs best on our eval set?" — the exact question you ask when comparing prompts or models.

## Reading and writing files

```python
df = pd.read_csv("results.csv")     # load
# ... analyze / filter ...
df.to_csv("filtered.csv", index=False)   # save (index=False omits the row numbers)
```

## Real world: how a company uses this

> **A Dubai AI team** evaluates their customer-support RAG bot on a 500-question test set. They run the bot, save each answer with its RAGAS faithfulness and relevancy scores to a CSV, then load it in Pandas. In a few lines they compute the average scores, `groupby` question-category to see which topics the bot handles worst (e.g., "billing" scores lowest), and filter `df[df["faithfulness"] < 0.7]` to pull the exact failing questions for manual review. When they test a new prompt, they diff the two result CSVs in Pandas to prove it actually improved. That filter-and-aggregate loop is their entire eval workflow — and it's pure Pandas.

## Common mistakes

- Forgetting parentheses around conditions: `df[df.a > 1 & df.b < 2]` fails; write `df[(df.a > 1) & (df.b < 2)]`.
- Using Python `and`/`or` instead of `&`/`|` on Series — raises an error; Pandas needs the bitwise operators.
- Chained assignment (`df[df.x > 1]["y"] = 0`) silently not working — use `df.loc[df.x > 1, "y"] = 0`.
- Looping over rows with `for` when a vectorized column operation or `groupby` would be far faster and cleaner.
- `read_csv` without checking `dtype` — a numeric column with a stray text value loads as strings, breaking math.

## Interview tip

Say: *"For any tabular data — eval results, LLM output logs, labeled datasets — I use Pandas: `read_csv` to load, boolean filtering to isolate rows like the low-scoring answers, and `groupby().agg()` to compare models or categories. My RAG evaluation loop is basically loading a results CSV and aggregating the scores."* Framing Pandas around *LLM evaluation and dataset prep* (not generic "data analysis") shows you use it where an AI Engineer actually does.
