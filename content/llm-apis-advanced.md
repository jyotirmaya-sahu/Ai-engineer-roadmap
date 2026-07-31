# LLM APIs — Advanced

**The one-line idea:** the rest of the API surface beyond the chat basics — tool-calling, images and audio, other endpoints, running open models yourself, and the production concerns (rate limits, retries, caching) that keep a real app alive. Reach for each **as your app needs it**, not all at once.

## Why this node exists (and why it's separate)

The core node (SDK, messages, streaming, tokens, JSON) is enough to build the capstone app's first five versions. This node is everything *around* that core — the pieces you add when the product grows: letting the model **call your functions**, sending it **images or audio**, running **open models** without a per-token bill, and the **hardening** (backoff, rate-limit handling, caching) that separates a demo from a service. Splitting it out keeps the learning path clean: learn the core, build something, then pull these in on demand.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">💬 Chat core<span class="sub">the other node</span></span>
    <span class="darr">→<span class="lbl">add as needed</span></span>
    <span class="dbox orange">🛠️ tools · 👁️ vision · 🔊 audio</span>
    <span class="darr">+</span>
    <span class="dbox blue">🤗 open models</span>
    <span class="darr">+</span>
    <span class="dbox green">🛡️ production hardening</span>
  </div>
  <div class="dcap">Everything here wraps the chat core with capabilities and reliability — pulled in when the app calls for it.</div>
</div>

## The tiles, and when to reach for each

| Tile | Core idea | Reach for it when |
|---|---|---|
| [Function / tool schemas](llm-apis-advanced/function-tool-schemas.md) | let the model call your functions | agents, live data, actions |
| [Vision inputs](llm-apis-advanced/vision-inputs.md) | send images alongside text | document/image understanding |
| [Audio](llm-apis-advanced/audio.md) | speech in and out | voice apps, transcription |
| [Embeddings API](llm-apis-advanced/embeddings-api.md) | text → vector for search | RAG, semantic search, clustering |
| [Batch API](llm-apis-advanced/batch-api.md) | bulk jobs at ~50% cost, async | large offline workloads |
| [Files API](llm-apis-advanced/files-api.md) | upload docs/images once, reference by ID | batch, vision, large attachments |
| [SSE streaming](llm-apis-advanced/sse-streaming.md) | the wire protocol behind streaming | debugging streams, custom clients |
| [transformers](llm-apis-advanced/transformers.md) | run open models locally in Python | self-hosting, no per-token cost |
| [pipelines](llm-apis-advanced/pipelines.md) | one-line task API over transformers | quick prototypes, classic NLP tasks |
| [tokenizers](llm-apis-advanced/tokenizers.md) | text ↔ token IDs, fast | exact token counts, custom preprocessing |
| [Inference API & Hub](llm-apis-advanced/inference-api-hub.md) | hosted open models + model registry | trying open models without GPUs |
| [Rate limits](llm-apis-advanced/rate-limits.md) | providers cap your RPM/TPM | scaling past a demo |
| [Retries & backoff](llm-apis-advanced/retries-backoff.md) | retry transient failures politely | any production call path |
| [Async batching](llm-apis-advanced/async-batching.md) | fire many calls concurrently | high throughput without Batch API delay |
| [Prompt caching](llm-apis-advanced/prompt-caching.md) | reuse a cached prefix for ~10% cost | long stable system prompts, RAG contexts |

## Real world: how a company uses this

> **A Dubai insurance firm** builds a claims-triage assistant. Each claim arrives with a **PDF and a photo of the damage** ([Files API](llm-apis-advanced/files-api.md) + [Vision inputs](llm-apis-advanced/vision-inputs.md)), and the model may **call a policy-lookup function** ([Function / tool schemas](llm-apis-advanced/function-tool-schemas.md)). The long, unchanging system prompt with all the underwriting rules is **prompt-cached** to cut cost ([Prompt caching](llm-apis-advanced/prompt-caching.md)). At 20k claims/day they hit **rate limits**, so calls go through **exponential backoff** and an **async concurrency pool** ([Rate limits](llm-apis-advanced/rate-limits.md), [Retries & backoff](llm-apis-advanced/retries-backoff.md), [Async batching](llm-apis-advanced/async-batching.md)); the nightly re-scoring of the historical archive runs through the **Batch API** at half price. Every tile here shows up in one real product.

## Interview tip
Say: *"Beyond the chat basics I reach for tool-calling when the model needs to act, vision/audio for multimodal input, and the Batch/Files/Embeddings endpoints for scale and RAG. For production I always add retries with backoff, rate-limit handling, and prompt caching for cost — and I'll self-host open models via Hugging Face when per-token pricing or data residency demands it."* That shows you know the *whole* surface and pick from it deliberately.

---

*Below: deep-dive articles on each advanced capability.*
