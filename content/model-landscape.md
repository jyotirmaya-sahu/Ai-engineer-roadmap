# Model Landscape

**The one-line idea:** Before you write a single prompt, you pick a *model* — and that one choice sets the ceiling on your app's quality, latency, and cost. The Model Landscape is the map of what's out there and how to choose.

## Why we even need it

An AI Engineer doesn't build the model — you *assemble* an application on top of someone else's model. That makes model selection the most consequential decision you make, and you make it before any code:

1. **The model caps everything.** No prompt trick makes a weak model reason like a strong one. If you picked wrong, you're patching a ceiling you can't raise.
2. **Every request costs money and time.** The same task can cost 30× more and run 5× slower depending on which model serves it. At a few requests that's noise; at a million requests a day it's the difference between a viable product and a bankrupt one.
3. **Licensing and hosting decide what's even legal.** A model you can't run on-premise is a non-starter for a bank; a research-only license is a lawsuit waiting to happen.

So the landscape isn't trivia. It's the decision tree you walk every time a new feature needs an LLM.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🎯 Task</span>
    <span class="darr">→<span class="lbl">match</span></span>
    <span class="dbox purple">🧠 Capability</span>
    <span class="darr">→</span>
    <span class="dbox orange">⏱️ Latency + 💰 Cost</span>
    <span class="darr">→</span>
    <span class="dbox blue">📜 License + Hosting</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Chosen model</span>
  </div>
  <div class="dcap">Model selection walks four gates in order: can it do the task, is it fast/cheap enough, and can you legally run it where you need to.</div>
</div>

## Why it matters for an AI Engineer

In a Dubai interview you *will* be asked "which model would you use for X and why?" There is no single right answer — the signal they want is that you reason across capability, cost, latency, and licensing instead of defaulting to whatever is trending. You also need to know the local angle: UAE-built models (**Falcon**, **Jais**) matter for Arabic-language and data-sovereignty requirements that a government or bank client will explicitly ask about.

## The tiles you'll learn (and when to reach for each)

| Tile | Core idea | Reach for it when |
|---|---|---|
| [Closed vs open](model-landscape/closed-vs-open.md) | API-only vs weights-you-download | deciding data control & hosting |
| [Model sizes](model-landscape/model-sizes.md) | params → capability & cost tradeoff | matching horsepower to task |
| [Context length](model-landscape/context-length.md) | how much text fits per call | long docs, RAG, agents |
| [Multimodal](model-landscape/multimodal.md) | text + image + audio in one model | inputs aren't plain text |
| [Anthropic Claude](model-landscape/anthropic-claude.md) | frontier reasoning & long context | quality-critical, agentic work |
| [OpenAI GPT](model-landscape/openai-gpt.md) | broad ecosystem, tools, o-series | general default, tooling depth |
| [Google Gemini](model-landscape/google-gemini.md) | huge context, GCP-native | massive context, Google shops |
| [Meta Llama](model-landscape/meta-llama.md) | strongest open-weight family | self-hosting, fine-tuning |
| [Mistral](model-landscape/mistral.md) | efficient EU open models | cheap open, European data rules |
| [Cohere](model-landscape/cohere.md) | enterprise RAG (embed + rerank) | retrieval-heavy enterprise apps |
| [Falcon · Jais 🇦🇪](model-landscape/falcon-jais.md) | UAE open models, Arabic-first | Arabic, data sovereignty, Gulf gov |
| [Capability vs task](model-landscape/capability-vs-task.md) | match model strength to job | avoiding over/under-powered picks |
| [Latency](model-landscape/latency.md) | time-to-first-token & throughput | real-time UX, voice, chat |
| [Licensing](model-landscape/licensing.md) | what you're legally allowed to do | any commercial deployment |
| [Token pricing](model-landscape/token-pricing.md) | how billing per token works | reading a price sheet correctly |
| [Cost estimation](model-landscape/cost-estimation.md) | project spend before you ship | budgeting, unit economics |
| [Cost vs performance tradeoff](model-landscape/cost-vs-performance-tradeoff.md) | the core selection dial | every real decision |
| [Model routing / cascades](model-landscape/model-routing-cascades.md) | send each request to the right model | cutting cost at scale |
| [Model tiering by task](model-landscape/model-tiering-by-task.md) | fixed model per task type | predictable multi-model apps |
| [Managed vs self-hosted (build vs buy)](model-landscape/managed-vs-self-hosted-build-vs-buy.md) | API vs run-your-own GPUs | control vs convenience call |

## Real world: how a company uses this

> **A Dubai bank** building a customer-support assistant walked the whole landscape. Frontier **Claude** handled complex complaint reasoning; a cheap **Llama 3** they self-hosted on-premise answered "what's my balance" FAQs so no customer data left their datacenter (regulator requirement); **Jais** served Arabic conversations natively instead of translating. A **router** sent each message to the cheapest model that could handle it. Result: 70% of traffic served by the cheap self-hosted model, frontier cost reserved for the hard 30%, and Arabic quality that a translate-then-answer pipeline could never match.

## Interview tip
Say: *"I don't pick a model by brand — I walk four gates: capability for the task, latency the UX allows, cost at expected scale, and licensing/hosting the client requires. For most apps I start with a strong closed model to validate quality, then route easy traffic to a cheaper or self-hosted open model to control cost. In the Gulf I keep Falcon and Jais in mind for Arabic and data-sovereignty requirements."* That shows engineering judgment, not fandom.

---

*Below: deep-dive articles on each model, provider, and selection decision.*
