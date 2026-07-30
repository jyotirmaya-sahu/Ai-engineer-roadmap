# Metadata Extraction

**What it is:** capturing the *facts about* a document — its source, title, author, date, page number, section — and attaching them to every chunk, so your RAG system can filter, cite, and rank on more than just the raw text.

## Why it matters for an AI Engineer

Text alone answers "what does this say?" Metadata answers "where is this from, how fresh is it, and can I trust it?" Those questions are the difference between a demo and a production system. Metadata lets you **filter** ("only search 2026 policies"), **cite** ("per the HR handbook, page 12"), and **rank** (prefer newer documents). Without it, a user can't verify an answer and you can't scope a search — two things enterprises absolutely require. In regulated Dubai sectors (banking, legal, healthcare), citing the exact source document, version, and page isn't a nice-to-have; it's often a compliance requirement. Metadata is what makes RAG trustworthy.

## The mechanism — three sources of metadata

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox blue">📁 File-level<span class="sub">filename, path, size, dates</span></span>
      <span class="dbox blue">📄 Document-level<span class="sub">title, author, PDF props</span></span>
      <span class="dbox blue">🔎 Content-level<span class="sub">section, page, entities</span></span>
    </div>
    <span class="darr">↓</span>
    <span class="dbox orange">Attach to every chunk</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ filter · cite · rank</span>
  </div>
  <div class="dcap">Gather metadata from file, document, and content — then carry it alongside each chunk into the vector DB.</div>
</div>

1. **File-level** — from the filesystem: filename, folder path, file size, created/modified dates. Free and always available.
2. **Document-level** — embedded properties: PDF title/author/creation date (`doc.metadata` in PyMuPDF), DOCX core properties, HTML `<meta>` tags and `<title>`.
3. **Content-level** — derived from the text itself: which **section/heading** a chunk falls under, its **page number**, and optionally extracted entities (dates, names, invoice numbers) or an LLM-generated summary/keywords.

The core idea: **metadata travels with the chunk.** When you store a chunk in a vector DB, you store its metadata alongside the embedding. Then at query time you can do **metadata filtering** ("search only chunks where `year >= 2025` and `department = 'Finance'`") *before or alongside* the vector search — dramatically narrowing and sharpening results.

## Concrete example

Building chunk records with metadata using PyMuPDF, ready for a vector store:

```python
# pip install pymupdf
import fitz, os, datetime

def extract_with_metadata(path: str) -> list[dict]:
    doc = fitz.open(path)
    props = doc.metadata  # PDF's own title/author/dates

    base = {
        "source": os.path.basename(path),
        "path": path,
        "title": props.get("title") or os.path.basename(path),
        "author": props.get("author"),
        "modified": datetime.datetime.fromtimestamp(
            os.path.getmtime(path)).date().isoformat(),
    }

    records = []
    for page in doc:
        records.append({
            "text": page.get_text("text"),
            "metadata": {**base, "page": page.number + 1},  # page-level citation
        })
    doc.close()
    return records

recs = extract_with_metadata("hr_handbook.pdf")
print(recs[0]["metadata"])
# {'source': 'hr_handbook.pdf', 'title': 'HR Handbook 2026', 'page': 1, ...}
```

Most vector DBs then let you filter on that metadata at query time. Conceptually:

```python
# pseudo-code — every major vector DB supports metadata filters
results = vector_db.search(
    query_embedding,
    filter={"source": "hr_handbook.pdf", "page": {"$gte": 10}},
    top_k=5,
)
```

## How a company uses this

A Dubai bank's compliance assistant must cite the exact regulation. During ingestion, each chunk is tagged with source document, circular number, issue date, and page. At query time it filters to `status = "in-force"` and the relevant year, then every answer ends with "(Circular 14/2025, p.7)." The metadata is what turns an unverifiable chatbot reply into an auditable, compliant answer.

## Common mistakes

- **Text-only chunks.** Storing embeddings with no metadata makes filtering and citation impossible later — and retrofitting means re-ingesting everything.
- **No page/section reference.** Users can't verify answers without a locator. Capture page and section during extraction, not after.
- **Ignoring dates → stale answers.** Without a date field you can't prefer current documents, so the system happily cites an expired policy.
- **Over-collecting.** You don't need every PDF property. Capture what you'll actually filter, cite, or rank on.
- **Inconsistent schemas.** Mixed field names (`date` vs `created` vs `issued`) break filters. Standardize the metadata schema across all sources.

## Interview tip

Tie metadata to **filtering and citation**, the two things interviewers care about: *"I attach source, date, page, and section to every chunk so I can do metadata-filtered retrieval — e.g. only in-force 2026 policies — and cite the exact page in the answer."* Mentioning **pre-filtering by metadata before vector search** shows you understand it also improves relevance and cost, not just trust.
