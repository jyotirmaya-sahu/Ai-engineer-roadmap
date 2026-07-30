# Image understanding

**What it is:** getting a model to make sense of what's *in* an image — classifying it, detecting objects, or describing the scene.

## Why it matters for an AI Engineer

A huge share of real-world data is pixels: product photos, medical scans, security footage, screenshots, uploaded receipts. Image understanding is the umbrella skill for turning those pixels into something your app can act on — a label, a bounding box, a caption. It's the foundation the fancier stuff ([Vision LLMs](./vision-llms-vlms.md), [OCR](./ocr.md), [Document AI](./document-ai.md)) sits on top of. Even in the age of giant multimodal models, a small dedicated classifier is often the right answer: it's **10–100× cheaper and faster** than calling a VLM for a yes/no question, and you can run millions of images through it.

## The mechanism / how it works

There's a ladder of image-understanding tasks, from coarse to fine:

- **Classification:** one label for the whole image ("cat", "invoice", "defective"). Cheapest.
- **Object detection:** *what* is in the image *and where* — bounding boxes with labels ("car at these coordinates"). Think YOLO.
- **Segmentation:** which exact pixels belong to each object (a precise mask, not just a box).
- **Captioning / description:** a natural-language sentence about the scene.

How does a model "see"? The classic engine is a **Convolutional Neural Network (CNN)** or a **Vision Transformer (ViT)**. Both turn an image into a vector of numbers — an **embedding** — that captures its content. Early layers detect edges and textures; deeper layers combine them into "wheel", "face", "text block". The final embedding can then be classified, or compared against other embeddings for search.

A pivotal idea is **CLIP** (Contrastive Language-Image Pre-training): it trains an image encoder and a text encoder into the **same embedding space**, so the vector for a photo of a dog sits near the vector for the words "a dog". That unlocks **zero-shot classification** — you can classify an image into *any* labels you type at runtime, no retraining:

## Concrete example

Zero-shot classification with CLIP — no training, labels defined at call time:

```python
from transformers import pipeline

clf = pipeline("zero-shot-image-classification",
               model="openai/clip-vit-large-patch14")

result = clf("delivery_photo.jpg",
             candidate_labels=["package delivered at door",
                               "package missing",
                               "wrong address photo"])
for r in result:
    print(f"{r['label']}: {r['score']:.2f}")
```

Fast object detection with YOLO:

```python
from ultralytics import YOLO

model = YOLO("yolo11n.pt")           # nano = fast, runs on CPU/edge
results = model("warehouse.jpg")
for box in results[0].boxes:
    label = model.names[int(box.cls)]
    print(label, box.conf.item())
```

## How a company uses this

> A **Dubai logistics company** verifies proof-of-delivery photos. Couriers snap a photo at drop-off; a lightweight **CLIP zero-shot classifier** checks "package visible at door" vs "no package / blurry / selfie" before the delivery is marked complete. Scale: ~200,000 deliveries/day. A VLM call at ~$0.002–0.01 each would cost thousands daily and add latency; the self-hosted CLIP model runs the same check for a fraction of a cent and returns in ~30ms. They only escalate the *ambiguous* 3% to a bigger VLM. That tiered design — cheap classifier first, expensive model only on the hard cases — is the production pattern.

## Common mistakes / misconceptions

- **Reaching for a VLM for everything.** For a fixed yes/no or a known label set, a classifier is orders of magnitude cheaper and faster.
- **Confusing classification with detection.** "Is there a car?" (classify) vs "where are the cars?" (detect) are different models and costs.
- **Ignoring image preprocessing.** Wrong resolution, aspect ratio, or color space quietly tanks accuracy — match the model's expected input.
- **No confidence threshold.** Every model returns *a* label; without a threshold you'll act on 0.31-confidence garbage.

## Interview tip
Say: *"Image understanding is a ladder — classify, detect, segment, caption — and I match the tool to the task. For fixed label sets I use a cheap CLIP or YOLO model self-hosted, and only escalate ambiguous cases to a VLM. CLIP's shared image-text embedding space is what makes zero-shot classification possible without retraining."* Naming the cost tiering and CLIP's shared space signals production judgment, not just API-calling.
