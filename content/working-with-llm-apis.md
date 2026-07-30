# Working with LLM APIs

**The one-line idea:** An LLM API is how your code *talks to* a model — you send a JSON request over HTTPS with your messages, the model sends back generated text (or tool calls, or JSON), and you're billed per token. Everything an AI Engineer builds sits on top of this one exchange.

## Why we even need it

You will almost never run a frontier model yourself. GPT-4-class and Claude-class models need clusters of expensive GPUs, and the providers (OpenAI, Anthropic, Google, plus open-weight hosts) run them for you behind an HTTP endpoint. So the entire job of "building with LLMs" reduces to: **construct the right request, handle the response, and do it reliably at scale.**

That sounds trivial — it's a POST request. It isn't. The request has *structure* (roles, system prompts, tool schemas, images), the response can *stream* token-by-token, you're *billed by token* so counting matters, and in production you hit *rate limits*, *transient errors*, and *cost walls* that force you to add retries, batching, and caching. Master this node and you can wire any model into any app. Skip it and every RAG pipeline, agent, and chatbot you try to build later will break in ways you can't debug.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">💬 your messages<span class="sub">system + user</span></span>
    <span class="darr">→<span class="lbl">HTTPS POST</span></span>
    <span class="dbox purple">🧠 LLM API<span class="sub">provider GPUs</span></span>
    <span class="darr">→<span class="lbl">tokens</span></span>
    <span class="dbox green">✅ response<span class="sub">text / JSON / tool call</span></span>
  </div>
  <div class="dcap">Every LLM feature is one HTTP round-trip: structured request in, generated tokens out, billed per token.</div>
</div>

## Why it matters for an AI Engineer

This is the layer interviewers assume you've *actually used*, not just read about. "Can you stream a response?" "How do you count tokens before sending?" "What happens on a 429?" "How do you get guaranteed JSON out of a model?" These are day-one, hands-on questions. RAG, agents, and prompt engineering are all downstream — they *call* these APIs. If you can confidently send a multimodal request, wire up tool-calling, batch a million rows overnight for half price, and survive rate limits with exponential backoff, you can build anything on the roadmap. This node is the foundation everything else stands on.

## The tiles you'll learn (and when to reach for each)

| Tile | Core idea | Reach for it when |
|---|---|---|
| [Messages & roles](working-with-llm-apis/messages-roles.md) | the request is a list of role-tagged messages | every single API call |
| [System / user / assistant](working-with-llm-apis/system-user-assistant.md) | the three roles and what each controls | steering behavior, multi-turn chat |
| [Streaming](working-with-llm-apis/streaming.md) | get tokens as they're generated | chat UIs, low perceived latency |
| [Usage & token counting](working-with-llm-apis/usage-token-counting.md) | tokens = your bill and your context limit | budgeting, staying under context window |
| [JSON mode](working-with-llm-apis/json-mode.md) | force machine-parseable output | feeding model output to code |
| [Function / tool schemas](working-with-llm-apis/function-tool-schemas.md) | let the model call your functions | agents, live data, actions |
| [Vision inputs](working-with-llm-apis/vision-inputs.md) | send images alongside text | document/image understanding |
| [Audio](working-with-llm-apis/audio.md) | speech in and out | voice apps, transcription |
| [Embeddings API](working-with-llm-apis/embeddings-api.md) | text → vector for search | RAG, semantic search, clustering |
| [Batch API](working-with-llm-apis/batch-api.md) | bulk jobs at ~50% cost, async | large offline workloads |
| [Files API](working-with-llm-apis/files-api.md) | upload docs/images once, reference by ID | batch, vision, large attachments |
| [SSE streaming](working-with-llm-apis/sse-streaming.md) | the wire protocol behind streaming | debugging streams, custom clients |
| [transformers](working-with-llm-apis/transformers.md) | run open models locally in Python | self-hosting, no per-token cost |
| [pipelines](working-with-llm-apis/pipelines.md) | one-line task API over transformers | quick prototypes, classic NLP tasks |
| [tokenizers](working-with-llm-apis/tokenizers.md) | text ↔ token IDs, fast | exact token counts, custom preprocessing |
| [Inference API & Hub](working-with-llm-apis/inference-api-hub.md) | hosted open models + model registry | trying open models without GPUs |
| [Rate limits](working-with-llm-apis/rate-limits.md) | providers cap your RPM/TPM | scaling past a demo |
| [Retries & backoff](working-with-llm-apis/retries-backoff.md) | retry transient failures politely | any production call path |
| [Async batching](working-with-llm-apis/async-batching.md) | fire many calls concurrently | high throughput without Batch API delay |
| [Prompt caching](working-with-llm-apis/prompt-caching.md) | reuse a cached prefix for ~10% cost | long stable system prompts, RAG contexts |

## Real world: how a company uses this

> **A Dubai insurance firm** builds a claims-triage assistant. Each claim submission arrives with a **PDF and a photo of the damage** ([Files API](working-with-llm-apis/files-api.md) + [Vision inputs](working-with-llm-apis/vision-inputs.md)), the model must return a **strict JSON verdict** ([JSON mode](working-with-llm-apis/json-mode.md)) and may **call a policy-lookup function** ([Function / tool schemas](working-with-llm-apis/function-tool-schemas.md)). The agent-facing UI **streams** the explanation so it feels instant ([Streaming](working-with-llm-apis/streaming.md)). The long, unchanging system prompt with all the underwriting rules is **prompt-cached** to cut cost 90% ([Prompt caching](working-with-llm-apis/prompt-caching.md)). At 20k claims/day they hit **rate limits**, so calls go through **exponential backoff** and an **async concurrency pool** ([Rate limits](working-with-llm-apis/rate-limits.md), [Retries & backoff](working-with-llm-apis/retries-backoff.md), [Async batching](working-with-llm-apis/async-batching.md)); the nightly re-scoring of the historical archive runs through the **Batch API** at half price. Every tile in this node shows up in one real product.

## Interview tip
Say: *"An LLM API call is a structured list of role-tagged messages sent over HTTPS, billed per token, returning streamable output. My mental checklist for any integration is: shape the messages, decide if I need structured output or tool-calling, count tokens to stay in budget and under the context limit, stream for UX, then harden it with retries, backoff, rate-limit handling, and prompt caching for cost."* That single sentence signals you've actually shipped against these APIs, not just read the marketing page.

---

*Below: deep-dive articles on each part of working with LLM APIs.*
