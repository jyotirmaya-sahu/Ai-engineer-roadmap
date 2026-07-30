# Sparse Retrieval (BM25 / TF-IDF)

**The one-line idea:** Sparse retrieval finds chunks by **word overlap** — it scores a chunk higher when it literally contains the query's words, especially rare ones — which makes it unbeatable at exact terms like codes, names, and acronyms that dense vector search fluffs.

## Why it matters for an AI Engineer

Dense (vector) search matches *meaning* but misses *exact tokens*. Sparse search is the mirror image and the fix. If a user searches for error "**E-4021**," account type "**ADCB-SAV-01**," a person's surname, or a niche legal term, sparse retrieval reliably surfaces the chunk that literally contains it. Nearly every serious production RAG runs sparse **alongside** dense (that's hybrid search) — so you need to know how it scores and why it's fast and cheap (no GPU, no embedding model).

## The mechanism — how it works

"Sparse" refers to the vector: a chunk is represented by a huge vector with one slot per word in the vocabulary, mostly zeros (sparse), non-zero only for the words it contains. Matching is basically counting shared words — but two weightings make it smart:

**TF-IDF** weights each word by two factors:
- **TF (term frequency)** — a word that appears often *in this chunk* matters more here.
- **IDF (inverse document frequency)** — a word that's rare *across all chunks* is more informative. "the" appears everywhere → near-zero weight. "E-4021" appears in one chunk → huge weight. This is why sparse search is great at rare, specific terms.

**BM25** is the modern, better default — TF-IDF with two fixes:
- **Saturation:** the 20th occurrence of a word adds far less than the 2nd (diminishing returns), so keyword-stuffed chunks don't dominate.
- **Length normalization:** long chunks naturally contain more words, so BM25 discounts them to keep the playing field fair.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ "error E-4021 on login"</span>
    <span class="darr">→<span class="lbl">tokenize</span></span>
    <span class="dbox orange">🔢 term weights (BM25)</span>
    <span class="darr">→<span class="lbl">match rare terms</span></span>
    <span class="dbox blue">🗄️ chunks</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ chunk containing "E-4021"</span>
  </div>
  <div class="dcap">Rare exact terms (IDF-heavy) dominate the score — so codes and names hit reliably.</div>
</div>

## Concrete example

Pure BM25 in Python with `rank_bm25` — no API, no GPU:

```python
from rank_bm25 import BM25Okapi

corpus = [
    "To reset your password, open Settings and click Forgot Password.",
    "Error E-4021 occurs when the auth token has expired; re-login to fix it.",
    "Our office in Dubai is open Sunday to Thursday.",
]
tokenized = [doc.lower().split() for doc in corpus]
bm25 = BM25Okapi(tokenized)

query = "error E-4021 on login".lower().split()
scores = bm25.get_scores(query)
best = scores.argmax()
print(corpus[best])
# -> "Error E-4021 occurs when the auth token has expired; re-login to fix it."
```

The rare token `e-4021` carries almost all the weight (high IDF), so the right chunk wins outright — a dense embedding of "error on login" might have drifted to the password-reset chunk instead.

In LangChain you can drop it into the same retriever interface:

```python
from langchain_community.retrievers import BM25Retriever
retriever = BM25Retriever.from_texts(corpus, k=2)
hits = retriever.invoke("error E-4021 on login")
```

## How a company uses this

A **Dubai IT helpdesk** RAG kept failing on ticket lookups: agents pasted error codes and log signatures, and the vector-only bot returned vaguely-related articles. Adding a **BM25 retriever** so exact codes and stack-trace tokens matched literally fixed the top complaint overnight — the codes are exactly the rare, high-IDF terms sparse search is built for.

## Common mistakes / misconceptions

- **Using it alone.** BM25 can't match "cancel plan" to "terminate subscription" — no shared words. It's the *keyword* half; pair it with dense search.
- **Forgetting tokenization matters.** Case, stemming, and how you split "E-4021" all change results. Inconsistent tokenizing between index and query silently breaks matching.
- **Thinking it's obsolete.** It isn't — BM25 is a 30-year-old algorithm that still beats or ties fancy neural search on exact-term queries, for zero GPU cost. That's why it survives in every hybrid stack.
- **Confusing TF-IDF and BM25.** BM25 is the upgrade (saturation + length norm); use BM25 unless you have a reason not to.

## Interview tip
Say: *"Sparse retrieval — BM25 — scores by weighted term overlap, using IDF so rare, specific terms like error codes and SKUs dominate. It's the exact-match complement to dense search's semantic match, it needs no GPU, and I run it in hybrid because each covers the other's blind spot."* Mentioning IDF and BM25's saturation/length-normalization over plain TF-IDF shows depth.

See also: **Dense Retrieval** for the semantic complement, and **Hybrid Search** to fuse the two.
