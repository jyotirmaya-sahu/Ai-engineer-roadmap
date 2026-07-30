# OCR

**What it is:** Optical Character Recognition — turning a *picture of text* (a scan, a photo, an image-only PDF) into actual machine-readable characters your pipeline can process.

## Why it matters for an AI Engineer

A staggering amount of business knowledge exists only as images: scanned contracts, photographed receipts, faxed forms, old archives, ID documents, handwritten notes. To a normal text extractor these are invisible — they return empty strings. OCR is the *only* bridge from that world into your RAG system. In a place like Dubai, where trade, banking, and government still generate mountains of scanned Arabic/English paperwork, OCR is often the difference between "we can ingest 40% of our documents" and "we can ingest all of them." It's also the step where the most silent data loss happens, so knowing its limits is critical.

## The mechanism — how OCR reads an image

OCR runs in stages:

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🖼️ Image of text</span>
    <span class="darr">→</span>
    <span class="dbox orange">Preprocess<span class="sub">deskew, denoise, threshold</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">Detect text regions</span>
    <span class="darr">→</span>
    <span class="dbox purple">Recognize characters<span class="sub">neural model</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Text + confidence</span>
  </div>
  <div class="dcap">Clean the image first — OCR quality is decided before recognition even starts.</div>
</div>

1. **Preprocessing** — straighten a tilted scan (deskew), remove speckles (denoise), and convert to clean black-on-white (thresholding). This step matters *more than the model*: a crooked, gray, low-res scan wrecks accuracy no matter how good the recognizer is.
2. **Text detection** — find *where* the text is on the page (lines, words, blocks).
3. **Recognition** — a neural network maps each region to characters, using a language model to prefer real words ("cl" vs "d").
4. **Output with confidence** — good engines give a per-word confidence score, so you can flag low-confidence text for review instead of trusting it blindly.

Two big real-world factors: **resolution** (aim for ~300 DPI; low-res photos hurt) and **language** (you must tell the engine the language(s) — English + Arabic (`ara`) for the UAE — or it guesses wrong).

## Concrete example

`pytesseract` wraps Google's Tesseract engine — the standard open-source OCR. Install the engine (`brew install tesseract` / `apt install tesseract-ocr`) plus the Python wrapper.

```python
# pip install pytesseract pillow
import pytesseract
from PIL import Image, ImageOps

img = Image.open("scanned_contract.png")

# minimal preprocessing: grayscale + autocontrast helps a lot
img = ImageOps.grayscale(img)
img = ImageOps.autocontrast(img)

text = pytesseract.image_to_string(img, lang="eng+ara")  # English + Arabic
print(text[:400])

# per-word confidence — flag anything the engine wasn't sure about
data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
for word, conf in zip(data["text"], data["conf"]):
    if word.strip() and int(conf) < 60:
        print(f"LOW CONFIDENCE ({conf}): {word!r}")
```

For a scanned PDF, render each page to an image first (PyMuPDF does this), then OCR the image. Higher render DPI = better OCR:

```python
import fitz
page = fitz.open("scan.pdf")[0]
pix = page.get_pixmap(dpi=300)         # render at 300 DPI, not default 72
pix.save("page.png")
```

## How a company uses this

A Dubai trade-finance team ingests scanned bills of lading and invoices submitted by clients. Their pipeline renders each scanned page at 300 DPI, runs Tesseract in `eng+ara`, and routes any page with average confidence below a threshold to a human reviewer. High-confidence pages flow straight into the RAG index. That confidence gate is what makes it safe to automate a compliance-sensitive process.

## Common mistakes

- **Skipping preprocessing.** Feeding raw crooked, low-contrast scans and blaming the model. Deskew and threshold first.
- **Wrong/missing language.** Default English-only OCR mangles Arabic (and vice versa). Always set `lang`.
- **Trusting OCR output blindly.** OCR *will* misread — `0/O`, `1/l`, `5/S`. Use confidence scores and expect errors; never treat OCR text as ground truth for legal/financial values without a check.
- **Low resolution.** OCR-ing a phone photo at 72 DPI. Push for 300 DPI.

## Interview tip

Emphasize that **OCR output is noisy by nature** and design around it: *"I'd use confidence scores to route low-confidence pages to human review, and I'd never treat OCR'd figures as authoritative without validation."* Showing you plan for OCR errors — rather than assuming clean text — signals you've run OCR in production, not just in a demo.
