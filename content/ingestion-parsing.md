# Ingestion & Parsing

**The one-line idea:** Ingestion & parsing is the messy first step of RAG — taking real-world files (PDFs, web pages, Word docs, spreadsheets, scanned images) and turning them into clean, plain text your system can chunk, embed, and search.

## Why we even need it

Every RAG demo starts with a tidy `.txt` file. Every real project starts with a folder of 400 PDFs, some of them scanned photocopies, a few web pages, an Excel export, and a Word doc your client swears is "basically just text."

Machines don't read documents the way you do. A PDF isn't text — it's a set of drawing instructions ("put the glyph 'A' at coordinates 72,140"). A web page is text buried inside nested HTML tags, ads, and navigation menus. A scanned contract is literally just a picture of words. Before any of the smart RAG stuff can happen, you have to **extract the actual words, in the right reading order, without the junk.**

Get this wrong and everything downstream is poisoned: if the parser reads a two-column PDF straight across instead of column-by-column, your chunks are scrambled gibberish and no embedding model can save them. Garbage in, garbage retrieved.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 PDF</span>
    <span class="dbox gray">🌐 HTML</span>
    <span class="dbox gray">📝 DOCX</span>
    <span class="dbox gray">📊 CSV</span>
    <span class="dbox gray">🖼️ Scan</span>
    <span class="darr">→<span class="lbl">parse + clean</span></span>
    <span class="dbox orange">📃 clean text<span class="sub">+ metadata</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">✂️ ready to chunk</span>
  </div>
  <div class="dcap">Ingestion turns many messy formats into one clean, structured text stream — the input every later RAG step assumes you already have.</div>
</div>

## Why it's harder than it looks

Four things make parsing genuinely painful:

1. **Layout.** Multi-column pages, headers, footers, sidebars, and footnotes all interleave in the raw byte order. Reading order is not file order.
2. **Tables.** A table means something *because* of its rows and columns. Flatten it to a wall of numbers and the meaning evaporates.
3. **Scans and images.** No text exists at all — you need OCR (optical character recognition) to *guess* the letters from pixels, and it makes mistakes.
4. **Encoding and noise.** Weird characters, ligatures (ﬁ), soft hyphens, page numbers repeated on every page, boilerplate legal footers — all of it becomes noise in your chunks unless you strip it.

So "ingestion" isn't one function. It's a small pipeline: **detect the format → extract → reconstruct layout → clean → attach metadata.**

## The pieces you'll learn (and when to reach for each)

| Tile | What it handles | Reach for it when |
|---|---|---|
| **PDF** | The most common and messiest source | you have reports, contracts, papers |
| **HTML** | Web pages, docs sites, wikis | scraping or crawling web content |
| **DOCX / MD** | Word docs, Markdown | office documents, internal wikis |
| **CSV / tables** | Rows and columns as data | spreadsheets, exports, structured records |
| **OCR** | Reading text from pixels | scanned PDFs, photos, images of text |
| **Table & layout extraction** | Preserving rows/columns/reading order | financial reports, forms, multi-column pages |
| **unstructured.io** | One library, many formats | you want a single tool for a mixed folder |
| **PyMuPDF** | Fast, precise PDF text + image extraction | PDF-heavy pipelines needing control/speed |
| **Cleaning & normalization** | Stripping noise, fixing encoding | always — the finishing pass on every doc |
| **Metadata extraction** | Capturing source, page, title, date | so you can filter and cite retrieved chunks |

Two of these — **cleaning** and **metadata** — apply to *everything*, not just one format. The rest are format-specialists you pick based on what's in your folder.

## Real world: how a company uses this

> **A Dubai bank** building an internal policy assistant found its retrieval was randomly wrong. The cause wasn't the model — it was ingestion. Half their policy PDFs were scanned images (no extractable text), so those documents silently contributed *nothing*. Adding an **OCR step** for scanned pages, **table extraction** for the fee schedules, and **metadata** tagging each chunk with its policy number and effective date turned a broken demo into a shippable product. The LLM never changed.

## Interview tip
Say: *"Ingestion is where most RAG projects quietly break. Before I chunk anything, I detect each file's format, extract text while preserving reading order and tables, run OCR on scanned pages, then clean out boilerplate and normalize encoding — and I attach metadata like source, page, and date to every chunk so I can filter and cite. I treat parsing quality as a first-class metric, because no embedding model can recover text the parser mangled."* That signals you've actually shipped RAG on real documents, not just clean samples.

---

*Below: deep-dive articles on each ingestion & parsing tool.*
