# Cleaning for RAG Corpora

**The one-line idea:** the specific set of clean-up steps that turn raw, messy extracted text — full of headers, footers, navigation menus, broken PDF line-breaks, boilerplate, and duplicates — into tidy, self-contained text that will chunk and embed well and give a RAG system something worth retrieving.

## Why it matters for an AI Engineer

This is where all the data-quality ideas in this node converge onto the RAG use case. Retrieval quality is capped by corpus quality: if a chunk is half a repeated footer and half a real sentence, its embedding is muddy and it either won't be retrieved when needed or *will* be retrieved as noise. Cleaning is the cheap, high-leverage step right before [Chunking](../chunking.md) and embedding — and skipping it is the most common reason a RAG demo works on clean docs but falls apart on a real company's SharePoint. It sits at the seam between [Ingestion & Parsing](../ingestion-parsing.md) (getting text out of files) and chunking (splitting it), and it's a favorite interview topic because it's where practical RAG lives or dies.

## The mechanism / how it works

Cleaning a RAG corpus is a pipeline of targeted transforms. The important ones, in rough order:

1. **Strip boilerplate & chrome.** Headers, footers, page numbers, nav bars, cookie banners, "Confidential" stamps — text that repeats on every page and carries no answer. It pollutes embeddings and wastes context.
2. **Fix extraction artifacts.** PDF-to-text often breaks a sentence across lines with hard `\n`, hyphenates words at line ends (`inter-\nnational`), and jumbles multi-column layouts. Re-join wrapped lines, de-hyphenate, normalize whitespace.
3. **Normalize encoding & unicode.** Fix mojibake (`â€™` → `'`), collapse weird whitespace, standardize quotes/dashes.
4. **Handle non-prose structure.** Tables and lists lose meaning when flattened — either preserve them as markdown or extract them separately (a table becomes its own retrievable unit).
5. **Deduplicate.** Remove repeated documents and near-duplicates (see [Deduplication](./deduplication.md)) so retrieval isn't three copies of one thing.
6. **Redact PII** where required before embedding (see [PII detection & redaction](./pii-detection-redaction.md)).
7. **Filter junk & attach metadata.** Drop empty/near-empty fragments; attach source, title, section, date so chunks are filterable and citable.

The guiding principle: **each cleaned unit should read as a coherent, self-contained piece of text**, because that's exactly what embeds sharply and retrieves well.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📄 Raw extracted text<span class="sub">headers · broken lines · dupes · PII</span></span>
    <span class="darr">↓<span class="lbl">strip boilerplate</span></span>
    <span class="dbox orange">🧹 de-chrome + fix line-breaks</span>
    <span class="darr">↓<span class="lbl">normalize · dedupe · redact</span></span>
    <span class="dbox orange">🧽 clean, unicode-safe, PII-free</span>
    <span class="darr">↓<span class="lbl">attach metadata</span></span>
    <span class="dbox green">✅ Retrieval-ready text → chunk → embed</span>
  </div>
  <div class="dcap">Cleaning turns raw file text into coherent, self-contained units that embed and retrieve well.</div>
</div>

## Concrete example

A pragmatic cleaning pass, plus using `unstructured` to strip boilerplate:

```python
import re, unicodedata

def clean_text(t: str) -> str:
    t = unicodedata.normalize("NFKC", t)          # fix unicode/mojibake
    t = re.sub(r"(\w)-\n(\w)", r"\1\2", t)         # de-hyphenate line breaks
    t = re.sub(r"(?<![.\n])\n(?!\n)", " ", t)      # join wrapped lines, keep paragraph breaks
    t = re.sub(r"[ \t]+", " ", t)                  # collapse whitespace
    t = re.sub(r"\n{3,}", "\n\n", t)               # cap blank lines
    return t.strip()

# Structure-aware extraction that already drops headers/footers:
from unstructured.partition.auto import partition   # pip install "unstructured[pdf]"
els = partition(filename="report.pdf")
body = [e for e in els if e.category not in ("Header", "Footer", "PageBreak")]
doc = clean_text("\n\n".join(str(e) for e in body))
```

`unstructured` tags each element (Title, NarrativeText, Header, Footer, Table), so you can drop chrome by *category* instead of guessing with regex — much more robust on real documents.

## How a company uses this

A Dubai construction firm built a RAG assistant over ~200k engineering PDFs — specs, contracts, safety manuals. The first version fed raw PyPDF output straight to the chunker; retrieval was terrible because every chunk was contaminated with the company letterhead, page footers, and mid-sentence line breaks that split answers. Rebuilding the *cleaning* stage — `unstructured` to drop headers/footers and preserve tables, line-break repair, dedup of the many near-identical revised specs, and metadata (project, doc type, revision date) on every chunk — roughly **doubled** their retrieval hit rate on a held-out question set, with zero change to the embedding model or the LLM. Their takeaway, stated in every design review since: *"clean the corpus before you blame the retriever."* The production lens: over 200k docs this pass runs in the ingestion DAG and is cheap (regex + a CPU model), so it's essentially free insurance on retrieval quality.

## Common mistakes / misconceptions

- **Feeding raw parser output to the chunker.** The #1 RAG mistake. Raw PDF/HTML text is full of chrome and broken lines; clean first.
- **Flattening tables into prose.** A table dumped as a wall of numbers is meaningless to retrieval. Preserve as markdown or extract separately.
- **Over-cleaning.** Stripping so aggressively you delete real content or structure the model needs. Cleaning should *sharpen*, not shrink meaning.
- **No metadata.** Clean text with no source/section/date can't be filtered or cited — retrieval-ready means metadata-tagged too.

## Interview tip

Say: *"Before chunking I clean the corpus: strip headers/footers and boilerplate (I use `unstructured` so I can drop by element type, not guess with regex), repair PDF line-break and hyphenation artifacts, normalize unicode, dedupe near-identical revisions, redact PII, and attach source/section/date metadata. The goal is each unit reading as coherent, self-contained text — that's what embeds sharply. Most 'the retriever is bad' complaints are actually dirty-corpus complaints."* That last line is the sentence that lands.
