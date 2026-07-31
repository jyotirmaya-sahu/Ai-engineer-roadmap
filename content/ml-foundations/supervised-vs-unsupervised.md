# Supervised vs Unsupervised

**What it is:** The two big families of machine learning — one learns from examples that come *with the answers* (supervised), the other finds structure in data that has *no answers attached* (unsupervised).

> **Assumed base:** this chapter builds on *What is Machine Learning?* — if "model," "weights," "training," "loss," or "gradient descent" are fuzzy, read that first. Here we take the next step: the **one question** that splits ML into two families — *do your examples come with the answers attached, or not?*

## The one analogy that makes it click

Imagine two ways to learn.

**Supervised = studying with flashcards.** Each card has a **question on the front and the answer on the back**. You look at the front, guess, flip the card, and check. Wrong? You correct yourself. After 10,000 cards you can answer a *new* question you've never seen — because you learned the pattern from answer-checked examples. The "answers on the back" are called **labels**. Someone had to write them first (that's the expensive part).

**Unsupervised = tidying a messy drawer nobody labelled.** No answer key. You just tip everything out and start making piles: socks here, cables there, receipts in a corner. Nobody told you those piles exist — you *discovered* them because the items naturally group. That's it. No right answer, just structure you found.

That is the whole distinction: **do your training examples come with answers attached, or not?**

## Why it matters for an AI Engineer

This is the first fork in the road for any ML problem, and interviewers ask it as a warm-up. More usefully, it tells you two things the moment you spot the family: *what data you must collect*, and *how you'll know it worked*.

It also quietly explains how a chatbot like ChatGPT got built — in three stages, each a different family. Don't worry about the exact terms yet (later articles cover them); just see how each stage maps to flashcards vs. piles:

| Stage of building an LLM | Family | In plain words | Tiny example |
|---|---|---|---|
| **Pre-training** (read the whole internet) | self-supervised | Hide the next word, guess it, check. Answer comes free from the text — no humans writing labels. | Text says *"The capital of France is ___"*. Model guesses, real word is **Paris**, it checks itself. Repeat a trillion times. |
| **Fine-tuning** (make it follow instructions) | supervised | Humans write question → good-answer pairs (real flashcards) and train on them. | A human writes: Q *"Write a polite refund email"* → A *"Dear customer, …"*. Model trains to copy that style. |
| **Embeddings / clustering** (the search behind RAG) | unsupervised | Turn text into vectors and let similar things fall into piles — no answer key. | 10,000 support tickets, no tags. Similar ones auto-group: a "login problems" pile forms on its own. |

So one model touches **all three families** at different steps. That's why this "simple" distinction is worth nailing.

### How does it "check itself"?

Forget metaphors. Inside, it's **just numbers being multiplied and added**. Let's do one real loop by hand with a 3-word model, so you see exactly what "the model" and "learning" physically are.

**What the model actually is.** Two things, both just numbers:

