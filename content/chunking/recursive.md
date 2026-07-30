# Recursive Chunking

**The one-line idea:** split on the *biggest* natural boundary that fits (paragraphs), and only if a piece is still too big, fall back to smaller boundaries (sentences, then words, then characters). It's fixed-size that tries to be polite about *where* it cuts.

## Why it matters for an AI Engineer

This is the **default, go-to chunker in production RAG** — LangChain literally recommends `RecursiveCharacterTextSplitter` as the starting point for generic text, and most real systems in the wild use it. It fixes the ugliest flaw of **Fixed-Size Chunking** (cutting mid-sentence) while keeping the same simplicity and speed and cost. If you can only master one chunking strategy for an AI Engineer interview, master this one — it's the one you'll actually deploy.

## The mechanism / how it works

Recursive chunking builds on **Fixed-Size Chunking**: you still have a `chunk_size` and `chunk_overlap`. The difference is *where* it's allowed to cut. You give it an ordered list of **separators**, from coarsest to finest:

1. `"\n\n"` — paragraph breaks (best place to cut)
2. `"\n"` — line breaks
3. `" "` — spaces (word boundaries)
4. `""` — anywhere (last resort)

The algorithm is **recursive**: try to split the text on the first separator (paragraphs). For each resulting piece, if it already fits under `chunk_size`, keep it. If a piece is *still too big*, recurse into it using the *next* separator (lines), and so on down the list. So it keeps semantically related text together as long as it can, and only resorts to a hard mid-word cut when a single "word" is somehow longer than the whole chunk.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📄 Document</span>
    <span class="darr">↓<span class="lbl">split on \n\n (paragraphs)</span></span>
    <span class="dbox orange">Para too big?</span>
    <span class="darr">↓<span class="lbl">recurse: split on \n</span></span>
    <span class="dbox orange">Line too big?</span>
    <span class="darr">↓<span class="lbl">recurse: split on " " then ""</span></span>
    <span class="dbox green">✅ Chunks ≤ size, cut at natural seams</span>
  </div>
  <div class="dcap">Cut at the coarsest boundary that fits; only go finer when forced.</div>
</div>

The payoff: most chunks end at a paragraph or sentence break, so each one reads as a coherent thought — which makes for a cleaner embedding and a better retrieval match.

## Concrete example

```python
# pip install langchain-text-splitters
from langchain_text_splitters import RecursiveCharacterTextSplitter

doc = open("handbook.md").read()

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=150,
    separators=["\n\n", "\n", " ", ""],  # this is the default order
)
chunks = splitter.split_text(doc)
print(f"{len(chunks)} chunks; first ends: ...{chunks[0][-60:]!r}")
```

For code or markdown, LangChain ships **language-aware** separator presets so it cuts on function/class boundaries instead of prose paragraphs:

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language

py_splitter = RecursiveCharacterTextSplitter.from_language(
    language=Language.PYTHON, chunk_size=800, chunk_overlap=100,
)
# splits preferring \nclass , \ndef , \n\tdef  etc. — keeps functions intact
```

## How a company uses this

A Dubai SaaS company building a "search our docs + codebase" assistant uses two recursive splitters: the prose splitter (paragraph-first) for help articles, and the `Language.PYTHON` / `Language.MARKDOWN` variants for source and READMEs so a function or code block never gets sliced in half. It's the same underlying algorithm tuned per content type — one dependency, no ML model, cheap to run over millions of files. This "recursive by default, semantic only where it pays" split is the norm in production.

## Common mistakes / misconceptions

- **Thinking it understands meaning.** It doesn't — it only knows *punctuation/whitespace* boundaries. A paragraph that switches topics mid-way still becomes one chunk. For true topic-aware cuts you need **Semantic Chunking**.
- **Using prose separators on code.** Splitting Python on `"\n\n"` mangles functions. Use `from_language(...)`.
- **Forgetting overlap.** Recursive still needs `chunk_overlap` for the same boundary-safety reason as fixed-size (see **Sliding Window / Overlap**).
- **Wrong separator order.** Separators must go coarse → fine. Put `""` first and you're back to blind fixed-size chunking.

## Interview tip

Say the sentence interviewers are listening for: *"My default is `RecursiveCharacterTextSplitter` — it cuts on paragraphs first and only falls back to sentences/words when a piece is too long, so chunks stay coherent without any ML cost."* Then show range: *"For code I switch to the language-aware variant, and I'd only reach for semantic chunking if measured retrieval quality justified the extra embedding calls."* That progression — recursive as default, semantic as an earned upgrade — signals real production judgment.
