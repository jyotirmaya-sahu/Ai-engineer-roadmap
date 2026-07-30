# Deduplication

**The one-line idea:** finding and removing records that are the *same* — either byte-for-byte identical (exact duplicates) or "basically the same with tiny differences" (near-duplicates) — so your data, retrieval, and models aren't skewed by counting one thing many times.

## Why it matters for an AI Engineer

Duplicates quietly wreck AI systems. In **RAG**, if the same policy document was uploaded three times, your top-5 retrieval returns three copies of the same clause — wasting the context window and crowding out other relevant chunks, so the model sees less real information. In **training/fine-tuning**, duplicated examples over-weight whatever they say and can cause memorization. In analytics, duplicate rows inflate every count. Dedup is unglamorous but it's one of the highest-return cleaning steps in a corpus. Interviewers ask it under "data quality" and specifically under "cleaning a RAG corpus", because near-duplicate detection (not just exact) is where it gets genuinely tricky.

## The mechanism / how it works

There are two problems, with different tools.

**Exact duplicates** are easy: **hash** each record (e.g. SHA-256 of the normalized text) and drop any record whose hash you've already seen. A hash set gives O(1) lookup, so this scales to hundreds of millions of records. The only subtlety is *normalize first* — lowercase, trim whitespace, strip boilerplate — so "Hello " and "hello" hash the same if you want them to.

**Near-duplicates** are the hard, interesting case: two documents that are 98% identical (a re-export with a changed timestamp, a lightly edited copy). Hashing won't catch these because one different character = a totally different hash. Two standard techniques:

- **MinHash + LSH (Locality-Sensitive Hashing).** You represent each document as a set of overlapping word-shingles, compute a compact **MinHash** signature that estimates how much two documents' shingle-sets overlap (Jaccard similarity), and use **LSH** to bucket similar signatures together so you only compare likely-similar pairs instead of all N² pairs. This is *the* scalable near-dup method — it's how web-scale corpora are deduped.
- **Embedding + cosine similarity.** Embed each document; if two embeddings have cosine similarity above a threshold (say 0.95), treat them as duplicates. More semantic (catches paraphrases), but costs an embedding per doc and an ANN search — reach for it when meaning-level dedup matters.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📄 Records</span>
    <span class="darr">↓<span class="lbl">normalize + hash</span></span>
    <span class="dbox purple">🔑 Drop exact dupes<span class="sub">hash set</span></span>
    <span class="darr">↓<span class="lbl">MinHash+LSH / embeddings</span></span>
    <span class="dbox orange">🔍 Cluster near-dupes<span class="sub">similarity ≥ threshold</span></span>
    <span class="darr">↓<span class="lbl">keep 1 per cluster</span></span>
    <span class="dbox green">✅ Deduped corpus</span>
  </div>
  <div class="dcap">Cheap exact-hash pass first, then a similarity pass for near-duplicates.</div>
</div>

Always do the cheap exact pass first (kills most dupes for almost no cost), then the expensive near-dup pass on what remains.

## Concrete example

Exact dedup by content hash, then near-dup with MinHash/LSH via `datasketch`:

```python
import hashlib
from datasketch import MinHash, MinHashLSH   # pip install datasketch

def norm(t): return " ".join(t.lower().split())
def h(t):    return hashlib.sha256(norm(t).encode()).hexdigest()

seen, unique = set(), []
for doc in docs:                          # 1) exact
    k = h(doc["text"])
    if k not in seen:
        seen.add(k); unique.append(doc)

def sig(text, num=128):                    # 2) near-dup
    m = MinHash(num_perm=num)
    for tok in norm(text).split():
        m.update(tok.encode())
    return m

lsh = MinHashLSH(threshold=0.9, num_perm=128)
kept = []
for i, doc in enumerate(unique):
    s = sig(doc["text"])
    if not lsh.query(s):                   # no near-dup already kept
        lsh.insert(f"d{i}", s); kept.append(doc)
print(f"{len(docs)} → {len(unique)} exact → {len(kept)} after near-dup")
```

`threshold=0.9` means "≥90% shingle overlap counts as a duplicate" — tune it to your tolerance.

## How a company uses this

A Dubai government knowledge base aggregates circulars from many departments, and the same regulation often lands in multiple feeds with only a header or date differing. Before dedup, their assistant would return the same regulation three times in a five-result answer, and citizens complained it "kept repeating itself." They run a two-stage dedup over ~5M documents nightly: SHA-256 exact-hash (removes ~15% instantly, near-zero cost) then MinHash+LSH at threshold 0.9 (removes another ~8% of near-identical re-exports). LSH is what makes it feasible at that scale — comparing 5M documents pairwise is 12.5 *trillion* comparisons; LSH buckets it down to a tractable number. Result: cleaner retrieval, ~23% fewer chunks to embed and store, and a visibly less repetitive assistant.

## Common mistakes / misconceptions

- **Only doing exact dedup.** Real corpora are full of near-duplicates that hashing completely misses. If you skip the similarity pass, you've barely deduped.
- **O(N²) pairwise comparison.** Comparing every doc to every other doc doesn't scale past a few thousand. Use LSH (or ANN over embeddings) to avoid it.
- **Deduping before normalizing.** Whitespace, casing, and boilerplate differences make identical content hash differently. Normalize first.
- **Losing provenance.** When you drop a duplicate, keep a note of which sources had it — sometimes "three departments filed this" is itself useful metadata for [Metadata catalogs](./metadata-catalogs.md).

## Interview tip

Say: *"I dedup in two passes: a cheap exact pass with content hashing that kills most duplicates for almost nothing, then a near-duplicate pass with MinHash+LSH — or embedding cosine similarity when I need semantic dedup — because hashing misses the 98%-identical re-exports that actually crowd out RAG retrieval. And I never do it pairwise; LSH is what makes it scale to millions of docs."* Naming near-dup + LSH is the differentiator; almost everyone remembers exact hashing.
