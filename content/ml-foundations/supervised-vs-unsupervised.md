# Supervised vs Unsupervised

**What it is:** The two big families of machine learning — one learns from examples that come *with the answers* (supervised), the other finds structure in data that has *no answers attached* (unsupervised).

## Why it matters for an AI Engineer

This is the first fork in the road for any ML problem, and interviewers ask it as a warm-up. More usefully, it clarifies what modern AI actually is. An LLM's pre-training is **self-supervised** (a clever twist on supervised where the "label" is the next word, generated for free from raw text). Its fine-tuning is **supervised** (curated question → answer pairs). Embeddings and clustering — the backbone of RAG and analytics — lean **unsupervised**. Knowing which family a task belongs to tells you what data you need and how you'll measure success.

## The mechanism

**Supervised learning** trains on labelled pairs: each input `X` comes with the correct output `y`. The model's job is to learn the mapping `X → y` so it can predict `y` for new, unseen `X`. Two sub-types:
- **Classification** — the label is a category (spam / not-spam, which of 5 ticket types).
- **Regression** — the label is a number (house price, tomorrow's demand).

The word "supervised" is literal: a teacher (the labels) tells the model when it's wrong, and the model adjusts. You need labelled data, which is often the expensive part.

**Unsupervised learning** gets only `X` — no `y`. There's no answer key, so the model instead finds *structure*:
- **Clustering** — group similar items (customer segments, similar documents).
- **Dimensionality reduction** — compress many features into a few (PCA, and conceptually, embeddings).
- **Anomaly detection** — flag points that don't fit the rest (fraud).

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">🏷️ Labelled data<span class="sub">X + y</span></span>
      <span class="darr">→</span>
      <span class="dbox purple">Supervised</span>
      <span class="darr">→</span>
      <span class="dbox green">predict the label</span>
    </div>
    <div class="flow">
      <span class="dbox gray">📦 Unlabelled data<span class="sub">X only</span></span>
      <span class="darr">→</span>
      <span class="dbox purple">Unsupervised</span>
      <span class="darr">→</span>
      <span class="dbox green">find groups / structure</span>
    </div>
  </div>
  <div class="dcap">The presence or absence of labels decides which family you're in.</div>
</div>

There's also **self-supervised** (labels invented from the data itself — "predict the masked/next token") and **reinforcement learning** (learn from rewards, not labels) — mention them to sound complete.

## Concrete example

Same 10,000 support tickets, two different problems:

- **Supervised:** you've *manually tagged* 10,000 tickets as `billing`, `technical`, or `account`. Train a classifier so ticket #10,001 gets auto-routed. Success = accuracy on held-out tagged tickets.
- **Unsupervised:** you have the 10,000 tickets but *no tags*. Embed them and run k-means clustering; the algorithm discovers, say, 5 natural groups. You then eyeball each cluster and name it. Success is fuzzier — "do these groups make business sense?"

Notice: supervised answers *"which known category?"*; unsupervised answers *"what natural groups even exist?"*.

## How a company uses this

A **Dubai e-commerce platform** runs both daily. **Supervised:** a demand-forecasting model (regression) predicts tomorrow's orders per SKU from historical sales, weather, and promo flags — trained on years of labelled `(features → actual sales)` rows, retrained weekly, serving predictions to the warehouse team. **Unsupervised:** a nightly clustering job segments millions of shoppers into behavioural groups for marketing, with *no* predefined labels — the segments emerge from purchase patterns. The forecasting model is judged on error in AED; the segmentation is judged by whether marketing campaigns to each segment convert better. Different data requirements, different success metrics, same platform.

## Common mistakes

- **Thinking unsupervised needs no evaluation.** It does — just a harder, more human one. "No labels" doesn't mean "no judgement of quality."
- **Calling LLM pre-training "unsupervised."** It's *self-supervised* — there are labels (the next token), they're just free.
- **Forcing a supervised frame when you have no labels.** If you can't get labels affordably, an unsupervised or clustering approach may be the honest answer.

## Interview tip

Give the crisp version: *"Supervised learns a mapping from labelled `X → y` — classification for categories, regression for numbers. Unsupervised finds structure in unlabelled data — clustering, dimensionality reduction, anomaly detection. LLM pre-training is self-supervised, which is supervised with free next-token labels."* Then connect it: *"For RAG I lean on unsupervised-style embeddings; for a fine-tuned classifier I need labelled data."* That last line shows you map theory onto the AI-Engineer job.
