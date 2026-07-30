# unstructured.io

**What it is:** an open-source Python library (`unstructured`) that gives you *one* function to parse almost any document type — PDF, DOCX, HTML, PPTX, email, images — and returns a clean, uniform list of typed "elements" (Title, NarrativeText, Table, ListItem) ready for chunking.

## Why it matters for an AI Engineer

Real ingestion pipelines don't handle one format — they handle a folder of mixed files: some PDFs, some Word docs, a few HTML exports, scanned images. Writing and maintaining a separate parser for each is tedious and brittle. `unstructured` is the popular "just parse it" layer that normalizes all of them into the same shape, so the rest of your pipeline (chunk → embed → store) doesn't care what the original format was. It's one of the most-used ingestion tools in the RAG ecosystem, integrated into LangChain and LlamaIndex, and it comes up by name in AI Engineer interviews because it's what many teams actually run.

## The mechanism — documents to typed elements

Instead of returning one text blob, `unstructured` returns a **list of elements**, each with a type and metadata:

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Any file<span class="sub">pdf/docx/html/img…</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">partition()<span class="sub">detect type + parse</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">Elements<span class="sub">Title, NarrativeText, Table, ListItem</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ chunk by title</span>
  </div>
  <div class="dcap">One entry point, many formats → a uniform stream of typed, metadata-rich elements.</div>
</div>

Why typed elements are powerful:
- **`Title` elements mark section boundaries** — so you can do smart "chunk by title" grouping instead of blind fixed-size cuts.
- **`Table` elements are kept separate** and can carry an HTML representation of the grid, so table structure survives.
- **Every element carries metadata** — source filename, page number, coordinates — which flows straight into your citations.

`unstructured` also has **strategies** for PDFs: `"fast"` (text layer only, cheap), `"hi_res"` (uses a layout model + OCR for scanned/complex pages, slower), and `"ocr_only"`. You pick based on document quality — the same routing idea from the PDF and OCR tiles, now behind one flag.

## Concrete example

```python
# pip install "unstructured[pdf,docx]"
from unstructured.partition.auto import partition

# auto-detects the file type; hi_res handles scanned/complex PDFs via OCR + layout
elements = partition(filename="report.pdf", strategy="hi_res")

for el in elements[:8]:
    print(f"[{el.category}] {el.text[:70]}")
    print("   page:", el.metadata.page_number)
# [Title] Quarterly Report 2026
# [NarrativeText] This quarter revenue in the Dubai region grew...
# [Table] <table>...</table>
```

Then chunk *by section title* — grouping elements under each heading — which respects document structure:

```python
from unstructured.chunking.title import chunk_by_title

chunks = chunk_by_title(elements, max_characters=1000)
for c in chunks:
    print(len(c.text), "chars |", c.text[:60])
```

The same `partition(...)` call works on a `.docx`, `.html`, `.eml`, or `.png` — that uniformity is the entire selling point.

## How a company uses this

A Dubai enterprise builds a knowledge assistant over a shared drive of mixed files — PDFs, Word docs, PowerPoints, emailed reports. Rather than five parsers, they run everything through `unstructured`'s `partition`, use `hi_res` for scanned PDFs, chunk by title, and keep page-number metadata for citations. Onboarding a new file type becomes "it already works" instead of a new integration.

## Common mistakes

- **Always using `hi_res`.** It's much slower and needs extra dependencies (a layout model, OCR). Use `fast` for clean digital PDFs; reserve `hi_res` for scans/complex layouts.
- **Missing optional dependencies.** `unstructured` is modular — parsing PDFs or images needs extras (`unstructured[pdf]`, plus system Tesseract/Poppler). Forgetting them causes confusing failures.
- **Ignoring element types.** The types (`Title`, `Table`) are the value. Flattening every element to text throws away the structure you paid for.
- **Assuming perfect table extraction.** It's good, not magical — validate tables on critical documents.

## Interview tip

Position `unstructured` as the **normalization layer**: *"For a mixed-format corpus I'd use `unstructured` to partition everything into typed elements, then `chunk_by_title` so chunks follow real sections — and I'd pick the `fast` vs `hi_res` strategy per document instead of paying for OCR on clean PDFs."* Mentioning the strategy trade-off shows you've actually tuned it for cost, not just called the demo function.
