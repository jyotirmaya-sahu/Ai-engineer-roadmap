# Query vs Passage Embeddings

**What it is:** The insight that a **question** and the **document that answers it** are different *kinds* of text — so some embedding models embed them slightly differently (with different prefixes or `input_type` flags) to make them match better.

## Why it matters for an AI Engineer

This is the single most common **silent bug** in RAG. Your code runs, retrieval returns *something*, easy test cases pass — and quality is quietly 20% worse than it should be because you embedded the query and the passage the same way when the model expected them handled differently. It costs nothing to fix and everyone who's shipped RAG has been bitten by it. Interviewers ask about it precisely because it separates people who read tutorials from people who debugged production retrieval.

## The mechanism — how it works

A query is short, a fragment, often a question: *"How long is the Golden Visa valid?"* A passage is longer, declarative, an answer: *"The UAE Golden Visa is issued for a renewable period of ten years…"* They rarely share wording. **Asymmetric search** is the technical name: query and document look different but should land close in vector space.

Models trained with this in mind expect a **role marker**:

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">Indexing (offline)</span>
    <div class="flow">
      <span class="dbox gray">Document chunk</span>
      <span class="darr">→</span>
      <span class="dbox orange">tag as PASSAGE<span class="sub">"passage:" / search_document</span></span>
      <span class="darr">→</span>
      <span class="dbox blue">🔢 doc vector</span>
    </div>
  </div>
  <div class="dgroup">
    <span class="dgt">Searching (live)</span>
    <div class="flow">
      <span class="dbox gray">User question</span>
      <span class="darr">→</span>
      <span class="dbox orange">tag as QUERY<span class="sub">"query:" / search_query</span></span>
      <span class="darr">→</span>
      <span class="dbox green">🔢 query vector</span>
    </div>
  </div>
  <div class="dcap">Same model, different role tag. The tags pull question and answer closer in the shared space.</div>
</div>

Which models care:
- **E5** — needs literal `"query: "` and `"passage: "` prefixes on the text.
- **BGE** — put a short instruction on the **query only** (docs go in raw). `bge-m3` is more forgiving but still benefits.
- **Cohere** — use `input_type="search_query"` vs `"search_document"`.
- **OpenAI `text-embedding-3`** — **symmetric**, no prefix needed. Same call for both. (One less thing to get wrong — a real reason people default to it.)

Rule: **read your model's card.** If it shows prefixes/instructions, you *must* use them and match query-tag to queries, passage-tag to documents.

## Concrete example

```python
from sentence_transformers import SentenceTransformer
import numpy as np
m = SentenceTransformer("intfloat/e5-large-v2")

doc = "passage: The UAE Golden Visa is issued for a renewable ten-year period."
q_right = "query: How long is the Golden Visa valid?"
q_wrong = "passage: How long is the Golden Visa valid?"   # WRONG tag on the query

d = m.encode(doc, normalize_embeddings=True)
print("correct tag :", float(m.encode(q_right, normalize_embeddings=True) @ d))
print("wrong tag   :", float(m.encode(q_wrong, normalize_embeddings=True) @ d))
# The correctly-tagged query scores meaningfully higher. Same model, same texts — only the tag changed.
```

Flip one prefix and watch the similarity score drop. That gap is exactly the retrieval quality you'd be leaking in production.

## How a company usage

A Dubai HR chatbot indexed thousands of policy paragraphs with `multilingual-e5-large` but forgot the prefixes. Retrieval "worked" in demos and missed on real employee questions. Adding `"query: "`/`"passage: "` — a two-line change, no re-training — jumped their retrieval hit-rate several points overnight. No new model, no reranker, just the correct tags.

## Common mistakes / misconceptions

- **Tagging both sides the same** (both `passage:` or both `query:`) — the classic bug.
- **Assuming every model needs prefixes** — OpenAI doesn't; adding `"query:"` to an OpenAI call just embeds the literal word "query."
- **Re-embedding your whole corpus to fix a query-side bug** — usually only the query path was wrong; check before re-indexing everything.
- **Forgetting the tag in one code path** (e.g. the eval script) so your offline numbers don't match production.

## Interview tip

Drop this line: *"With E5/BGE/Cohere I make sure queries and passages get their asymmetric prefixes — mismatched tags are a silent retrieval killer. OpenAI's embeddings are symmetric, so it's not an issue there."* It's a small detail that signals real hands-on RAG experience. See [e5/BGE](e5-bge.md) and [Cohere](cohere-multilingual.md).
