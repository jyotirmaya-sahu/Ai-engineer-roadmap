# Falcon · Jais 🇦🇪

**What it is:** The UAE's own open-weight models — **Falcon** (from Abu Dhabi's Technology Innovation Institute) is a general-purpose family; **Jais** (from Abu Dhabi's G42/Inception with MBZUAI) is the leading **Arabic-first** LLM. Both matter enormously if you're targeting an AI Engineer role in the Gulf.

## Why it matters for an AI Engineer

If you interview in Dubai, knowing these is a *local signal* that generic-model engineers can't fake. Two real forces drive their use:

1. **Arabic quality.** Western models handle Arabic passably but not natively — dialects, right-to-left script, and cultural nuance slip. Jais is trained Arabic-first and beats general models on Arabic tasks. For a UAE government portal or a bank serving Emirati customers, that gap is the whole product.
2. **Data sovereignty & national strategy.** UAE entities increasingly prefer — sometimes are directed toward — locally developed, self-hostable models so sensitive data and the technology itself stay under national control. Falcon and Jais are **open-weight**, so they can run fully on-prem.

Being able to say "for the Arabic-facing, data-resident part of this system I'd evaluate Jais and Falcon" is exactly the Gulf-aware judgment employers here look for.

## The mechanism / how it works

Both are transformer LLMs released as **open weights** (on Hugging Face), so you self-host them like Llama — download, serve with vLLM, fine-tune, run offline ([Closed vs open](closed-vs-open.md), [Meta Llama](meta-llama.md)).

- **Falcon** — a general-purpose family across sizes (small enough for one GPU up to larger reasoning models, including efficient MoE variants). Permissively licensed (Apache-2.0-based terms), positioning it as a sovereign alternative to Llama/Mistral for general tasks.
- **Jais** — purpose-built bilingual **Arabic–English** models. Trained on a large Arabic corpus so it handles Modern Standard Arabic and dialects, RTL text, and Arabic reasoning far better than models where Arabic was an afterthought. Sizes range from small deployable variants to larger ones.

The engineering point: these aren't chosen for raw leaderboard scores — they're chosen because they clear an **Arabic-quality bar** and a **sovereignty/hosting requirement** that closed foreign APIs can't.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">🇦🇪 Arabic query</span>
      <span class="darr">→</span>
      <span class="dbox purple">Jais<span class="sub">Arabic-first, on-prem</span></span>
      <span class="darr">→</span>
      <span class="dbox green">✅ native answer</span>
    </div>
    <div class="flow">
      <span class="dbox gray">General task<span class="sub">data must stay in UAE</span></span>
      <span class="darr">→</span>
      <span class="dbox purple">Falcon<span class="sub">open, self-hosted</span></span>
      <span class="darr">→</span>
      <span class="dbox green">✅ sovereign deploy</span>
    </div>
  </div>
  <div class="dcap">Jais for Arabic-first quality; Falcon for general sovereign, self-hostable deployment.</div>
</div>

## Concrete example — run Jais for Arabic

```python
# Open weights — self-host, nothing leaves your infrastructure
from vllm import LLM, SamplingParams
llm = LLM(model="inceptionai/jais-13b-chat")   # Arabic-first LLM
prompt = "ما هي مواعيد عمل الدائرة خلال شهر رمضان؟"   # "What are the dept's Ramadan working hours?"
out = llm.generate([prompt], SamplingParams(max_tokens=120, temperature=0.3))
print(out[0].outputs[0].text)   # fluent Arabic answer, RTL handled natively
```

A general model would often reply in stilted Arabic or drift to English; Jais answers natively — and because it's self-hosted, a citizen's data never leaves the government cloud.

## How a company uses this

A **Dubai government service portal** needed an Arabic chatbot for citizen queries. They benchmarked a top Western model against **Jais**: on Emirati-dialect questions and formal-Arabic responses, Jais scored markedly higher on human evaluations, and — decisively — it self-hosts inside the government's own datacenter, satisfying a hard requirement that citizen data not touch a foreign API. General English-language admin tasks in the same system route to **Falcon** (also on-prem) so the entire stack stays sovereign. Non-sensitive, English-only analytics still use a closed frontier model for peak quality. This is [model tiering](model-tiering-by-task.md) shaped by *language and jurisdiction*, not just difficulty.

## Common mistakes
- **Assuming a Western frontier model "does Arabic fine"** — for citizen- or customer-facing Arabic, native models like Jais measurably win; test on real dialect data.
- **Forgetting they're open-weight** — the whole point is self-hosting for sovereignty; don't treat them as just another API.
- **Using them where they don't fit** — for hard English reasoning a frontier closed model may still be better; choose per task and per language.
- **Not mentioning them in a Gulf interview** — omitting the local models signals you haven't researched the market.

## Interview tip
Say: *"In the Gulf I'd evaluate Falcon and Jais, not just the Western models. Jais is Arabic-first, so for citizen- or customer-facing Arabic it beats general models on dialect and RTL handling; Falcon is a solid general open-weight option. Both are open-weight, so they satisfy UAE data-sovereignty requirements by running fully on-prem. I'd tier by language and jurisdiction — Jais/Falcon for Arabic and data-resident work, a frontier closed model for hard English reasoning on non-sensitive data."* Naming these shows genuine market awareness.
