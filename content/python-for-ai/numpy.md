# NumPy

**The one-line idea:** NumPy gives Python fast, math-ready **arrays**. It's the foundation of all numerical AI — and crucially, **an embedding is literally a NumPy array of floats**, so similarity search is just NumPy math.

## Why this matters for an AI Engineer

Embeddings — the vectors that power RAG and semantic search — *are* NumPy arrays. Comparing two embeddings for similarity is a NumPy dot product. Storing and searching thousands of vectors, normalizing them, computing cosine similarity: all NumPy. Even when a vector database (Pinecone, FAISS) does the heavy lifting, it's doing NumPy-style math underneath, and you'll manipulate embeddings in NumPy constantly. Understanding arrays and cosine similarity is non-negotiable for RAG work.

## Arrays vs Python lists

A NumPy array looks like a list but is stored compactly and operated on *all at once* (vectorized), making it far faster and enabling clean math.

```python
import numpy as np

a = np.array([1.0, 2.0, 3.0])
b = np.array([4.0, 5.0, 6.0])

a + b            # array([5., 7., 9.])  — element-wise, no loop
a * 2            # array([2., 4., 6.])  — scales every element
a.shape          # (3,)  — a 1-D vector of length 3
```

With plain lists, `a + b` would *concatenate* them and `a * 2` would *duplicate* — you'd need a loop for real math. Arrays do the math directly.

## Vectorization — why it's fast

"Vectorization" means doing an operation on the whole array at once in optimized C code, instead of a Python `for` loop. For the sizes AI works at (thousands of 1536-dimensional vectors), this is the difference between milliseconds and minutes.

```python
# Slow: Python loop
result = [x * 2 for x in range(1_000_000)]

# Fast: vectorized — same result, ~100x faster
result = np.arange(1_000_000) * 2
```

Rule of thumb: if you're writing a `for` loop over numbers, there's usually a vectorized NumPy way that's much faster. Let NumPy loop in C for you.

## The dot product — the heart of similarity

The **dot product** multiplies two vectors element-wise and sums the result — one number that measures how much they "point the same way."

```python
a = np.array([1.0, 2.0, 3.0])
b = np.array([4.0, 5.0, 6.0])

np.dot(a, b)     # 1*4 + 2*5 + 3*6 = 32
a @ b            # 32  — the @ operator is dot product too
```

This single operation is how you compare embeddings. Bigger dot product (roughly) = more similar direction = more semantically related text.

## Cosine similarity — the RAG workhorse

Raw dot product is affected by vector *length*. **Cosine similarity** removes length and measures only *direction* — the angle between vectors — giving a clean score from -1 (opposite) to 1 (identical). This is *the* standard metric for "how similar are these two embeddings."

```python
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

q = np.array([1.0, 0.0, 1.0])          # the question's embedding
doc = np.array([1.0, 0.0, 0.9])        # a document chunk's embedding
cosine_similarity(q, doc)              # ~0.998 -> very similar
```

`np.linalg.norm(v)` is the vector's length. Dividing by both lengths normalizes out magnitude, leaving pure direction similarity.

## Searching many vectors at once (a 2-D array)

In real RAG you compare one question against *thousands* of chunks. Stack them in a 2-D array (a matrix) and score them all in one vectorized operation — no loop.

```python
# 4 document embeddings, each 3-dim, stacked into a matrix
docs = np.array([
    [1.0, 0.0, 0.9],
    [0.0, 1.0, 0.0],
    [0.9, 0.1, 1.0],
    [0.2, 0.9, 0.1],
])
query = np.array([1.0, 0.0, 1.0])

# Normalize everything so a dot product == cosine similarity
docs_n  = docs / np.linalg.norm(docs, axis=1, keepdims=True)   # per-row length
query_n = query / np.linalg.norm(query)

scores = docs_n @ query_n              # one dot product per doc, all at once
top = scores.argsort()[::-1][:2]       # indices of the 2 highest scores
print(top)                             # e.g. [0 2] -> most similar chunks
```

That's the core of vector search in ~5 lines. Pinecone/FAISS optimize *this exact computation* at massive scale — but the math is what you just wrote. `axis=1` means "operate along each row"; `argsort()[::-1]` gives indices from highest to lowest score.

## Real world: how a company uses this

> **A Dubai real-estate portal** builds semantic property search. Each listing description is embedded into a 1536-dim NumPy vector once and stored. When a user searches "quiet apartment near the marina with a balcony," that query is embedded and compared against all listings with a single vectorized cosine-similarity operation — thousands of comparisons in milliseconds — returning the closest matches. Normalizing vectors up front lets them use a plain dot product (`docs @ query`) as cosine similarity, the trick every vector search uses. When they outgrow in-memory NumPy, they move to FAISS — which runs the same math, just faster and on disk.

## Common mistakes

- Confusing list `+`/`*` (concatenate/repeat) with array `+`/`*` (element-wise math).
- Comparing embeddings with **raw dot product** when vectors aren't normalized — length skews results; normalize or use cosine similarity.
- Writing Python `for` loops over big arrays instead of vectorizing — orders of magnitude slower.
- Mismatched shapes — a `(3,)` vector and a `(4,3)` matrix must line up; watch `.shape` and the `axis` argument.
- Forgetting `keepdims=True` when normalizing rows, causing a broadcasting shape error.

## Interview tip

Say: *"An embedding is just a NumPy array of floats, and semantic similarity is cosine similarity — the dot product of the two normalized vectors. I normalize once so a plain dot product gives cosine, then compare a query against all document vectors in one vectorized operation. Vector DBs like FAISS optimize exactly this."* Being able to *write* cosine similarity in NumPy and explain that *embeddings are arrays* is the concrete signal that you understand RAG from the ground up, not just as a black box.
