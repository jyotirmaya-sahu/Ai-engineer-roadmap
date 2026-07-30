# Table & Layout Extraction

**What it is:** recovering the *visual structure* of a document — which text is a heading, which region is a table, what the reading order of columns is — not just the raw characters, so your text comes out in the order (and grouping) a human would read it.

## Why it matters for an AI Engineer

Plain text extraction answers "what characters are on the page?" Layout extraction answers "what do they *mean* and in what order?" That difference is everything for complex documents: a two-column research paper, a financial statement full of tables, an invoice with a header block and a line-item grid. Get layout wrong and you produce word salad — columns interleaved, table cells scrambled — which destroys retrieval. Layout-aware extraction is what separates a toy RAG demo from one that works on real enterprise PDFs, and it's a frequent topic when interviewers probe whether you've handled *messy* documents.

## The mechanism — two problems

**1. Reading order (layout).** Text on a page has 2D positions. A naive extractor sorts roughly top-to-bottom and reads *straight across* — so on a two-column page it grabs line 1 of the left column, then line 1 of the right column, and produces nonsense. Layout analysis groups text into **blocks/columns** first, then reads each block top-to-bottom in the right order.

**2. Table structure.** A table is a grid, but on the page it's just text at coordinates (sometimes with lines, sometimes not). Table extraction has to detect the grid and reconstruct rows and columns so each cell lands in the right place.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📄 Complex page<span class="sub">2 columns + a table</span></span>
      <span class="darr">→</span>
      <span class="dbox orange">Detect regions & order</span>
    </div>
    <span class="darr">↓</span>
    <div class="flow">
      <span class="dbox">Column 1 text</span>
      <span class="dbox">Column 2 text</span>
      <span class="dbox blue">Table → rows×cols</span>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Correct reading order + intact table</span>
  </div>
  <div class="dcap">Group into regions, order them, rebuild tables — before you emit any text.</div>
</div>

There are two families of tools:
- **Rule/geometry-based** (pdfplumber, Camelot) — use the actual character coordinates and ruling lines. Fast, deterministic, great when tables have visible borders.
- **Model-based / vision** (LayoutParser, table-transformer models, or modern layout-aware parsers) — a neural net looks at the page like an image and predicts regions. Handles borderless tables and messy scans better, at higher cost.

## Concrete example

`pdfplumber` gives you both layout-aware text *and* table extraction using geometry:

```python
# pip install pdfplumber
import pdfplumber

with pdfplumber.open("financial_report.pdf") as pdf:
    page = pdf.pages[0]

    # layout=True preserves visual positioning / column separation
    print(page.extract_text(layout=True)[:400])

    # detect and reconstruct tables into rows of cells
    for i, table in enumerate(page.extract_tables()):
        print(f"\n--- Table {i} ---")
        header, *rows = table
        for row in rows:
            record = dict(zip(header, row))   # cell values keyed by column
            print(record)
```

For bordered tables that pdfplumber struggles with, `Camelot` is purpose-built:

```python
# pip install "camelot-py[base]"
import camelot
tables = camelot.read_pdf("statement.pdf", pages="1", flavor="lattice")  # ruled tables
print(tables[0].df)          # a pandas DataFrame
print(tables[0].parsing_report)  # accuracy/whitespace diagnostics
```

## How a company uses this

A Dubai investment firm ingests quarterly PDF financial statements. Body text (multi-column commentary) is pulled with layout-aware extraction so columns stay separate; the numeric tables (balance sheet, cash flow) are extracted with a table tool and serialized row-by-row with headers intact. Because layout is respected, the RAG assistant can answer "what was Q3 operating cash flow?" and cite the exact table cell instead of a garbled line.

## Common mistakes

- **Naive extraction on multi-column pages.** The classic interleaved-columns bug. Use layout-aware mode.
- **One tool for all tables.** Bordered tables suit geometry tools (Camelot lattice); borderless ones often need stream mode or a vision model. Match the tool to the table.
- **No accuracy check.** Table extraction is imperfect; a shifted cell corrupts numbers silently. Use the parser's confidence/whitespace report and spot-check.
- **Discarding structure into flat text.** Flattening a recovered table back into a text blob throws away the whole point. Keep it as rows/records.

## Interview tip

Show you know layout extraction is a **spectrum, not a single call**: *"For clean bordered tables I'd use a geometry-based tool like pdfplumber or Camelot; for borderless tables or scans I'd reach for a vision/layout model — and I'd validate extraction accuracy either way."* Naming the geometry-vs-vision trade-off proves you've hit the wall where simple extraction fails.
