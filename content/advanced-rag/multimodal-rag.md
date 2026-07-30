# Multimodal RAG

**What it is:** Multimodal RAG lets your retrieval system search over **images, tables, diagrams, charts, and scanned pages** — not just plain text — so a question can pull back the *screenshot* or *floor plan* that actually holds the answer.

## Why it matters for an AI Engineer

Text-only RAG has a blind spot: an enormous amount of real knowledge is *visual*. A product manual's key info is a wiring diagram. A financial report's answer is a bar chart. A real-estate listing's answer is a floor plan. A support ticket's answer is a screenshot of the error.

A normal text embedder can't see any of it — it embeds the surrounding caption at best and the image itself not at all. So when a user asks *"what does the red warning icon in the dashboard mean?"* the relevant page is *invisible* to retrieval. Multimodal RAG closes this gap, and in 2026 it's increasingly expected: PDFs, slide decks, and scanned documents are the default corpus in most enterprises, and they're full of non-text content.

## The mechanism / how it works

There are two main approaches, and you should know both.

**Approach A — Shared multimodal embeddings.** Use an embedding model that maps *both* images and text into the **same vector space**. The classic is **CLIP**; 2026 production systems more often use stronger multimodal embedders (Cohere Embed v4, Voyage multimodal, Nomic, Jina CLIP). Because text and images share one space, you embed the user's *text* question and retrieve *images* whose vectors are nearby — cross-modal search "just works."

**Approach B — Describe-then-embed (multimodal summaries).** Run each image/table/chart through a vision-language model (GPT-4o, Claude, Gemini) to produce a rich *text description*, embed that text normally, and store it pointing back to the original image. At query time you retrieve on the description but feed the *original image* to the answering model. This is often more accurate for dense tables and diagrams because the VLM "reads" them.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📄 PDF page</span>
      <span class="darr">→</span>
      <span class="dbox orange">🖼️ image</span>
      <span class="dbox orange">📊 table</span>
      <span class="dbox orange">📝 text</span>
    </div>
    <span class="darr">↓<span class="lbl">embed all into ONE vector space</span></span>
    <span class="dbox blue">🗄️ multimodal vector index</span>
    <span class="darr">↓<span class="lbl">text question</span></span>
    <span class="dbox purple">🧠 VLM answers from retrieved image + text</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ grounded answer</span>
  </div>
  <div class="dcap">A text question retrieves images because both live in one shared embedding space; a vision model reads the retrieved image to answer.</div>
</div>

The critical requirement: your final answering model must itself be **multimodal** (accept image inputs), or you fall back to Approach B's text descriptions.

## A concrete example

Approach B (describe-then-embed) is the most robust and easiest to run. Here we summarize an image with a vision model, then answer using the original image:

```python
import base64
from openai import OpenAI

client = OpenAI()

def encode(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

img = encode("dashboard.png")

# INGEST: get a searchable text description to embed & store.
desc = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": [
        {"type": "text", "text": "Describe this UI in detail for search."},
        {"type": "image_url",
         "image_url": {"url": f"data:image/png;base64,{img}"}},
    ]}],
).choices[0].message.content
# → embed `desc` with your text embedder, store it -> image path.

# QUERY: retrieval matched this image; now answer from the REAL image.
answer = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": [
        {"type": "text", "text": "What does the red warning icon mean?"},
        {"type": "image_url",
         "image_url": {"url": f"data:image/png;base64,{img}"}},
    ]}],
)
print(answer.choices[0].message.content)
```

For Approach A, you'd instead call a multimodal embedding endpoint (e.g. Cohere `embed-v4` with `input_type="image"`) so text queries and image vectors share one space — see [../embeddings-indexing.md](../embeddings-indexing.md).

## How a company uses this

A **Dubai property developer's** sales assistant kept failing on *"show me the 2-bedroom layout in Building C."* The floor plans were images inside brochures — invisible to text RAG. They added Approach B: each floor plan was described by a vision model, those descriptions embedded and indexed, and at answer-time the assistant retrieves the *actual* plan image and a multimodal model explains room sizes and orientation. Conversion on layout questions jumped because the assistant could finally "see" the drawings buyers asked about.

## Common mistakes / misconceptions

- **Embedding only the caption.** The caption isn't the image. Either use a true multimodal embedder or generate a full VLM description — otherwise the image content is unsearchable.
- **Forgetting the answering model must be multimodal.** Retrieving the right image is useless if your generator can't read it. Use a vision-capable model or feed it the text description.
- **Ignoring tables.** Tables are a special pain — a naive parse mangles rows/columns. Treat tables like images: have a VLM read them, or extract them structurally during [../ingestion-parsing.md](../ingestion-parsing.md).

## Interview tip
Say: *"Multimodal RAG handles knowledge that lives in images, charts, and scanned pages. Two approaches: shared multimodal embeddings like CLIP or Cohere Embed v4 so a text query retrieves images in one vector space, or describe-then-embed where a vision model summarizes each image into searchable text that points back to the original. Either way the answering model has to be multimodal to actually read what's retrieved."* That shows you know real corpora aren't pure text.
