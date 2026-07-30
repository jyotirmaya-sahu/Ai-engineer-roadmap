# Model Sizes

**What it is:** How "big" a model is — measured in *parameters* (the trained numbers inside it) — and why a bigger model is usually smarter but always slower and more expensive.

## Why it matters for an AI Engineer

Size is the dial between quality and cost. A 400B-parameter model reasons better than an 8B one, but it costs more per token, runs slower, and needs far more GPU memory to self-host. Half of good model selection is refusing to pay frontier prices for a task a small model nails. If you send every request to your biggest model "to be safe," your cost and latency will be 10–30× worse than a competitor who right-sizes — and that competitor wins the client.

## The mechanism / how it works

A **parameter** is one adjustable weight in the network. Training tunes billions of them so the model predicts text well. More parameters = more capacity to store patterns, nuance, and reasoning ability — up to a point, and with steep costs:

- **Memory.** Weights must fit in GPU RAM. Rough rule at 16-bit precision: **~2 GB of VRAM per billion parameters**. An 8B model needs ~16GB (one consumer GPU); a 70B needs ~140GB (multiple datacenter GPUs); a 400B needs a whole server rack. *Quantization* (storing weights in 8- or 4-bit) roughly halves or quarters this, at a small quality cost.
- **Speed & cost.** Every generated token runs the whole network. More parameters = more math per token = slower and pricier. Cost per token scales roughly with active size.
- **Mixture-of-Experts (MoE).** Modern big models (Mistral, some GPT/Gemini variants) cheat this. A model might have 400B *total* parameters but only activate ~40B per token by routing each token to a few "expert" sub-networks. You get big-model knowledge at closer to small-model inference cost. So "size" now means two numbers: **total** params (memory) and **active** params (speed/cost).

The practical mental buckets:

<div class="diagram">
  <div class="flow">
    <span class="dbox green">🐣 Small<span class="sub">~1–8B · cheap, fast</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🐇 Mid<span class="sub">~30–70B · balanced</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🐘 Frontier<span class="sub">100B–1T · smartest, costly</span></span>
  </div>
  <div class="dcap">Bigger = smarter but slower and pricier. Right-size to the task instead of always reaching for frontier.</div>
</div>

- **Small (1–8B):** classification, extraction, simple chat, routing, on-device. Cheap enough to run on one GPU.
- **Mid (30–70B):** solid RAG answers, most business logic, good self-host sweet spot.
- **Frontier (100B–1T+):** hard reasoning, agents, coding, ambiguous multi-step tasks.

## Concrete example — right-sizing saves money

Suppose a support app handles 1M messages/day. 80% are simple intent classification, 20% need real reasoning.

- **Naive:** all 1M through a frontier model at ~$10/M output tokens, ~300 tokens each → ~$3,000/day.
- **Right-sized:** 800k simple ones through an 8B model at ~$0.20/M → ~$48; 200k hard ones through frontier → ~$600. **Total ~$650/day** — a 78% cut for equal or better quality, because the small model actually classifies *better* when the task is narrow and the prompt is tight.

That split is exactly what [Model routing / cascades](model-routing-cascades.md) automates.

## How a company uses this

A Dubai e-commerce team runs product-review sentiment tagging over ~5M reviews/month. They benchmarked: a 7B model hit 94% agreement with human labels at ~2ms/token on their own GPU; the frontier model hit 96% at 20× the cost and 5× the latency. For a tagging job, 2% accuracy isn't worth 20× spend, so they ship the 7B self-hosted and reserve the frontier model for the storefront's conversational assistant where reasoning quality is customer-facing. Deciding this required actually measuring both — see [Capability vs task](capability-vs-task.md).

## Common mistakes
- **"Bigger is always better."** For narrow, well-specified tasks a small model is often *more* reliable and vastly cheaper.
- **Confusing total and active params on MoE models** — you size GPU memory by *total*, but estimate cost/latency by *active*.
- **Forgetting quantization** — a 70B model in 4-bit fits on far less VRAM, making self-hosting mid-size models realistic.

## Interview tip
Say: *"Parameters trade capability against memory, latency, and cost — roughly 2GB of VRAM per billion params at 16-bit. I bucket models as small (1–8B) for narrow tasks, mid (30–70B) as the self-host sweet spot, and frontier for hard reasoning. MoE models decouple total size from active size, giving big-model knowledge at lower inference cost. The engineering skill is right-sizing per task, not defaulting to the biggest model."*
