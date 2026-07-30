# MMR (Maximal Marginal Relevance)

**The one-line idea:** MMR picks results that are relevant **and different from each other**, so your top-K stops returning the same paragraph phrased five ways and instead covers five distinct facets of the answer.

## Why it matters for an AI Engineer

Pure similarity search has a redundancy problem: the top 5 chunks are often near-duplicates because your corpus repeats itself (the same FAQ copied across pages, boilerplate clauses, restated policies). You spend your whole context budget on one point and miss the four *other* points the answer needs. MMR fixes this cheaply — no extra model call, just smarter selection — which is why it's a built-in retriever mode in LangChain and most vector DBs. It's the go-to when your bot keeps giving one-note answers.

## The mechanism — how it works

MMR builds the result list **greedily, one chunk at a time**, each step balancing two things:

- **Relevance** — how similar the chunk is to the *query*.
- **Redundancy** — how similar it is to the chunks you've *already picked*.

At each step it picks the chunk that maximizes:

```
MMR = λ · sim(chunk, query)  −  (1 − λ) · max sim(chunk, already_selected)
```

- **λ (lambda) = 1** → pure relevance (ordinary top-K, redundancy ignored).
- **λ = 0** → pure diversity (maximally different, relevance ignored).
- **λ ≈ 0.5–0.7** → the useful middle: relevant *and* varied.

So the first pick is just the most relevant chunk. The second pick must be relevant *but also unlike the first*. A near-duplicate of pick #1 gets penalized and skipped in favor of a chunk that adds *new* information. The mechanics: you fetch a larger candidate pool (`fetch_k`) with plain similarity, then MMR selects the final `k` from it.

<div class="diagram">
  <div class="flow v">
    <span class="dbox orange">📄 20 similar candidates<span class="sub">4 near-duplicates of #1</span></span>
    <span class="darr">↓<span class="lbl">MMR: relevance − redundancy</span></span>
    <div class="flow">
      <span class="dbox green">📄 facet A</span>
      <span class="dbox green">📄 facet B</span>
      <span class="dbox green">📄 facet C</span>
    </div>
  </div>
  <div class="dcap">MMR keeps one of the duplicates and fills the rest with genuinely different, still-relevant chunks.</div>
</div>

## Concrete example

LangChain exposes MMR as a search type — `fetch_k` is the pool it diversifies from, `lambda_mult` is λ:

```python
retriever = store.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 4,              # final results returned
        "fetch_k": 20,       # pull 20 by similarity, then diversify
        "lambda_mult": 0.6,  # 0=max diversity, 1=pure relevance
    },
)
retriever.invoke("what are the benefits of the premium plan?")
# Without MMR: 4 chunks all restating "priority support".
# With MMR: priority support + higher limits + SLA + dedicated manager — 4 distinct benefits.
```

## How a company uses this

A **Dubai tourism board** built a "things to do" assistant. Plain vector search for "family activities in Dubai" returned five chunks all about the *same* theme park (its brochure text was duplicated across pages). With **MMR at λ=0.5**, the results spread across a theme park, a beach, a desert safari, and an aquarium — a genuinely useful shortlist instead of one attraction five times.

## Common mistakes / misconceptions

- **Confusing MMR with reranking.** Reranking improves *relevance* ordering with a heavier model; MMR improves *diversity* of the set. Different goals — you can even do both.
- **Setting λ too low.** Push λ toward 0 and you get diverse-but-off-topic chunks. For most Q&A, λ ≈ 0.5–0.7 is right; go lower only for exploratory/summary use cases.
- **fetch_k too small.** If the candidate pool is barely bigger than k, MMR has nothing to diversify from. Fetch several times k.
- **Using it when there's no redundancy.** If your corpus is clean and varied, MMR adds little. It shines on repetitive corpora.

## Interview tip
Say: *"MMR selects results that are relevant to the query but dissimilar to what's already chosen, trading off with a lambda — around 0.6 for Q&A. It's the fix for redundant top-K, where similarity search returns the same paragraph several times and wastes context. It's cheap — pure selection, no extra model — unlike reranking, which re-scores with a heavier model for precision."* Distinguishing MMR (diversity) from reranking (precision) is the key signal.

See also: **Top-K Selection** (what MMR re-selects) and **Reranking** (the precision-oriented cousin).
