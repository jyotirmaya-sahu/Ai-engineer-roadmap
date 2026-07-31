# Inference API & Hub

**What it is:** The **Hugging Face Hub** is the "GitHub for AI models" — a registry of hundreds of thousands of open models, datasets, and demos. The **Inference API** (and its production sibling, Inference Endpoints/Providers) lets you *call those open models over HTTP* without owning a GPU.

## Why it matters for an AI Engineer

This is the bridge between "open models exist" and "I can actually use one." The Hub is where you *find* the right model — a multilingual embedder, an Arabic-capable LLM, a document classifier — and read its card, license, and benchmarks. The Inference API is how you *try it instantly* with a hosted call, exactly like an OpenAI request but pointed at open weights. Together they let you prototype with open models in minutes and, when ready, deploy a dedicated endpoint for production. Knowing this ecosystem means you're not locked to a single closed vendor — a real advantage in cost and compliance conversations, and a common interview topic.

## The mechanism — how it works

**The Hub** hosts model *repositories*, each with:
- **Weights** (pulled by [transformers](transformers.md)/[pipelines](pipelines.md) via `from_pretrained`).
- A **model card** — what it does, training data, benchmarks, and crucially the **license** (some are non-commercial).
- **Tags** for task, language, and library so you can search (e.g. "sentence-similarity, Arabic").

**Serverless Inference API / Providers**: send an HTTP request naming a Hub model; Hugging Face (or a partnered provider) runs it and returns the result. Zero infra, pay-as-you-go, ideal for *trying* models — but cold starts and shared capacity make it unsuitable for heavy production load.

**Inference Endpoints**: for production you deploy a *dedicated* instance of a chosen model on managed GPUs — stable latency, autoscaling, private networking. This is the "graduate to production" step.

The tiers form a ladder: **run locally** (transformers) → **call serverless** (Inference API, for prototyping) → **dedicated endpoint** (for production scale).

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ HF Hub<span class="sub">find model + card + license</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Inference API<span class="sub">HTTP call, no GPU — prototype</span></span>
    <span class="darr">→<span class="lbl">scale up</span></span>
    <span class="dbox green">🚀 Inference Endpoint<span class="sub">dedicated GPU — production</span></span>
  </div>
  <div class="dcap">Discover on the Hub, prototype via the serverless Inference API, graduate to a dedicated endpoint.</div>
</div>

## Concrete example

```python
from huggingface_hub import InferenceClient

client = InferenceClient(token="$HF_TOKEN")   # free token from your HF account

# Call an open chat model over HTTP — no local GPU needed
out = client.chat_completion(
    model="meta-llama/Llama-3.1-8B-Instruct",
    messages=[{"role": "user", "content": "List two facts about the Burj Khalifa."}],
    max_tokens=80,
)
print(out.choices[0].message.content)

# Same client for an embedding model on the Hub:
vec = client.feature_extraction("cheap flat near the metro",
                                model="intfloat/multilingual-e5-large")
print(len(vec))   # -> the embedding dimensionality
```

Note the `chat_completion` shape mirrors the OpenAI [messages](/working-with-llm-apis/messages-roles) format — the ecosystem has largely standardized on it, so switching between providers is mostly a client swap.

## How a company uses this

A Dubai startup needs **strong Arabic-English embeddings** for a bilingual search product. **Production reality:** they browse the Hub, filter by language and the retrieval benchmark leaderboard, and shortlist a few multilingual embedders. They **prototype via the serverless Inference API** — swapping model names in one line to A/B them on their own query set — without provisioning any GPU. Once they pick a winner and validate accuracy, they deploy it as a **dedicated Inference Endpoint** with autoscaling to get predictable single-digit-ms latency under load, and they confirmed the model's license permits commercial use *before* committing. Total time from "which model?" to "in production": days, not weeks.

## Common mistakes

- **Skipping the license** — some Hub models are research/non-commercial only; check before shipping.
- **Using the serverless Inference API for production traffic** — cold starts and shared capacity cause latency spikes; move to a dedicated endpoint.
- **Trusting download counts over your own eval** — popular ≠ best for *your* data (especially Arabic); benchmark on your set.
- **Ignoring the model card** — it lists context length, languages, and intended use you need to know.
- **Forgetting versioning** — pin a model revision so an upstream update doesn't silently change your outputs.

## Interview tip
Say: *"The Hub is where I discover open models — reading the card, license, and benchmarks — and the Inference API lets me call them over HTTP with an OpenAI-style interface for zero-infra prototyping. My path is: shortlist on the Hub, A/B via serverless Inference to pick a winner on my own data, then deploy a dedicated Inference Endpoint for stable production latency. I always check the license and pin the revision."* That whole ladder shows mature model selection, not just API trivia.
