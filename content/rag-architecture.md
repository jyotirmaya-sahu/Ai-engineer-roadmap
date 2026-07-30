# RAG Architecture

**The one-line idea:** RAG (Retrieval-Augmented Generation) = give the LLM an *open-book exam*. Instead of hoping the model memorized your company's data, you **look up** relevant text at question-time and paste it into the prompt. The model answers from *that*, not from memory.

## Why it exists (the problem it solves)

LLMs have two fatal gaps for business use:
1. **No private knowledge** — GPT never read your internal wiki, contracts, or product docs.
2. **Hallucination** — asked something it doesn't know, it confidently makes things up.

RAG fixes both: retrieve real, current, private text → force the model to answer *grounded* in it → optionally show sources. It's cheaper and faster than fine-tuning and updates instantly when your docs change.

## The pipeline

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">① Ingest — offline, once</span>
    <div class="flow">
      <span class="dbox gray">📄 Documents</span>
      <span class="darr">→</span>
      <span class="dbox">Parse</span>
      <span class="darr">→</span>
      <span class="dbox">Chunk</span>
      <span class="darr">→</span>
      <span class="dbox">Embed</span>
      <span class="darr">→</span>
      <span class="dbox blue wide">🗄️ Vector DB</span>
    </div>
  </div>
  <div class="flow"><span class="darr">↓</span></div>
  <div class="dgroup">
    <span class="dgt">② Query — live, per question</span>
    <div class="flow">
      <span class="dbox green">❓ User question</span>
      <span class="darr">→</span>
      <span class="dbox">Embed question</span>
      <span class="darr">→</span>
      <span class="dbox blue wide">🔍 Search Vector DB</span>
      <span class="darr">→</span>
      <span class="dbox">Top-k chunks</span>
    </div>
    <div class="flow">
      <span class="dbox">Build prompt<span class="sub">context + question</span></span>
      <span class="darr">→</span>
      <span class="dbox purple">🤖 LLM</span>
      <span class="darr">→</span>
      <span class="dbox yellow wide">✅ Grounded answer<span class="sub">+ sources</span></span>
    </div>
  </div>
  <div class="dcap">Two phases: ingestion runs once; query runs on every question.</div>
</div>

**Two phases.** Ingestion runs once (or on updates). Query runs on every question. Keep them separate in your head — it's the #1 clarity win in interviews.

## Minimal working RAG (no framework)

```python
from openai import OpenAI
import numpy as np

client = OpenAI()

def embed(texts):
    r = client.embeddings.create(model="text-embedding-3-small", input=texts)
    v = np.array([d.embedding for d in r.data])
    return v / np.linalg.norm(v, axis=1, keepdims=True)   # normalize -> dot == cosine

# --- INGEST (once) ---
chunks = ["Golden Visa lasts 10 years.", "Refunds take 14 days."]
index = embed(chunks)                      # store these vectors

# --- QUERY (per question) ---
def ask(question):
    q = embed([question])[0]
    sims = index @ q                        # cosine similarity (vectors are normalized above)
    top = sims.argsort()[-3:][::-1]         # top-3 chunks
    context = "\n".join(chunks[i] for i in top)
    prompt = f"Answer ONLY from context.\n\nContext:\n{context}\n\nQ: {question}"
    return client.chat.completions.create(
        model="gpt-5.4-mini",   # any current small model; names churn fast
        messages=[{"role": "user", "content": prompt}],
    ).choices[0].message.content
```

That's the whole idea. Everything else — Pinecone, LangChain, reranking — is making these 20 lines *scale and get more accurate*.

## Naive vs Advanced vs Agentic RAG

| Type | What it adds | When |
|---|---|---|
| **Naive** | the pipeline above | prototypes, small/clean data |
| **Advanced** | query rewriting, hybrid search, reranking, better chunking | production accuracy |
| **Agentic** | an agent *decides* whether/what to retrieve, can search multiple times, use tools | complex multi-step questions |

## The two ways RAG fails (know these cold)
1. **Retrieval failure** — the right chunk wasn't fetched. The LLM never had a chance. *Fix: chunking, embeddings, hybrid search, reranking.*
2. **Generation failure** — right chunk fetched, but the model ignored it or hallucinated. *Fix: prompt grounding, "answer only from context," citations.*

Diagnosing *which half broke* is the core skill. You evaluate them separately with **RAGAS** (the standard library): `context_precision` and `context_recall` grade *retrieval*, while `faithfulness` and `answer_relevancy` grade *generation*.

> **Two quick knobs that fix most retrieval failures:** (1) **chunk size + overlap** — too big and the relevant sentence gets diluted, too small and it loses context; ~200–500 tokens with ~10–20% overlap is a sane start. (2) **reranking** — pull top-20 by vector search, then a cross-encoder reorders to the best 3–5. This also dodges the "lost in the middle" problem, where LLMs pay least attention to the *middle* of a long context, so you put the strongest chunks first.

## Real world: how a company uses this

> **A UAE bank (FAB, ADNOC-style enterprise):** employees ask "what's our travel-expense policy for Dubai↔London?" A RAG assistant embeds all HR/finance PDFs into a vector DB. The question retrieves the 3 most relevant policy paragraphs, the LLM answers **with a citation to the exact document**, and — critically — says *"not covered"* instead of inventing a number. That grounding + citation is why banks trust RAG but not raw ChatGPT.

## Your portfolio angle
Your bilingual UAE Golden-Visa assistant *is* this pipeline, in Arabic + English, with Falcon/Jais. When asked in interview "explain RAG," you draw the two-phase diagram above and point at your deployed project.
