# Document AI

**What it is:** turning a document image into **structured data** — not just the raw text ([OCR](./ocr.md)), but the actual *fields*: invoice number, total, due date, buyer, line items — as clean JSON.

## Why it matters for an AI Engineer

Businesses run on documents: invoices, purchase orders, IDs, contracts, KYC forms, bank statements. Someone has to type the numbers off those documents into a system — a soul-crushing, error-prone, expensive job done by armies of people. Document AI automates it. This is one of the **highest-ROI, most-demanded** applied-AI features in enterprise and government (huge in Dubai's finance, insurance, and public sectors). If you can reliably turn a photographed invoice into `{"total": 1500, "vendor": "...", "due_date": "..."}`, you can save a company real money — and that's a concrete thing to point at in an interview.

## The mechanism / how it works

Document AI is a pipeline that goes beyond raw text to capture **layout and meaning**:

1. **OCR** extracts the text *and its coordinates* (where each word sits on the page).
2. **Layout understanding.** The key insight: **position carries meaning.** The number next to the word "Total" is the total. A model must understand the 2D structure — tables, key-value pairs, columns — not just a flat text dump. Specialist models like **LayoutLM** fuse text + position + visual features to learn this.
3. **Field extraction.** Map the understood layout to your target schema: pull the entities you care about (dates, amounts, names) and their relationships (which price belongs to which line item).
4. **Validation.** Check the extraction makes sense — do the line items sum to the total? Is the date valid? Is the IBAN well-formed? This catches errors before they hit your database.

Two ways to build it in 2026:

- **Specialist services** — AWS Textract, Azure Document Intelligence, Google Document AI. Pre-trained on invoices/IDs/forms, return structured fields out of the box. Reliable, but rigid and per-page priced.
- **VLM + structured output** — send the document to a [Vision LLM](./vision-llms-vlms.md) and demand JSON matching your schema. Massively flexible (any document type, no training) and the fast-growing default. You enforce the shape with a JSON schema so the output is always parseable.

## Concrete example

VLM with a guaranteed schema (Pydantic + structured output):

```python
from pydantic import BaseModel
from openai import OpenAI
client = OpenAI()

class LineItem(BaseModel):
    description: str
    amount: float

class Invoice(BaseModel):
    invoice_number: str
    vendor: str
    due_date: str
    total: float
    line_items: list[LineItem]

resp = client.chat.completions.parse(   # structured output → validated object
    model="gpt-4o",
    messages=[{"role": "user", "content": [
        {"type": "text", "text": "Extract the invoice fields."},
        {"type": "image_url", "image_url": {"url": "https://x/invoice.jpg"}},
    ]}],
    response_format=Invoice,
)
inv = resp.choices[0].message.parsed
assert abs(sum(li.amount for li in inv.line_items) - inv.total) < 0.01   # validate
print(inv.total, inv.vendor)
```

The `response_format=Invoice` guarantees the model returns something matching your schema — no fragile string-parsing.

## How a company uses this

> A **Dubai trade-finance firm** processes thousands of supplier invoices weekly for reconciliation. Before: clerks keyed each one by hand — slow, ~3% error rate. Now: a VLM extracts fields into the `Invoice` schema, a validation layer checks line items sum to total and flags mismatches for human review, and only the flagged ~10% touch a human. Result: **~90% less manual keying**, errors caught by the sum-check instead of surfacing in accounting later. Cost: a few cents per invoice vs. minutes of labor — trivially worth it. The production lesson: **the validation layer matters as much as the model.** The VLM occasionally swaps a subtotal for the total; the automated sum-check is what makes the system trustworthy enough to run without a human on every doc.

## Common mistakes / misconceptions

- **Stopping at OCR.** Raw text isn't structured data. Without layout understanding you don't know which number is the total.
- **No validation layer.** Trusting extracted fields blindly puts model hallucinations straight into your accounts. Always cross-check (sums, formats, ranges).
- **Free-text JSON prompting.** "Return JSON" without a schema gives you inconsistent keys and parse failures. Use structured output / a schema.
- **One prompt for every document type.** An invoice, an ID, and a contract need different schemas and validation rules.

## Interview tip
Say: *"Document AI goes beyond OCR: OCR gives text-plus-coordinates, then a layout-aware step maps position to meaning — the number next to 'Total' is the total. I'd use a VLM with a Pydantic schema for structured output, then a validation layer that cross-checks (line items sum to total) and routes failures to humans. The validation layer is what makes it production-safe."* Emphasizing layout-carries-meaning and the validation gate is exactly what separates this from OCR.
