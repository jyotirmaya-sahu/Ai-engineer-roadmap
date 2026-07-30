# pipelines

**What it is:** Hugging Face's `pipeline()` — a **one-line helper** that wraps the tokenizer + model + post-processing for a given task, so you can run sentiment analysis, summarization, translation, NER, or text generation in a single function call.

## Why it matters for an AI Engineer

Sometimes you just need to *get a task done* without wiring tokenizers and `model.generate` by hand (see [transformers](transformers.md)). `pipeline()` is the fastest path from "I have a model" to "I have a result." It's perfect for prototypes, for the many *classic* NLP tasks that don't need a giant LLM (sentiment, classification, NER, translation run great on tiny fast models), and for demos. As an AI Engineer you should know it exists because reaching for a 175B API model to classify sentiment is wasteful — a 60MB pipeline model does it locally in milliseconds for free. Interviewers like candidates who right-size the tool.

## The mechanism — how it works

You call `pipeline(task, model=...)`. Behind the scenes it:

1. **Loads the right tokenizer and model** for that task from the [Hub](inference-api-hub.md) (auto-picks a sensible default model if you don't name one).
2. **Handles pre-processing** — tokenizing your input correctly for the task.
3. **Runs the model.**
4. **Post-processes** the raw output into a clean Python result — labels with scores, generated strings, extracted entities — so you never touch token IDs.

Common tasks: `"sentiment-analysis"`, `"text-classification"`, `"zero-shot-classification"` (classify into labels you invent at runtime, no training), `"ner"`, `"summarization"`, `"translation"`, `"text-generation"`, `"automatic-speech-recognition"`, `"image-classification"`. You can pass `device=0` to use a GPU and `batch_size` to process many inputs at once. It's the same underlying `transformers` machinery — just with the boilerplate removed.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">"I love this!"</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 pipeline("sentiment-analysis")<span class="sub">tokenize + model + post-process</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ POSITIVE 0.99</span>
  </div>
  <div class="dcap">One call hides tokenizer, model, and post-processing — input in, clean labeled result out.</div>
</div>

## Concrete example

```python
from transformers import pipeline

# 1) Classic sentiment — tiny, fast, local, free
clf = pipeline("sentiment-analysis")
print(clf("The delivery to Dubai Marina was super fast!"))
# [{'label': 'POSITIVE', 'score': 0.9993}]

# 2) Zero-shot: classify into labels you make up at runtime — no training needed
zs = pipeline("zero-shot-classification")
print(zs("My internet keeps dropping every evening.",
         candidate_labels=["billing", "technical", "sales"]))
# {'labels': ['technical', 'billing', 'sales'], 'scores': [0.94, 0.04, 0.02], ...}

# 3) Batch many inputs efficiently
reviews = ["Great!", "Terrible service", "It was okay"]
print(clf(reviews, batch_size=8))
```

Three lines, three real NLP capabilities, none needing an API key or per-token cost.

## How a company uses this

A Dubai customer-support platform routes incoming tickets by topic. **Production reality:** they *don't* send every ticket to a big LLM — that's slow and costs per token at their volume of hundreds of thousands of tickets. Instead a **zero-shot-classification pipeline** running on a small model on one modest GPU tags each ticket (`billing / technical / account / sales`) in **single-digit milliseconds**, essentially free after the hardware. Only the tricky tickets that the pipeline scores with low confidence get escalated to a full LLM. This tiered design — cheap local pipeline first, expensive API only when needed — cut their AI bill by an order of magnitude.

## Common mistakes

- **Reaching for a giant LLM API** for tasks a tiny pipeline model nails (sentiment, classification, NER) — wasteful and slower.
- **Not setting `device=` / `batch_size=`** — running one-at-a-time on CPU when a GPU and batching would be far faster.
- **Assuming the default model is best** — pick a task-appropriate, multilingual model for Arabic/English content.
- **Using pipelines for high-concurrency serving** — great for batch/offline, but for a live API endpoint use a proper serving stack.
- **Ignoring model licenses** — check the Hub model's license before commercial use.

## Interview tip
Say: *"`pipeline()` is the one-liner over transformers for classic tasks — sentiment, zero-shot classification, NER, translation — on small local models that run in milliseconds for free. I use it to right-size: cheap local pipeline for the easy 90% of traffic, escalate only low-confidence cases to a big LLM. Using a frontier API to classify sentiment is a cost smell."* The tiered-routing point shows cost-aware engineering.
