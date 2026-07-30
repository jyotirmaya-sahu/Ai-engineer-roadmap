# Hierarchical (Parent-Child) Chunking

**The one-line idea:** search over *small* chunks (precise matching) but feed the LLM the *large* parent they came from (full context). Retrieve narrow, answer wide.

## Why it matters for an AI Engineer

Chunking forces a painful trade-off (see **Chunk Size vs Recall**): **small chunks match precisely but lack context; big chunks have context but match fuzzily.** Parent-child chunking refuses to choose — it gets both. This "small-to-search, big-to-read" pattern is one of the highest-leverage upgrades in production RAG, and LangChain ships it as `ParentDocumentRetriever`. Being able to explain it — and *why* it beats a single chunk size — is a strong senior signal in an AI Engineer interview.

## The mechanism / how it works

You chunk the same document at **two levels**:

- **Child chunks** — small (e.g. 200–400 tokens). These get **embedded and stored in the vector DB**. Their smallness makes each embedding sharp and specific, so search matches the exact relevant sentence.
- **Parent chunks** — large (e.g. a full section, 1500–2000 tokens), or even the whole document. These are **not** what you search; they're stored in a plain document store keyed by ID. Each child remembers its parent's ID.

At query time: embed the question → search the **child** vectors → find the best-matching small chunks → but instead of handing those tiny chunks to the LLM, look up and return their **parent** chunks. So the LLM reads the full surrounding context, not a stranded fragment.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ Question</span>
    <span class="darr">↓</span>
    <span class="dbox blue">🔍 Search small CHILD chunks<span class="sub">precise match</span></span>
    <span class="darr">↓<span class="lbl">child → parent id</span></span>
    <span class="dbox orange">📦 Fetch big PARENT chunk<span class="sub">full context</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 LLM answers from parent</span>
  </div>
  <div class="dcap">Match on the small chunk; hand the LLM the big one it lives inside.</div>
</div>

The best of both worlds: **retrieval precision** of small chunks + **reading context** of big ones. It also de-duplicates naturally — if three children share one parent, you return that parent once.

## Concrete example

```python
# pip install langchain langchain-openai langchain-chroma
from langchain.retrievers import ParentDocumentRetriever
from langchain.storage import InMemoryStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

parent_splitter = RecursiveCharacterTextSplitter(chunk_size=2000)  # big
child_splitter  = RecursiveCharacterTextSplitter(chunk_size=350)   # small

vectorstore = Chroma(embedding_function=OpenAIEmbeddings(
    model="text-embedding-3-small"))
docstore = InMemoryStore()   # holds the big parents by id

retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,       # stores embedded CHILD chunks
    docstore=docstore,             # stores PARENT chunks
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,
)
my_docs = [Document(page_content=open("handbook.md").read())]  # your loaded docs
retriever.add_documents(my_docs)   # splits into parents, then children, links them

hits = retriever.invoke("What is the refund window?")
# search matched a 350-token child, but hits[] are the 2000-token PARENTS
print(len(hits[0].page_content))   # ~2000 chars of context, not 350
```

## How a company uses this

A Dubai bank's policy assistant needs *exact* retrieval — a question about "early settlement fees" must match the precise clause, so they embed small child chunks. But a good answer needs the *whole* policy section around that clause (definitions, exceptions, the governing paragraph), so they return the parent. Without parent-child, they'd either miss the clause (chunks too big and fuzzy) or answer without the surrounding rules (chunks too small and stranded). This pattern is why their bot cites the right clause *and* explains it correctly.

## Common mistakes / misconceptions

- **Embedding the parents too.** Parents go in a *doc store*, not the vector index. Embedding huge parents brings back the fuzzy-matching problem you were escaping.
- **Parents too big for the context window.** If a parent is 8000 tokens and you retrieve five, you blow the prompt budget. Size parents to a section, not the whole book, or cap how many you return.
- **Forgetting the two stores.** You need *both* a vector store (children) and a key-value/doc store (parents). Skipping the doc store breaks the lookup.
- **Thinking it replaces good chunking.** The child/parent split still uses **Recursive Chunking** underneath — this is a *retrieval* layer on top, not a different splitter.

## Interview tip

Pitch it as solving the core tension: *"Small chunks retrieve precisely but lose context; big chunks keep context but retrieve fuzzily. Parent-child chunking searches the small children for a sharp match, then returns their large parent so the LLM has full context — LangChain's `ParentDocumentRetriever`."* Then note the gotcha — *only children are embedded; parents live in a doc store* — to prove you've actually built it.
