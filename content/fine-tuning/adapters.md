# Adapters

**The one-line idea:** an adapter is a small, trained, *swappable* module you plug into a frozen base model to give it a new skill — so one base can serve many tasks by hot-swapping cheap add-ons instead of hosting many full models.

## Why it matters for an AI Engineer

Adapters are the *packaging and serving* side of parameter-efficient fine-tuning. [LoRA](lora.md) produces an adapter; the adapter concept is what lets you run **dozens of specialized behaviors off a single base model in memory**. For any team with more than one fine-tuned task — different clients, languages, or output formats — this is the difference between hosting 10 separate 16 GB models and hosting one base plus ten 50 MB files. It's a direct cost and ops win, and interviewers love the "one base, many adapters" serving pattern.

## The mechanism / how it works

An adapter is a small set of *added* parameters inside (or alongside) the transformer layers, trained while the base stays frozen. There are a few flavors:

- **LoRA adapters** — the low-rank `B·A` matrices from [LoRA](lora.md). The dominant modern form. Can run *merged* into the base (zero inference overhead, one task) or *unmerged* (swappable, tiny per-request overhead).
- **Bottleneck adapters** (the original 2019 idea) — small `down-project → nonlinearity → up-project` blocks inserted between layers. Add a little latency because they're an extra sequential step.
- **Prefix / prompt adapters** — trainable "virtual tokens" prepended to the input; the model's weights don't change at all.

The power move is **multi-adapter serving**: load the base once, keep many adapters resident, and route each request to the right one. Because each adapter is tiny, RAM cost is base + Σ(tiny adapters). Serving stacks like vLLM support this directly (multi-LoRA), even **batching requests for different adapters together**.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 One frozen base model (in memory once)</span>
    <span class="darr">↓<span class="lbl">route per request</span></span>
    <span class="dbox orange">🇦🇪 Arabic-tone adapter (50MB)</span>
    <span class="dbox orange">📑 Legal-format adapter (50MB)</span>
    <span class="dbox orange">💬 Support-voice adapter (50MB)</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ 3 "models" for the RAM of ~1</span>
  </div>
  <div class="dcap">One base + many hot-swappable adapters = many specialized models, one memory footprint.</div>
</div>

**Merge vs keep-separate:** merging (`W ← W + B·A`) bakes the adapter in for zero overhead but locks the model to that one task. Keeping it separate costs a hair of latency but lets you swap tasks and serve many at once. Choose by whether you need one behavior or many.

## Concrete example

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM

base = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B")

# Load two different trained adapters onto the SAME base object
model = PeftModel.from_pretrained(base, "./adapters/arabic-tone",  adapter_name="ar")
model.load_adapter("./adapters/legal-format", adapter_name="legal")

model.set_adapter("ar")     # route this request to the Arabic-tone behavior
# ... generate ...
model.set_adapter("legal")  # instantly switch behavior, no reload of the 8B base
```

## How a company uses this

A Dubai SaaS platform offers each enterprise client a chatbot in their own brand voice. Rather than fine-tune and host a separate model per client (unscalable past a handful), they train **one LoRA adapter per client** on a shared base and serve them with **multi-LoRA batching in vLLM**. 40 clients = one resident base + 40 × ~40 MB adapters ≈ under 2 GB of adapters total, all served from a single GPU. Onboarding a new client is a 30-minute adapter training job, not a new deployment. This "adapter-per-tenant" pattern is a common, cost-effective enterprise design.

## Common mistakes
- **Deploying one full model per task** when adapters would collapse them onto one base — a huge, avoidable GPU bill.
- **Merging when you needed to swap** (or vice-versa) — decide up front based on one-task vs many-tasks.
- **Mismatched base versions** — an adapter only works on the exact base it was trained against; version them together.

## Interview tip
Say: *"An adapter is a small trained module on a frozen base — usually LoRA. The serving win is one base plus many tiny adapters: I can host dozens of specialized behaviors for the memory of one model, hot-swap or even batch across adapters with vLLM, and onboard a new tenant with a 30-minute training job instead of a new deployment."* Related: [LoRA](lora.md), [Quantization](quantization.md).
