# OCR

**What it is:** Optical Character Recognition — pulling the *raw text* out of an image of text (a scan, a photo, a screenshot).

## Why it matters for an AI Engineer

Mountains of important information exist only as pixels: scanned contracts, photographed receipts, ID cards, handwritten forms, PDFs that are really just images. An LLM can't reason over text it can't read. OCR is the extractor that converts "picture of words" into actual characters your downstream LLM, search index, or database can use. It's the first stage of nearly every [Document AI](./document-ai.md) pipeline, and a make-or-break quality gate: if OCR misreads "1,500" as "l,5OO", every step after it inherits the error.

## The mechanism / how it works

Classic OCR runs in stages:

1. **Preprocessing.** Deskew (straighten a tilted scan), denoise, boost contrast, binarize (black text on white). Bad input images are the #1 cause of bad OCR — a blurry, shadowed phone photo defeats even good engines.
2. **Text detection.** Find *where* text is — locate lines and word boxes in the image.
3. **Text recognition.** For each box, a neural model (typically a CNN feeding a sequence model like an LSTM or transformer) reads the pixels and outputs characters.
4. **Post-processing.** Language models / dictionaries fix likely errors ("rn"→"m"), and layout logic reassembles reading order.

Two families exist in 2026:

- **Dedicated OCR engines** — **Tesseract** (old, free, decent on clean scans), **PaddleOCR** and **EasyOCR** (modern, deep-learning, handle photos and many scripts including Arabic). Fast, cheap, run locally, great for high volume.
- **VLM-based OCR** — just ask a [Vision LLM](./vision-llms-vlms.md) to "transcribe all text." Slower and pricier per page, but far more robust to messy layouts, handwriting, and mixed languages, and it can *understand* structure at the same time. The 2026 trend is VLMs eating the hard OCR cases while dedicated engines keep the high-volume clean ones.

## Concrete example

Local, multi-language (incl. Arabic) OCR with PaddleOCR:

```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang="ar")   # 'en', 'ch', 'ar', ...
result = ocr.ocr("invoice_scan.jpg")

for line in result[0]:
    box, (text, confidence) = line
    print(f"{confidence:.2f}  {text}")
```

VLM-based OCR for a messy photo (one call, robust):

```python
from openai import OpenAI
client = OpenAI()
resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": [
        {"type": "text", "text": "Transcribe all text exactly, preserving line breaks."},
        {"type": "image_url", "image_url": {"url": "https://x/receipt.jpg"}},
    ]}],
)
print(resp.choices[0].message.content)
```

## How a company uses this

> A **Dubai government service center** digitizes decades of paper records — Arabic and English, many handwritten or faded. Volume: millions of pages. Their tiered pipeline: **PaddleOCR** handles the ~80% of clean typed scans at near-zero marginal cost and ~50ms/page; low-confidence pages (below a threshold) are routed to a **VLM** that handles handwriting and damaged documents at ~$0.005/page. Doing every page through a VLM would cost tens of thousands of dollars and be far slower; doing every page through Tesseract would fail the hard 20%. The **confidence-threshold router** is the whole trick. They also invested heavily in preprocessing — deskew and contrast normalization lifted accuracy more than any model swap.

## Common mistakes / misconceptions

- **Skipping preprocessing.** Deskew/denoise/contrast often beats a fancier model. Garbage image in, garbage text out.
- **Assuming OCR = understanding.** OCR gives you *characters*, not *meaning* or *fields*. Extracting "invoice total" is Document AI, a step further.
- **One engine for everything.** Clean scans and handwritten photos need different tools; route by confidence.
- **Ignoring Arabic/RTL quirks.** Right-to-left scripts, ligatures, and diacritics break naive setups — pick an engine that genuinely supports them.

## Interview tip
Say: *"OCR converts pixels to characters — detect, recognize, post-correct — and preprocessing (deskew, contrast) usually helps more than a bigger model. In 2026 I tier it: a cheap engine like PaddleOCR for clean high-volume scans, and route only low-confidence or handwritten pages to a VLM. OCR gives characters, not fields — turning it into structured data is Document AI."* The confidence-router and OCR-vs-understanding distinction are the signals.
