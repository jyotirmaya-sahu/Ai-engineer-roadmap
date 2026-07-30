# Multilingual & Domain-Specific Embeddings

**What it is:** The idea that a general-purpose embedder isn't always enough — sometimes you need a model tuned for **a language** (Arabic) or **a domain** (law, medicine, code), so it understands the vocabulary and nuance a generic model misses.

## Why it matters for an AI Engineer

A default embedder is trained mostly on general English web text. Point it at Arabic legal contracts or clinical notes and retrieval quality drops — it doesn't "get" that "دعوى" and "lawsuit" are the same, or that a medical "MI" means myocardial infarction, not Michigan. In Dubai, **Arabic + specialized domains** (banking, legal, healthcare, real estate) are the norm. Knowing *when* to reach for a specialized embedding model — and when a general one is fine — is the judgment that separates a junior from someone who's shipped.

## The mechanism — how it works

Two axes of specialization:

<div class="diagram">
  <div class="flow">
    <span class="dbox purple wide">General embedder<span class="sub">text-embedding-3, bge-large-en</span></span>
  </div>
  <div class="flow">
    <span class="dbox blue wide">🌍 Multilingual<span class="sub">bge-m3, multilingual-e5, Cohere v4</span></span>
    <span class="dbox orange wide">🏥 Domain-specific<span class="sub">legal-BERT, code embeddings, medical</span></span>
  </div>
  <div class="dcap">Specialize along language (rows) or domain (columns) only when a general model measurably misses.</div>
</div>

**Multilingual** models (covered more in [Cohere](cohere-multilingual.md) and [e5/BGE](e5-bge.md)) share one vector space across languages. For **Arabic specifically**, general multilingual models like `bge-m3`, `multilingual-e5-large`, and Cohere `embed-v4.0` handle it well; there are also Arabic-focused models (e.g. AraBERT-derived embedders) when you need the extra edge on dialects or classical Arabic.

**Domain-specific** models are trained or fine-tuned on a field's text so its jargon clusters correctly:
- **Code** — models like `jina-embeddings-v2-code` or Voyage's `voyage-code` understand that two functions do the same thing even with different variable names.
- **Legal / finance / medical** — Voyage AI ships `voyage-law-2`, `voyage-finance-2`; there are BioBERT/legal-BERT-style embedders too.

**The decision rule:** start with a strong general model, **measure retrieval on your real data** (see [ANN search](ann-search.md) and eval), and only swap to a specialized model if the numbers show misses. Specializing blind wastes effort.

## Concrete example — testing whether you *need* a specialist

```python
from sentence_transformers import SentenceTransformer
import numpy as np

def score(model_name, prefix=""):
    m = SentenceTransformer(model_name)
    docs = [prefix + "المادة 5: يجب سداد الرسوم خلال 30 يومًا.",   # Arabic legal clause
            prefix + "The tenant must pay within 30 days."]
    q = m.encode(prefix + "كم المهلة لدفع الرسوم؟", normalize_embeddings=True)  # Arabic query
    D = m.encode(docs, normalize_embeddings=True)
    return float((D @ q).max())

print("multilingual-e5:", score("intfloat/multilingual-e5-large", "query: "))
print("bge-m3        :", score("BAAI/bge-m3"))
# Higher top-similarity on YOUR data wins. Measure, don't assume.
```

You pick the specialist that scores best **on your own documents**, not on a leaderboard for someone else's data.

## How a company uses this

A Dubai law firm building a contract-search tool tried `text-embedding-3-large` first — fine for English memos, weak on Arabic clauses full of legal terms. They benchmarked `bge-m3` and an Arabic-tuned model on 200 real queries, picked the winner, and reserved a code-specific embedder for a separate internal tool that searches their automation scripts. Two domains, two models, both chosen by measurement.

## Common mistakes / misconceptions

- **Swapping to a "legal" or "Arabic" model without measuring** — sometimes the general model already wins, and you've added ops burden for nothing.
- **Believing one model must do everything** — it's normal to run different embedders for different corpora.
- **Confusing multilingual with translation** — the model doesn't translate; it maps meaning across languages into one space.
- **Forgetting each model needs its own index** (different dims, different space).

## Interview tip

Show *judgment*, not model-name-dropping: *"I'd default to a strong general model, build a small eval set from real user queries, and only adopt an Arabic-tuned or domain-specific embedder if retrieval metrics show a gap — specialization is a measured decision, not a reflex."* That answer proves you evaluate instead of guess.
