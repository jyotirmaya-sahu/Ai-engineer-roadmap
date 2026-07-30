# Multimodal

**What it is:** A model that understands more than text — it can take images, audio, and sometimes video as input (and occasionally produce them), all inside the same LLM.

## Why it matters for an AI Engineer

Real business documents aren't clean text. They're scanned invoices, screenshots, product photos, ID cards, X-rays, voice notes. A text-only pipeline needs a separate OCR step, a separate speech-to-text step, then gluing — each a failure point. A multimodal model reads the image or hears the audio *directly*, often more accurately than a bolted-together pipeline, and in one API call. In the Gulf, this unlocks huge use cases: reading Arabic ID cards, processing Arabic voice calls, checking retail shelf photos. Knowing when a task is multimodal — and that you don't need three separate models — is a practical selection skill.

## The mechanism / how it works

Under the hood, a multimodal model turns every input type into the same currency: **tokens** in a shared embedding space, so the transformer can reason across them together.

- **Text** → tokenized normally.
- **Images** → sliced into patches; a vision encoder turns each patch into embedding vectors that sit alongside text tokens. The model literally "sees" the image as a sequence of tokens it can attend to while reading your text question. A typical image costs a few hundred to ~1,500 tokens depending on resolution — which matters for cost and context budget.
- **Audio** → either converted to a spectrogram and encoded like an image, or transcribed internally, then fed as tokens.

Because everything becomes tokens in one space, the model can answer "what's the total on this invoice and is it above the approved limit?" by reading the image *and* reasoning over your text rule in a single pass — no separate OCR call.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🖼️ Image</span>
    <span class="dbox gray">🔊 Audio</span>
    <span class="dbox gray">📄 Text</span>
    <span class="darr">→<span class="lbl">encode</span></span>
    <span class="dbox orange">🔢 shared tokens</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 one model</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ answer</span>
  </div>
  <div class="dcap">Every input type becomes tokens in one space, so the model reasons across image, audio, and text together.</div>
</div>

Note: most "multimodal" models are multimodal *in* (understand images/audio) but text *out*. Generating images or audio is usually a *different* model (e.g. an image-generation model). Don't assume one model does both directions.

## Concrete example — read an invoice image directly

```python
import base64
from anthropic import Anthropic
client = Anthropic()

img = base64.b64encode(open("invoice.jpg", "rb").read()).decode()
resp = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=300,
    messages=[{"role": "user", "content": [
        {"type": "image", "source": {"type": "base64",
            "media_type": "image/jpeg", "data": img}},
        {"type": "text", "text": "Extract vendor, total, and VAT as JSON."},
    ]}],
)
print(resp.content[0].text)   # {"vendor": "...", "total": 4200, "vat": 210}
```

No OCR library, no separate step — the model reads the pixels and returns structured data.

## How a company uses this

A Dubai insurance firm automating motor-claim intake used to run a three-stage pipeline: OCR the damage-report photos, speech-to-text the customer's voice note, then an LLM to combine them. It broke constantly — OCR mangled Arabic handwriting, and the glue code lost context. They replaced it with a single multimodal model that ingests the damage photos and the audio note together and outputs a structured claim summary. Accuracy on Arabic fields rose ~15 points and the pipeline went from three services to one API call, cutting per-claim latency from ~40s to ~8s. The cost lever they watch: each photo adds ~1,000–1,500 tokens, so they downscale images before sending to stay within budget at ~20k claims/month.

## Common mistakes
- **Assuming multimodal means it can *generate* images/audio** — usually it only *understands* them; generation is a separate model.
- **Sending huge full-resolution images** — you pay per image-token and can blow context; resize to what the task needs.
- **Reaching for multimodal when plain OCR would do** — if you just need clean printed text extraction at massive scale, a cheap dedicated OCR may be faster and cheaper. Match the tool to the task ([Capability vs task](capability-vs-task.md)).

## Interview tip
Say: *"Multimodal models encode images and audio into the same token space as text, so they can reason across all of it in one call — which removes fragile OCR-plus-glue pipelines. Most are multimodal-in, text-out; generating media is a separate model. I watch image-token cost and resize inputs, and in the Gulf multimodal is especially valuable for Arabic documents and voice where a stitched pipeline degrades quality."*
