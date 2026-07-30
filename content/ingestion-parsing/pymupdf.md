# PyMuPDF

**What it is:** a fast, batteries-included Python library for reading PDFs (and other formats), imported as `fitz`. It's the go-to for pulling text, images, links, and metadata out of digital PDFs quickly — and for rendering pages to images when you need OCR.

## Why it matters for an AI Engineer

PyMuPDF is probably the single most useful ingestion library to know by name. It's *fast* (C-backed), handles the common case (digital PDFs with a real text layer) extremely well, and does the supporting jobs you constantly need: reading page-by-page, extracting embedded images, getting document metadata, and rendering pages to images at controllable DPI so you can hand scanned pages to OCR. When an interviewer asks "how would you get text out of a PDF," `fitz` is the credible, production-grade default answer.

## The mechanism — what fitz gives you

You open a document, iterate pages, and ask each page for what you need. The important detail is **`page.get_text()` has modes**, and picking the right one changes everything:

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📄 PDF</span>
      <span class="darr">→</span>
      <span class="dbox purple">fitz.open()</span>
      <span class="darr">→</span>
      <span class="dbox">iterate pages</span>
    </div>
    <span class="darr">↓</span>
    <div class="flow">
      <span class="dbox orange">"text"<span class="sub">plain reading order</span></span>
      <span class="dbox orange">"blocks"<span class="sub">text + coordinates</span></span>
      <span class="dbox orange">"dict"<span class="sub">full structure/fonts</span></span>
      <span class="dbox blue">get_pixmap()<span class="sub">→ image for OCR</span></span>
    </div>
  </div>
  <div class="dcap">One library, several output modes — plain text for the easy case, coordinates when you need layout.</div>
</div>

- **`"text"`** — clean reading-order plain text. Your default for digital PDFs.
- **`"blocks"`** — returns text chunks *with their (x, y) coordinates*, so you can reason about layout (columns, position of headers) yourself.
- **`"dict"`** — the full tree: blocks → lines → spans, with font, size, and position. Use it to detect headings (big/bold spans) for structure-aware chunking.
- **`get_pixmap(dpi=...)`** — renders a page to an image. This is how you turn scanned/complex pages into PNGs to send to OCR (see the OCR tile).

Plus `doc.metadata` (title, author, dates) and `page.get_images()` / `page.get_links()` for images and hyperlinks.

## Concrete example

Extract text, capture page-number metadata for citations, and detect scanned pages to route to OCR:

```python
# pip install pymupdf
import fitz

doc = fitz.open("handbook.pdf")
print("Metadata:", doc.metadata.get("title"), doc.metadata.get("author"))

records = []
for page in doc:
    text = page.get_text("text")
    if len(text.strip()) < 20 and page.get_images():
        # no text layer but has an image → scanned page → OCR path
        pix = page.get_pixmap(dpi=300)
        pix.save(f"page_{page.number}.png")   # hand this to pytesseract next
        text = "[scanned – sent to OCR]"
    records.append({"page": page.number + 1, "text": text})

doc.close()
print(records[0]["page"], records[0]["text"][:120])
```

Detecting headings via the `"dict"` mode (bigger font = likely a heading) for structure-aware chunking:

```python
d = fitz.open("handbook.pdf")[0].get_text("dict")
for block in d["blocks"]:
    for line in block.get("lines", []):
        for span in line["spans"]:
            if span["size"] > 14:            # large font → probable heading
                print("HEADING:", span["text"])
```

## How a company uses this

A Dubai law firm ingests contract PDFs. PyMuPDF extracts the text fast, captures page numbers for clause-level citations, uses `"dict"` mode to detect section headings for clean chunking, and renders the occasional scanned exhibit page at 300 DPI for the OCR step. One library covers text, structure, and the scan-detection fork — which keeps the pipeline simple.

## Common mistakes

- **Confusing the package names.** You `pip install pymupdf` but `import fitz`. This trips people up constantly.
- **Using `"text"` mode on multi-column pages and expecting perfect order.** For tricky layouts, use `"blocks"`/`"dict"` and reason about coordinates, or a layout tool.
- **Forgetting scanned pages.** `get_text()` returns empty on image-only pages. Always check and route to OCR.
- **Rendering at default DPI for OCR.** `get_pixmap()` defaults to ~72 DPI; set `dpi=300` or OCR quality suffers.
- **Not closing documents.** In batch jobs, leaking open handles. Close them (or use them briefly).

## Interview tip

Know the **`get_text` modes** by heart — that's the tell of someone who's really used PyMuPDF: *"I'd use `get_text('text')` for the common case, but `get_text('dict')` when I need font sizes to detect headings, and `get_pixmap(dpi=300)` to render scanned pages for OCR."* And drop the `pip install pymupdf` / `import fitz` gotcha — it signals hands-on experience instantly.
