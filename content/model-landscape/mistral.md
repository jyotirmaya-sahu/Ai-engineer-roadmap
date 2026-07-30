# Mistral

**What it is:** A French AI company whose efficient **open-weight** models (plus some premium closed ones) deliver strong performance per parameter — and, being EU-based, appeal to teams with European data-governance needs.

## Why it matters for an AI Engineer

Mistral is the "efficient open model" option — it often matches larger models on quality while being cheaper and faster to run, thanks partly to Mixture-of-Experts design. That makes it a great self-host pick when you want open-weight control without a giant GPU bill. Its EU origin and Apache-licensed open models also matter for clients who care about data jurisdiction or want a genuinely permissive license. Knowing Mistral gives you a lighter, cheaper alternative to Llama in the open-model half of the landscape.

## The mechanism / how it works

Mistral's line splits into two:

- **Open-weight models** (e.g. the small dense models and the **Mixtral** MoE family) — released under the permissive **Apache 2.0** license, meaning almost no usage restrictions. You download and run them like any open model ([Closed vs open](closed-vs-open.md)).
- **Premium closed models** (their "Large"-class) — API-only, competing near the frontier.

The efficiency edge comes largely from **Mixture-of-Experts (MoE)**. A Mixtral-style model has many "expert" sub-networks but routes each token to only a couple of them. So a model with, say, ~47B *total* parameters activates only ~13B *per token* — you get the knowledge of a big model at the inference cost and speed of a small one. That's why Mistral punches above its weight on cost/performance ([Model sizes](model-sizes.md) explains total vs active params).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">token</span>
    <span class="darr">→<span class="lbl">router</span></span>
    <span class="dbox purple">expert 2</span>
    <span class="dbox purple">expert 5</span>
    <span class="dbox gray">(others idle)</span>
    <span class="darr">→</span>
    <span class="dbox green">output</span>
  </div>
  <div class="dcap">MoE routes each token to only a few experts — big-model quality at small-model cost.</div>
</div>

The practical appeal: a permissive Apache license (no MAU thresholds like Llama's), lower serving cost per quality point, and EU jurisdiction — a combination that suits cost-sensitive, license-cautious, or data-governance-driven deployments.

## Concrete example

```python
# Open weights via vLLM — Apache 2.0, run it anywhere
from vllm import LLM, SamplingParams
llm = LLM(model="mistralai/Mistral-7B-Instruct-v0.3")
out = llm.generate(["Summarise in one sentence: ..."], SamplingParams(max_tokens=60))
print(out[0].outputs[0].text)

# Or the hosted API for premium models
from mistralai import Mistral
client = Mistral(api_key="...")
r = client.chat.complete(model="mistral-large-latest",
    messages=[{"role": "user", "content": "Draft a polite payment reminder."}])
print(r.choices[0].message.content)
```

Same company, two paths: self-host the permissive open model, or call the hosted premium one — pick per task.

## How a company uses this

A Dubai logistics SaaS needed an on-prem model for shipment-note extraction but wanted lower serving cost than a 70B Llama. They deployed **Mixtral (MoE)**: it matched their quality bar while activating far fewer parameters per token, so one GPU served nearly double the throughput of a comparable dense model — cutting their inference cost roughly in half at ~2M documents/month. The **Apache 2.0** license also cleared their legal team instantly, with none of the large-company conditions they'd have had to review on other open models. For occasional complex multilingual queries they call Mistral's hosted Large model rather than self-host it.

## Common mistakes
- **Overlooking MoE memory cost** — you still need VRAM for *total* params even though only a few activate; size hardware by total, cost/speed by active.
- **Assuming all Mistral models are open** — the premium "Large" tier is closed/API-only.
- **Ignoring the license advantage** — Apache 2.0 is genuinely more permissive than Llama's community license; that can settle a legal review.

## Interview tip
Say: *"Mistral is my efficient open-weight pick — its Mixtral MoE models give big-model quality at small-model inference cost by activating only a couple of experts per token, and the open ones ship under Apache 2.0 with no large-company conditions. I reach for it when I want self-hosted control at lower serving cost than a dense 70B, or when a permissive license and EU jurisdiction matter to the client."*