1. The context "…France is" gets turned into a short list of numbers — a **vector**. Say it becomes `h = [1, 2]`. (Earlier layers produce this; treat it as given — it's the digested meaning of the words so far.)
2. Every word the model knows owns its own little list of numbers, called its **weights**. These start random:

    - Paris → `[0.1, 0.2]`
    - London → `[0.3, 0.1]`
    - banana → `[0.5, 0.4]`

That's the entire "model" here: the context numbers `h`, and one weight-list per word. **Nothing else.** No knobs, no magic — literally these numbers.

**Step ①  — Score each word (multiply + add).** The score for a word = multiply `h` by that word's weights, position by position, and add. This is a **dot product**:

- Paris:  `1×0.1 + 2×0.2 = 0.5`
- London: `1×0.3 + 2×0.1 = 0.5`
- banana: `1×0.5 + 2×0.4 = 1.3`

These raw scores are called **logits**. banana scored highest (1.3) — the model is currently wrong.

**Step ②  — Turn scores into percentages (softmax).** Logits aren't percentages yet. A step called **softmax** does two things: makes every number positive (via `e^x`) and rescales them to sum to 100%:

`e^0.5 = 1.65`,  `e^0.5 = 1.65`,  `e^1.3 = 3.67`  →  total `6.97`

- Paris:  `1.65 / 6.97 = 24%`
- London: `1.65 / 6.97 = 24%`
- banana: `3.67 / 6.97 = 53%`  ← its (wrong) top pick

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">context<span class="sub">h = [1, 2]</span></span>
    <span class="darr">→<span class="lbl">×weights, add</span></span>
    <span class="dbox orange">logits<span class="sub">0.5 / 0.5 / 1.3</span></span>
    <span class="darr">→<span class="lbl">softmax</span></span>
    <span class="dbox green">%<span class="sub">24 / 24 / 53</span></span>
  </div>
  <div class="dcap">The whole forward pass: numbers in → multiply/add → logits → softmax → percentages.</div>
</div>

**Step ③  — The real answer + the miss (loss).** The book's next word is **Paris**. So the *target* is: Paris should be 100%, others 0%. The model gave Paris only **24%**. The standard wrongness number is `loss = −ln(0.24) = 1.44`. (`−ln` just means "the lower the % on the right word, the bigger the number." If Paris had been 90%, loss would be `−ln(0.90) = 0.10` — nearly zero.)

**Step ④  — Fix the weights (this is "learning").** Here's the actually-simple rule hiding under "backpropagation." For each word, compute one error number = **its % minus its target**:

- Paris:  `0.24 − 1 = −0.76`  (negative = "too low, push up")
- London: `0.24 − 0 = +0.24`  (positive = "too high, push down")
- banana: `0.53 − 0 = +0.53`  (most wrong, push down hardest)

Now update each word's weights with: **new = old − (0.1 × error × h)**. The `0.1` is the **learning rate** (step size); `h = [1,2]` is the same context vector:

- Paris:  `[0.1, 0.2] − 0.1×(−0.76)×[1,2] = [0.1, 0.2] + [0.076, 0.152] = [0.176, 0.352]`  ← went **up**
- banana: `[0.5, 0.4] − 0.1×(+0.53)×[1,2] = [0.5, 0.4] − [0.053, 0.106] = [0.447, 0.294]`  ← went **down**

That's it. That subtraction *is* the learning. Do it for every word at once. ("Backpropagation" is just the bookkeeping that produces those error numbers for *every* layer; the update itself is this subtraction.)

**Step ⑤  — Re-score with the new weights.** Same sentence, recompute logits with the updated numbers:

- Paris:  `1×0.176 + 2×0.352 = 0.88`  (was 0.5)
- banana: `1×0.447 + 2×0.294 = 1.04`  (was 1.3)

Softmax again → **Paris = 36%, banana = 42%**.

<div class="diagram">
  <div class="dstack">
    <span class="dbox green">Paris<span class="sub">24% → 36%  ▲</span></span>
    <span class="dbox orange">banana<span class="sub">53% → 42%  ▼</span></span>
  </div>
  <div class="dcap">One update: multiply, score the miss, subtract. Paris rose 12 points.</div>
</div>

**That is literally all that happens:** vector in → multiply by each word's weights → softmax to percentages → subtract to shrink the miss. One pass moved Paris 24%→36%. Now do it on the next sentence, and the next, **trillions of times** across the internet. "The capital of Japan is ___" nudges the same weights toward Tokyo; "Water boils at 100 ___" toward degrees. Billions of tiny subtractions later, the weights encode facts and grammar — and Paris sits near 95%. No teacher graded anything: the book supplied the answer, arithmetic did the rest. *That* is "checking itself."

The *only* difference for **supervised** learning is Step ③'s target. Instead of the next word from the text, **a human wrote the desired answer** (Q "polite refund email" → A the ideal email). Every other step — multiply, softmax, subtract — is identical.

## The mechanism — spelled out

**Supervised learning.** Every training example is a **pair**: an input `X` and its correct answer `y`. The model guesses, compares its guess to `y`, sees how wrong it was, and nudges itself to be less wrong. Repeat millions of times. Two flavours, split only by *what kind of answer* `y` is:
- **Classification** — `y` is a **category**: spam / not-spam, or which of 5 ticket types.
- **Regression** — `y` is a **number**: house price, tomorrow's demand.

The catch: you need someone to *write the answers first*. Labelling 10,000 examples by hand is slow and costs money. That's the price of supervised learning.

**Unsupervised learning.** Every example is **just `X`** — no answer attached. With no answer key to check against, the model can't "predict the right label." Instead it finds **structure** — the natural piles:
- **Clustering** — group similar items (customer segments, similar documents).
- **Dimensionality reduction** — squeeze many features into a few (PCA; embeddings are cousins of this).
- **Anomaly detection** — flag the odd one out (fraud, a broken sensor).

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">🃏 Input + answer<span class="sub">X and y (the label)</span></span>
      <span class="darr">→<span class="lbl">learn X→y</span></span>
      <span class="dbox purple">🧠 Supervised</span>
      <span class="darr">→</span>
      <span class="dbox green">✅ predict the answer<span class="sub">for new X</span></span>
    </div>
    <div class="flow">
      <span class="dbox gray">🧦 Input only<span class="sub">X, no answers</span></span>
      <span class="darr">→<span class="lbl">find piles</span></span>
      <span class="dbox purple">🧠 Unsupervised</span>
      <span class="darr">→</span>
      <span class="dbox green">📦 groups / structure<span class="sub">discovered, not given</span></span>
    </div>
  </div>
  <div class="dcap">One question decides the family: do the examples come with answers (top) or not (bottom)?</div>
</div>

**The sneaky third option: self-supervised.** LLMs use a trick. Take any sentence, hide the last word, and ask the model to predict it. The hidden word *is* the answer — but nobody wrote it by hand; it came free from raw text off the internet. So it *runs* like supervised (there's a right answer to check), but costs nothing to label. That's how you train on trillions of words. (There's also **reinforcement learning** — learn from rewards/scores instead of answers — name it to sound complete.)

## Concrete example — same 10,000 tickets, two problems

- **Supervised:** you *manually tag* 10,000 support tickets as `billing`, `technical`, or `account`. Train a classifier. Now ticket #10,001 gets auto-routed to the right team. You measure success as **accuracy** on tagged tickets you held back — a clean number.
- **Unsupervised:** you have the 10,000 tickets but *no tags*. Embed them, run k-means clustering, and the algorithm discovers ~5 natural piles. You read a few from each pile and name them yourself. Success is fuzzier — *"do these groups make business sense?"*

The tell: supervised answers *"which of my known categories?"*; unsupervised answers *"what groups even exist in here?"*.

## How a company uses this

A **Dubai e-commerce platform** runs both daily. **Supervised:** a demand-forecasting model (regression) predicts tomorrow's orders per SKU from historical sales, weather, and promo flags — trained on years of labelled `(features → actual sales)` rows, retrained weekly, serving predictions to the warehouse team. **Unsupervised:** a nightly clustering job segments millions of shoppers into behavioural groups for marketing, with *no* predefined labels — the segments emerge from purchase patterns. The forecasting model is judged on error in AED; the segmentation is judged by whether marketing campaigns to each segment convert better. Different data requirements, different success metrics, same platform.

## Common mistakes

- **Thinking unsupervised needs no evaluation.** It does — just a harder, more human one. "No labels" doesn't mean "no judgement of quality."
- **Calling LLM pre-training "unsupervised."** It's *self-supervised* — there are labels (the next token), they're just free.
- **Forcing a supervised frame when you have no labels.** If you can't get labels affordably, an unsupervised or clustering approach may be the honest answer.

## Interview tip

Give the crisp version: *"Supervised learns a mapping from labelled `X → y` — classification for categories, regression for numbers. Unsupervised finds structure in unlabelled data — clustering, dimensionality reduction, anomaly detection. LLM pre-training is self-supervised, which is supervised with free next-token labels."* Then connect it: *"For RAG I lean on unsupervised-style embeddings; for a fine-tuned classifier I need labelled data."* That last line shows you map theory onto the AI-Engineer job.
