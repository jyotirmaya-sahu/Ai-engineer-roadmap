# Parsing PDFs

**What it is:** pulling the actual text (and tables, and images) *out* of a PDF file so an LLM can read it — because a PDF is not a text file, it's a set of drawing instructions that happen to look like a document.

## Why it matters for an AI Engineer

Most enterprise knowledge lives in PDFs: contracts, policies, invoices, research papers, financial reports, Dubai government forms. RAG starts with *ingestion*, and ingestion almost always starts with a PDF. If your extraction is garbage — words glued together, table columns scrambled, headers repeated on every page — then every chunk, every embedding, and every answer downstream is garbage too. "Bad retrieval" is very often just "bad PDF parsing" wearing a disguise. Getting this right is one of the highest-leverage, least-glamorous skills in the whole RAG stack, and it comes up constantly in interviews and real work.

## The mechanism — why PDFs are hard

A PDF doesn't store "paragraphs." It stores commands like *"draw the glyph 'A' at coordinate (72, 500) in Helvetica 11pt."* There's no built-in concept of a sentence, a column, or reading order. A text-extraction library has to **reconstruct** structure by looking at where each character was painted and guessing what belongs together.

This gives you three broad categories of PDF:

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📄 PDF</span>
      <span class="darr">→</span>
      <span class="dbox">Has a text layer?</span>
    </div>
    <span class="darr">↓</span>
    <div class="flow">
      <span class="dbox blue">✅ Digital PDF<span class="sub">extract text directly</span></span>
      <span class="dbox orange">📐 Complex layout<span class="sub">columns/tables → layout parser</span></span>
      <span class="dbox purple">🖼️ Scanned PDF<span class="sub">image only → OCR</span></span>
    </div>
  </div>
  <div class="dcap">The first question for any PDF: is the text real, or is it a picture of text?</div>
</div>

- **Digital PDFs** (exported from Word, LaTeX, a browser) have a real text layer. You can pull text out cleanly and fast.
- **Complex-layout PDFs** have a text layer but multiple columns, tables, sidebars — naive extraction reads across columns and produces scrambled nonsense. You need layout awareness.
- **Scanned PDFs** are just images of paper. There is *no* text to extract; you must run OCR (optical character recognition) first.

The killer skill is **detecting which kind you have** and routing accordingly. A quick test: extract text; if a page yields almost no characters but has an image covering the page, it's scanned → send it to OCR.

## Concrete example

`PyMuPDF` (imported as `fitz`) is the fast default for digital PDFs. `pdfplumber` is slower but great for tables and giving you word coordinates.

```python
# pip install pymupdf pdfplumber
import fitz  # PyMuPDF

doc = fitz.open("report.pdf")
for page in doc:
    text = page.get_text("text")          # plain reading-order text
    if len(text.strip()) < 20 and page.get_images():
        print(f"Page {page.number}: likely scanned → route to OCR")
    else:
        print(f"--- Page {page.number} ---\n{text[:300]}")
doc.close()
```

For a table-heavy page, `pdfplumber` respects columns better:

```python
import pdfplumber
with pdfplumber.open("invoice.pdf") as pdf:
    page = pdf.pages[0]
    print(page.extract_text())            # layout-aware text
    for table in page.extract_tables():   # list of rows, each a list of cells
        for row in table:
            print(row)
```

## How a company uses this

A Dubai bank building an internal policy assistant ingests thousands of PDF circulars from the UAE Central Bank. Their pipeline: open each PDF with PyMuPDF, check per page whether a text layer exists, send scanned pages to an OCR service, use a table extractor for the fee-schedule pages, then attach metadata (circular number, date, page) before chunking. The routing logic — not the LLM — is what makes the assistant cite the right clause.

## Common mistakes

- **Assuming all PDFs are digital.** Scanned pages silently return empty strings and you lose whole documents without noticing. Always check character count per page.
- **Ignoring reading order.** Two-column layouts extracted naively interleave columns line-by-line into word salad. Use a layout-aware extractor for those.
- **Keeping running headers/footers.** "Confidential — Page 12 of 300" repeated on every page pollutes your chunks and embeddings. Strip repeated lines.
- **Losing page numbers.** You need them for citations. Capture page metadata during extraction, not after.

## Interview tip

If asked "how would you build ingestion for a RAG system over PDFs," don't jump to a library name. Say: **"First I'd classify each PDF — digital, complex-layout, or scanned — because each needs a different path, and scanned PDFs need OCR."** Naming that fork immediately signals you've actually shipped document ingestion and know that a single `extract_text()` call is not a real answer.
