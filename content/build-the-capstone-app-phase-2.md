# Build: The Capstone App — Phase 2

**The one-line idea:** take the deployed HelpDesk from Phase 1 and deliberately apply every advanced LLM API capability, turning a capable chat demo into a resilient, multimodal support product.

## Why we need a second build phase

In Phase 1 you learned the request/response loop and shipped it: users can sign in, chat, stream answers, create structured tickets, and return to saved conversations. That is a strong foundation, but real support work is not only text chat. Customers ask about live orders, upload damaged-product photos, send voice notes, and expect the service to remain dependable when a provider throttles requests.

Phase 2 closes that gap. Each version starts from the deployed v8 application and converts one group of advanced API lessons into a user-visible feature or a production-quality system property. You are not starting another repository.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">v8 deployed HelpDesk</span>
    <span class="darr">→</span>
    <span class="dbox orange">tools · images · audio</span>
    <span class="darr">→</span>
    <span class="dbox blue">semantic memory · batch work</span>
    <span class="darr">→</span>
    <span class="dbox purple">retries · cache · fallback</span>
    <span class="darr">→</span>
    <span class="dbox green">v15 portfolio release</span>
  </div>
  <div class="dcap">Phase 2 grows one deployed product; every advanced API lesson must become visible in the app or measurable in its operation.</div>
</div>

## The build sequence

| Version | What you add | Advanced lessons made real |
|---|---|---|
| [v8.1 · Production foundation](build-the-capstone-app-phase-2/v8-1-production-foundation.md) | tenant-safe domain model, durable jobs, and test harness | the shared contract every later feature extends |
| [v9 · Tool calling & live order lookup](build-the-capstone-app-phase-2/v9-tool-calling-live-order-lookup.md) | safe, server-side order lookup | function/tool schemas, validation, tool-result messages |
| [v10 · Multimodal ticket intake](build-the-capstone-app-phase-2/v10-multimodal-ticket-intake.md) | image, document, and voice-note evidence | Files API, vision inputs, audio, SSE progress |
| [v11 · Embeddings-powered similar tickets](build-the-capstone-app-phase-2/v11-embeddings-powered-similar-tickets.md) | find related solved cases | Embeddings API, tokenization, vector similarity |
| [v12 · Resilient provider client](build-the-capstone-app-phase-2/v12-resilient-provider-client.md) | one hardened gateway for every model call | rate limits, retries, backoff, prompt caching |
| [v13 · Async & batch processing](build-the-capstone-app-phase-2/v13-async-batch-processing.md) | fast concurrent work and cheap overnight jobs | async concurrency, Batch API, Files API |
| [v14 · Open-model fallback](build-the-capstone-app-phase-2/v14-open-model-fallback.md) | privacy/cost fallback using an open model | transformers, pipelines, tokenizers, Hub/Inference API |
| [v15 · Phase 2 integration & demo](build-the-capstone-app-phase-2/v15-phase-2-integration-demo.md) | one tested, observable portfolio release | integration, failure testing, architecture communication |

## Definition of done

Each version must add a working vertical slice: UI, API contract, backend behavior, persistence, tests, and a short README entry. Start with `v8.1`, then tag the same repository `v9` through `v15`. Do not count copied sample code as complete until a real browser flow works and the failure path is tested.

Every milestone uses the same delivery contract established in v8.1:

1. Apply a forward-compatible SQL migration and seed the smallest useful fixture.
2. Derive user, organization, and role from the verified token—never from request JSON.
3. Publish the exact HTTP/SSE contract and implement its loading, empty, success, retry, and forbidden UI states.
4. Persist work before returning success; background work must resume safely after a process restart.
5. Add telemetry without private payloads, plus unit, integration, browser, cross-tenant, and failure-path tests.
6. Ship behind a feature flag with a kill switch and rollback note.

The code excerpts in later lessons focus on the new concept. They are not standalone applications; the required surrounding repository structure, persistence, authorization, worker, and test fixtures come from v8.1 and remain mandatory.

For the final demo, use one realistic Dubai e-commerce story: a signed-in customer sends a voice note and damaged-item photo, HelpDesk reads both, safely checks the order, finds similar resolved cases, and creates a grounded ticket. Then show the same flow surviving a simulated `429` rate-limit response and switching to a restricted fallback mode during a provider outage.

## Interview tip

Do not describe this as “I used many APIs.” Say: *“I grew one support product in two phases. The second phase added safe tool execution and multimodal intake, then I hardened the provider boundary with bounded retries, caching, concurrency control, batch processing, and a limited open-model fallback. Every capability has an explicit failure mode and test.”* That is an engineering story rather than a feature list.

---

*Below: the production foundation plus seven Phase 2 milestones. Continue from the Phase 1 v8 tag and build them in order. After Prompt and Context Engineering, [Capstone Phase 3](build-the-capstone-app-phase-3.md) continues at v16.*
