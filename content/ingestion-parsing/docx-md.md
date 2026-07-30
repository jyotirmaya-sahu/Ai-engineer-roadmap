# Parsing DOCX / Markdown

**What it is:** extracting text from Word documents (`.docx`) and Markdown files (`.md`) — two formats that already carry *structure* (headings, lists, tables), which you want to keep rather than throw away.

## Why it matters for an AI Engineer

Word is the default document format in almost every business on earth. Internal reports, proposals, SOPs, HR policies, meeting notes — they're `.docx`. Markdown, meanwhile, is how engineers write docs: READMEs, wikis, Notion/Confluence exports, technical guides. Both are far friendlier than PDFs because the structure is *explicit and reliable* — a `<w:heading>` in DOCX or a `##` in Markdown genuinely means "this is a heading." An AI Engineer who preserves that structure gets clean, natural chunk boundaries for free, which lifts retrieval quality.

## The mechanism

A `.docx` file is secretly a **ZIP archive of XML files**. Rename it to `.zip` and unzip — you'll find `document.xml` describing paragraphs, runs, and styles. You don't parse that XML by hand; the `python-docx` library does it and hands you paragraphs and tables as objects.

Markdown is even simpler: it's plain text with lightweight symbols (`#` heading, `-` list, `|` table, and fenced code blocks). It's already human-readable, so you can often use it nearly as-is — the job is just parsing those symbols into structure when you need it.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📝 .docx (zip of XML)</span>
      <span class="darr">→</span>
      <span class="dbox">python-docx</span>
      <span class="darr">→</span>
      <span class="dbox orange">paragraphs + styles + tables</span>
      <span class="darr">→</span>
      <span class="dbox green">✅ structured text</span>
    </div>
    <div class="flow">
      <span class="dbox gray">📄 .md (plain text)</span>
      <span class="darr">→</span>
      <span class="dbox">read directly / parse symbols</span>
      <span class="darr">→</span>
      <span class="dbox green">✅ headings already marked</span>
    </div>
  </div>
  <div class="dcap">Both formats hand you real structure — keep the headings, they're free chunk boundaries.</div>
</div>

The key move for both: **use the heading levels**. When you know paragraph X is Heading 1 and the next few are body text, you can chunk *by section* instead of by blind character count — a big win covered in the chunking node.

## Concrete example

Reading a `.docx`, keeping headings visible and pulling tables:

```python
# pip install python-docx
from docx import Document

doc = Document("policy.docx")

for para in doc.paragraphs:
    if not para.text.strip():
        continue
    style = para.style.name          # e.g. "Heading 1", "Normal"
    if style.startswith("Heading"):
        print(f"\n# {para.text}  [{style}]")
    else:
        print(para.text)

# Tables are separate objects, not part of paragraphs
for table in doc.tables:
    for row in table.rows:
        print([cell.text for cell in row.cells])
```

Markdown — read it, and if you want structured headings, parse them:

```python
from pathlib import Path

md = Path("guide.md").read_text(encoding="utf-8")

# Simple: split into sections at each top-level "## " heading
sections, current = [], []
for line in md.splitlines():
    if line.startswith("## ") and current:
        sections.append("\n".join(current))
        current = []
    current.append(line)
sections.append("\n".join(current))
print(f"{len(sections)} sections found")
```

## How a company uses this

A Dubai consultancy stores every client proposal as `.docx`. To build a "find similar past proposals" tool, they parse each file with `python-docx`, keep the Heading styles to detect sections (Scope, Timeline, Pricing), pull the pricing tables separately, and chunk per section. The heading metadata later lets the retriever return "the Pricing section of proposal Y" rather than a random 500-character window.

## Common mistakes

- **Ignoring tables in DOCX.** `doc.paragraphs` does *not* include table content — tables are a separate collection. Miss `doc.tables` and you silently drop data.
- **Treating `.doc` like `.docx`.** The old binary `.doc` format is not a ZIP of XML; `python-docx` won't open it. Convert to `.docx` first (e.g. with LibreOffice headless).
- **Flattening Markdown headings.** Stripping the `#` symbols destroys the one signal that gives you perfect chunk boundaries. Preserve them.
- **Losing lists and formatting meaning.** Bullet lists often encode distinct facts; collapsing them into a paragraph blurs them.

## Interview tip

Contrast these formats with PDF: *"DOCX and Markdown carry reliable, explicit structure, so I chunk by heading section instead of fixed size — cleaner boundaries than PDF, where structure has to be reconstructed."* Showing that you pick your chunking strategy based on how trustworthy the source structure is signals real ingestion experience.
