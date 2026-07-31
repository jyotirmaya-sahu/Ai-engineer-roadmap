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
| [SDK setup & call pattern](working-with-llm-apis/sdk-setup-call-pattern.md) | install, client, `client.chat.completions.create`, read the response | **start here** — before any other tile |
| [Messages & roles](working-with-llm-apis/messages-roles.md) | the request is a list of role-tagged messages | every single API call |
| [System / user / assistant](working-with-llm-apis/system-user-assistant.md) | the three roles and what each controls | steering behavior, multi-turn chat |
| [Streaming](working-with-llm-apis/streaming.md) | get tokens as they're generated | chat UIs, low perceived latency |
| [Usage & token counting](working-with-llm-apis/usage-token-counting.md) | tokens = your bill and your context limit | budgeting, staying under context window |
| [JSON mode](working-with-llm-apis/json-mode.md) | force machine-parseable output | feeding model output to code |

After JSON mode you're ready to **build the capstone app (v1–v5)**. The rest of the API surface — tool-calling, vision, audio, other endpoints, Hugging Face, and production concerns (rate limits, retries, caching) — lives in the next node, **LLM APIs — Advanced**, to pull in as your app needs them.

## Real world: how a company uses this

> **A Dubai insurance firm** builds a claims-triage assistant. The model must return a **strict JSON verdict** ([JSON mode](working-with-llm-apis/json-mode.md)) over a conversation it holds as a **role-tagged message list** ([Messages & roles](working-with-llm-apis/messages-roles.md)), the agent-facing UI **streams** the explanation so it feels instant ([Streaming](working-with-llm-apis/streaming.md)), and every call is **token-counted** to stay in budget and under the context window ([Usage & token counting](working-with-llm-apis/usage-token-counting.md)). The advanced pieces it also uses — vision, tool-calling, prompt caching, rate-limit handling — are covered in the **LLM APIs — Advanced** node.

## Interview tip
Say: *"An LLM API call is a structured list of role-tagged messages sent over HTTPS, billed per token, returning streamable output. My mental checklist for any integration is: shape the messages, decide if I need structured output or tool-calling, count tokens to stay in budget and under the context limit, stream for UX, then harden it with retries, backoff, rate-limit handling, and prompt caching for cost."* That single sentence signals you've actually shipped against these APIs, not just read the marketing page.

---

*Below: deep-dive articles on each part of working with LLM APIs.*
