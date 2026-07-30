# Naive RAG

**The one-line idea:** the original, no-frills RAG pipeline — chunk your docs, embed them, store the vectors, and at question-time embed the question, grab the top-k nearest chunks, and paste them into the prompt. One retrieval, one generation, done.

## Why it matters for an AI Engineer

Naive RAG is the pipeline everyone builds first and the one you must be able to draw from memory. Every fancier variant — **Advanced RAG**, **Modular RAG**, **Agentic RAG** — is defined by *what it adds to this baseline*, so you can't reason about them until you've internalized this one. In an interview, "explain RAG" means "draw naive RAG." In a job, naive RAG is what you ship on day one to prove retrieval even helps before you spend a sprint on rerankers. Get this wrong and nothing downstream can save you: if the right chunk was never retrieved, the smartest model in the world will still hallucinate.

## The mechanism / how it works

There are two phases, and keeping them separate in your head is the whole game.

**Ingestion (offline, run once or on updates):**
1. **Load** raw documents (PDF, HTML, wiki pages).
2. **Chunk** each into small pieces — ~200–500 tokens (see the **Chunking** node).
3. **Embed** each chunk into a vector with an embedding model.
4. **Store** the vectors in a vector database, keyed to their source text.

**Query (online, run per question):**
1. **Embed** the user's question with the *same* model.
2. **Search** the vector DB for the `k` nearest chunk vectors (cosine similarity).
3. **Stuff** those top-k chunks into a prompt: *"Answer only from this context."*
4. **Generate** the answer with the LLM.

That's it. One shot each way. Naive RAG never rewrites the question, never re-ranks results, never retrieves twice, never checks its own answer. It trusts that vector similarity alone finds the right text.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ Question</span>
    <span class="darr">→</span>
    <span class="dbox">Embed</span>
    <span class="darr">→</span>
    <span class="dbox blue">🔍 Vector DB<span class="sub">top-k</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">3–5 chunks</span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 LLM</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Answer</span>
  </div>
  <div class="dcap">One retrieval, one generation, no rewriting or re-ranking — that's what makes it "naive."</div>
</div>

## Concrete example

```python
# pip install langchain-community langchain-openai faiss-cpu
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter

docs = open("hr_policy.txt").read()
chunks = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=75).split_text(docs)

# --- INGEST (once) ---
store = FAISS.from_texts(chunks, OpenAIEmbeddings(model="text-embedding-3-small"))

# --- QUERY (per question) ---
def ask(q):
    hits = store.similarity_search(q, k=4)                 # naive: top-k, nothing else
    context = "\n\n".join(h.page_content for h in hits)
    prompt = f"Answer ONLY from the context. If missing, say so.\n\n{context}\n\nQ: {q}"
    llm = ChatOpenAI(model="gpt-5.4-mini")                 # model names churn; use any current small model
    return llm.invoke(prompt).content

print(ask("How many days of annual leave do I get?"))
```

No query rewriting, no reranker, no agent loop. Add those and you've left "naive" behind.

## How a company uses this

A Dubai logistics firm wanting an internal "ask our SOPs" bot starts exactly here: dump 800 procedure PDFs into a vector DB, ship a naive top-4 pipeline in two days, and put it in front of ops staff. At this scale — a few thousand chunks, tens of queries a minute — naive RAG is genuinely enough: retrieval is sub-50ms, total latency is dominated by the LLM call (~1–2s), and cost is a fraction of a fil per query. The value isn't sophistication; it's proving the corpus answers real questions *before* anyone budgets for rerankers or hybrid search. The pattern only breaks when questions get ambiguous or the corpus grows into overlapping near-duplicate documents — which is the cue to move to **Advanced RAG**.

## Common mistakes / misconceptions

- **Different embedding models for ingest vs query.** Question and chunks *must* be embedded by the same model, or the vectors live in different spaces and similarity is meaningless.
- **k too high.** Stuffing 20 chunks bloats the prompt, raises cost, and triggers "lost in the middle." Start at k=3–5.
- **No grounding instruction.** Without "answer only from context," the model happily blends retrieved text with its own guesses — reintroducing hallucination.
- **Blaming the LLM for retrieval bugs.** If the answer's wrong, first check *whether the right chunk was even retrieved*. Usually it wasn't — that's a chunking/embedding problem, not a model problem.

## Interview tip

Say: *"Naive RAG is the baseline: chunk, embed, store, then embed the query, top-k retrieve, and generate with a grounding instruction — one retrieval, one generation. I ship it first to validate the corpus, then reach for advanced techniques only when I measure retrieval failing."* Then draw the two-phase diagram. Naming the phases *and* signalling you measure before over-engineering is exactly what interviewers want.
