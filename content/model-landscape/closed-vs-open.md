# Closed vs Open

**What it is:** The single biggest fork in the model landscape — a *closed* model lives behind someone's API and you rent it; an *open* (open-weight) model is a file you download and run yourself.

## Why it matters for an AI Engineer

This choice cascades into everything else: where your data goes, what you pay, whether you can fine-tune, and whether a bank's regulator will even allow it. Pick closed and you get frontier quality with zero infrastructure but you send every request to a third party and pay per token forever. Pick open and you own the model but now you own GPUs, scaling, and uptime too. In a Dubai interview "would you use an open or closed model for this bank?" is a near-guaranteed question, because data sovereignty is a real legal constraint here, not a preference.

## The mechanism / how it works

A large language model is really two things: an **architecture** (the code shape of the network) and the **weights** (billions of trained numbers that hold everything it learned). What a provider releases decides your category.

- **Closed / proprietary** (Claude, GPT, Gemini): weights stay on the provider's servers. You send text over HTTPS to an API, they run inference, you get text back. You never see the weights. You cannot run it offline, cannot inspect it, cannot truly fine-tune it (you can only use whatever tuning knobs they expose).
- **Open-weight** (Llama, Mistral, Falcon, Jais): the provider publishes the weight files (often on Hugging Face). You download tens of gigabytes, load them onto your own GPUs with a runtime like vLLM, and run inference on your own hardware — offline, air-gapped, wherever. You can fine-tune freely and inspect internals.

Two subtleties trip people up:

1. **"Open-weight" is not "open-source."** You almost always get the *weights*, but rarely the *training data* or full training code. So you can run and adapt the model, but you can't fully reproduce it. True open-source (weights + data + code) is rare.
2. **Open still has a license.** Downloading isn't a free-for-all — see [Licensing](licensing.md). Llama has usage caps for giant companies; some "open" models are research-only. Read it before you ship.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">Your app</span>
      <span class="darr">→<span class="lbl">HTTPS</span></span>
      <span class="dbox purple">🔒 Provider API<span class="sub">weights hidden</span></span>
      <span class="darr">→</span>
      <span class="dbox green">response</span>
    </div>
    <div class="flow">
      <span class="dbox gray">Your app</span>
      <span class="darr">→<span class="lbl">local</span></span>
      <span class="dbox purple">🔓 Model on your GPU<span class="sub">weights you own</span></span>
      <span class="darr">→</span>
      <span class="dbox green">response</span>
    </div>
  </div>
  <div class="dcap">Closed = rent inference over the network. Open = own the weights and run them yourself.</div>
</div>

## Concrete example

Same task, two worlds. Closed — data leaves your building:

```python
from anthropic import Anthropic
client = Anthropic()  # ANTHROPIC_API_KEY env var
resp = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=200,
    messages=[{"role": "user", "content": "Summarise this contract clause…"}],
)
print(resp.content[0].text)
```

Open — data never leaves your GPU box:

```python
# pip install vllm ; runs Llama locally, offline
from vllm import LLM, SamplingParams
llm = LLM(model="meta-llama/Llama-3.1-8B-Instruct")
out = llm.generate(
    ["Summarise this contract clause…"],
    SamplingParams(max_tokens=200),
)
print(out[0].outputs[0].text)
```

The API version needs no hardware; the vLLM version needs a GPU with ~16GB+ VRAM but sends nothing to anyone.

## How a company uses this

A Dubai fintech under UAE data-residency rules can't send customer PII to a US API. They self-host **Llama 3.1 8B** on two on-prem A100s behind vLLM for anything touching account data — the model file lives in their datacenter, so no data crosses a border. For generic marketing copy (no PII) they call **Claude** because quality matters more than control. Production numbers that drive the split: the self-hosted box costs ~$4/hr in cloud GPU (or a fixed capex on-prem) and serves ~40 requests/sec regardless of volume, while the closed API costs ~$3–15 per million tokens but scales instantly to any spike with zero ops. Rule of thumb: **closed for quality and burst, open for control and steady high volume.**

## Common mistakes
- **Thinking open = free.** You trade token fees for GPU bills, MLOps staff, and uptime risk. At low volume, closed is usually *cheaper* all-in.
- **Assuming open-weight means no license.** It doesn't — [Licensing](licensing.md) still binds you.
- **Believing self-hosting alone equals compliance.** You still must secure, log, and govern that deployment; the model file being local is necessary, not sufficient.

## Interview tip
Say: *"Closed models give me frontier quality and zero ops but my data leaves the building and I pay per token forever. Open-weight models give me data control, offline deployment, and free fine-tuning but I take on GPUs and MLOps. I default to closed to validate a product fast, then move privacy-sensitive or steady-high-volume traffic to a self-hosted open model — which in the UAE is often driven by data-residency law, not just cost."*
