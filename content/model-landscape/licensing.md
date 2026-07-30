# Licensing

**What it is:** The legal terms that govern what you're allowed to *do* with a model — commercial use, on-prem deployment, fine-tuning, redistribution — and, for closed APIs, whether the provider may use your data. Get it wrong and you ship a lawsuit.

## Why it matters for an AI Engineer

Licensing can veto an otherwise perfect model. A "research-only" license means you legally can't sell a product on it. An open model with a large-company clause might bind your enterprise client. A closed API's data terms decide whether a bank can even use it. This is one of the four selection gates (capability, latency, cost, **licensing/hosting**), and it's the one engineers most often skip — then discover in legal review, after building. Naming license types confidently is a maturity signal in interviews, especially for regulated Gulf clients.

## The mechanism / how it works

Split by category:

**Closed / API models** (Claude, GPT, Gemini) — you don't get the weights, so "licensing" here is really the **terms of service**, and the key questions are:
- *Data usage* — does the provider train on your inputs? Enterprise/API tiers typically say **no** (your data isn't used for training), which is what makes them acceptable to businesses. Consumer tiers may differ. Always confirm.
- *Data residency* — where is data processed? Matters for UAE data-sovereignty rules; some providers offer regional or in-VPC deployment.
- *Usage restrictions* — prohibited use categories (e.g. certain high-risk applications).

**Open-weight models** — you download the weights, but under a license that ranges from very permissive to restrictive:
- **Apache 2.0 / MIT** (e.g. many Mistral and Falcon models) — near-unrestricted commercial use, fine-tuning, redistribution. The safest, cleanest option.
- **Community/custom licenses** (e.g. Llama) — commercially usable by almost everyone, but with conditions: an acceptable-use policy and, notably, a **monthly-active-user threshold** above which a giant company must request a separate license. Fine for most, a flag for very large firms.
- **Non-commercial / research-only** — you may experiment but **not** ship a commercial product. A trap if you prototype on one and forget.

<div class="diagram">
  <div class="flow">
    <span class="dbox green">Apache 2.0 / MIT<span class="sub">ship freely</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">Community (Llama)<span class="sub">ok, but MAU clause</span></span>
    <span class="darr">→</span>
    <span class="dbox gray">Research-only<span class="sub">no commercial ship</span></span>
  </div>
  <div class="dcap">Read the license before building — permissiveness ranges from "ship anything" to "cannot sell."</div>
</div>

## Concrete example — a decision checklist

Before committing to any model, answer:

```
1. Closed API?  → Does the (enterprise) TOS say they DON'T train on my data?   [must be yes for PII]
                → Is data processed in an allowed region / my VPC?             [UAE residency]
2. Open weights? → What license? Apache/MIT = safe.
                → Community license? Am I under the MAU threshold?             [usually yes]
                → Does it say "research/non-commercial only"?                  [if yes, STOP for prod]
3. Fine-tuning?  → Does the license permit training derivatives + using them commercially?
```

Running this five-minute check *before* building saves a doomed legal review later.

## How a company uses this

A Dubai startup prototyped its product on a slick model it found on Hugging Face — only for legal to flag, weeks in, that its license was **research-only**. They'd have had to rebuild at launch. Now their rule is: **check the license before any model enters a prototype.** For their shipped product they standardized on **Apache-2.0 open models** (a Mistral/Falcon-class model) precisely because the permissive license cleared legal instantly with no MAU conditions, and on the closed side they use only **enterprise-tier APIs whose terms guarantee no training on customer data** and offer in-region processing to meet UAE residency rules.

## Common mistakes
- **Prototyping on a research-only model** and discovering you can't ship it.
- **Assuming "open" means "no rules"** — community licenses carry conditions; some downloads are non-commercial.
- **Not checking data-training terms on closed APIs** — for PII this is a hard compliance gate.
- **Ignoring data residency** — a compliant model used in a non-permitted region can still violate UAE rules.

## Interview tip
Say: *"Licensing is a hard selection gate I check before building. For closed APIs I confirm the enterprise terms say they don't train on our data and that processing meets data-residency rules. For open weights I read the license: Apache/MIT ships freely, Llama's community license is fine below its user threshold, and research-only models can't go to production. I standardize on permissive open licenses and enterprise API tiers so legal review is fast."*
