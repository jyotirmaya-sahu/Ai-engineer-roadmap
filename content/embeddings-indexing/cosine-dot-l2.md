# Cosine / Dot / L2 Similarity

**What it is:** The three ways to measure **how close two vectors are** — cosine (angle), dot product (angle × length), and L2 (straight-line distance). Picking the right one, and normalizing first, is the math that makes retrieval correct.

## Why it matters for an AI Engineer

Every vector search — in Pinecone, pgvector, FAISS, Chroma — runs *one* of these under the hood, and you choose which. Pick wrong and your "nearest" results are subtly off in ways no prompt tweak can fix. The single most useful fact in this whole node is: **normalize your vectors, and dot product becomes cosine.** Getting this right is cheap, getting it wrong quietly degrades every answer, and interviewers ask it because it instantly reveals whether you understand what "similarity" actually computes.

## The mechanism — how it works

Three measures:

- **Cosine similarity** — the **angle** between two vectors, ignoring length. Ranges −1 (opposite) → 1 (identical direction). This is what you almost always want for text: it asks "do these point the same way (mean the same)?" not "how long are they?"
- **Dot product** — multiply matching elements and sum. It's cosine **× both lengths**, so longer vectors score higher *regardless* of direction. Fast, but length leaks in.
- **L2 (Euclidean) distance** — straight-line distance between the two points. Smaller = closer. It also depends on length.

The unifying trick — **normalize** each vector to length 1 (divide by its magnitude). Then:
- dot product **= cosine** (lengths are all 1, so only angle remains), and
- L2 distance becomes a **monotonic function of cosine** — they rank neighbors identically.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🔢 raw vector</span>
    <span class="darr">→<span class="lbl">÷ its length</span></span>
    <span class="dbox orange">unit vector<span class="sub">length = 1</span></span>
    <span class="darr">→</span>
    <span class="dbox green wide">dot == cosine == (ranks like) L2</span>
  </div>
  <div class="dcap">Normalize once, and all three metrics agree. Dot is then the fastest way to get cosine.</div>
</div>

**Worked numbers.** Take `a = [3, 4]` (length 5) and `b = [6, 8]` (length 10) — same *direction*.
- Dot: `3·6 + 4·8 = 50` — big, but only because b is long. Misleading.
- Cosine: `50 / (5 · 10) = 1.0` — correctly says "identical meaning."
- Normalize: `a→[0.6,0.8]`, `b→[0.6,0.8]`; their dot = `0.36+0.64 = 1.0`. Now dot *is* cosine.

That's why "normalize, then use dot" is the standard recipe: you get cosine's correctness at dot product's speed.

## Concrete example

```python
import numpy as np

def normalize(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)

a = np.array([3.0, 4.0])
b = np.array([6.0, 8.0])          # same direction, twice as long

print("raw dot   :", a @ b)                       # 50.0  ← length leaks in
print("cosine    :", (a @ b) / (np.linalg.norm(a)*np.linalg.norm(b)))  # 1.0
an, bn = normalize(a), normalize(b)
print("norm dot  :", an @ bn)                     # 1.0   ← now dot == cosine
print("norm L2   :", np.linalg.norm(an - bn))     # 0.0   ← same ranking
```

After normalizing, `dot`, `cosine`, and `L2` all agree that a and b are identical in meaning. That's the guarantee you rely on in a vector DB.

## How a company usage

A Dubai support-bot team configured their Pinecone index with the `euclidean` metric on **un-normalized** OpenAI embeddings. Long chunks ranked artificially high (bigger vectors), and answers cited the wrong documents. Switching the metric to `cosine` (and normalizing at ingest) fixed retrieval overnight — no model change, just the right similarity math.

## Common mistakes / misconceptions

- **Dot product on un-normalized vectors** — long texts win unfairly. Normalize first, or use cosine explicitly.
- **Mismatched DB metric** — using `dotproduct`/`euclidean` in the vector DB while your vectors aren't normalized for it.
- **Normalizing docs but not the query** (or vice versa) — normalize *both* sides, consistently.
- **Thinking cosine and L2 disagree** — on normalized vectors they rank neighbors identically.
- **Double-normalizing** when the library already did it (e.g. `normalize_embeddings=True`) — harmless but a sign you're not tracking state.

## Interview tip

Say the magic sentence: *"For text I use cosine — it compares meaning, not length. In practice I normalize the embeddings and use dot product, which then equals cosine and is faster; L2 ranks the same once normalized. The classic bug is dot or L2 on un-normalized vectors, where long chunks score too high."* That one answer proves you understand what retrieval is actually computing. Ties into [Flat/IVF/HNSW](flat-ivf-hnsw.md) and every vector-DB tile.
