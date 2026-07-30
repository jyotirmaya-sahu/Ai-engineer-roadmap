# EU AI Act

**What it is:** The world's first comprehensive AI law — it sorts every AI system into a risk tier and attaches legal obligations (or an outright ban) to each tier.

## Why it matters for an AI Engineer

This is the single law most likely to block your feature from shipping. It's already in force (banned uses since Feb 2025, general-purpose-model rules since Aug 2025, high-risk rules phasing in through 2026–2027), and its reach is *extraterritorial*: it applies if your system's output is used in the EU, even if you and your servers sit in Dubai. Penalties scale to **€35M or 7% of global annual turnover** — larger than GDPR's. So "is this even legal?" is a question you answer *before* you architect, not after. Getting the risk tier wrong can mean building a whole feature you're not allowed to launch.

## The mechanism: four risk tiers

The Act's core idea is simple — **the more a system can hurt someone, the more you must do (or you can't do it at all).** Every system lands in one of four buckets.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🚫 Unacceptable<span class="sub">banned outright</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">⚠️ High-risk<span class="sub">heavy obligations</span></span>
    <span class="darr">↓</span>
    <span class="dbox yellow">💬 Limited-risk<span class="sub">transparency only</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Minimal-risk<span class="sub">no obligations</span></span>
  </div>
  <div class="dcap">Higher risk = more legal duty. Most chatbots are limited-risk; hiring/credit tools are high-risk.</div>
</div>

1. **Unacceptable risk — banned.** Social scoring by governments, manipulative subliminal techniques, real-time remote biometric ID in public spaces (narrow exceptions), and untargeted facial-recognition scraping. You cannot build these for the EU market. Full stop.

2. **High-risk — allowed but heavily regulated.** Systems used in hiring/CV screening, credit scoring, education grading, critical infrastructure, medical devices, law enforcement, and biometrics. Obligations include: a **risk management system**, high-quality **training-data governance**, **technical documentation**, **logging/traceability**, **human oversight**, and a **conformity assessment** before market. This is where most of the real engineering burden lives.

3. **Limited risk — transparency duty.** Chatbots must tell users they're talking to an AI. AI-generated or manipulated content (deepfakes, synthetic images) must be **labelled/watermarked**. Most LLM assistants land here — the duty is light but real.

4. **Minimal risk — nothing required.** Spam filters, AI in video games, recommendation of low-stakes content. The vast majority of AI.

**General-Purpose AI (GPAI) models** (GPT-4-class, Claude, Llama) get a separate track: providers must publish **training-data summaries**, respect **copyright**, and — if the model is deemed "systemic risk" (very large compute) — run **model evaluations and red-teaming**. As an *app builder* using these models via API, most GPAI duties sit with the model provider, not you — but you inherit downstream transparency duties.

## Concrete example: classifying your feature

Walk any feature through this decision, in order:

```
def eu_ai_act_tier(feature):
    banned = {"social_scoring", "subliminal_manipulation",
              "realtime_public_biometric_id", "facial_scraping"}
    high_risk = {"hiring", "cv_screening", "credit_scoring",
                 "education_grading", "medical_diagnosis",
                 "law_enforcement", "biometric_categorization"}

    if feature["purpose"] in banned:
        return "UNACCEPTABLE — cannot ship in EU"
    if feature["purpose"] in high_risk:
        return "HIGH-RISK — conformity assessment, human oversight, logging, docs"
    if feature["interacts_with_users"] or feature["generates_content"]:
        return "LIMITED — must disclose AI + label synthetic content"
    return "MINIMAL — no obligations"

# A CV-ranking assistant:
print(eu_ai_act_tier({"purpose": "cv_screening",
                      "interacts_with_users": True,
                      "generates_content": True}))
# -> HIGH-RISK — conformity assessment, human oversight, logging, docs
```

The lesson: an innocent-sounding "resume helper" is **high-risk** the moment it *ranks or screens* candidates. Same code, radically different legal weight, purely because of *use case*.

## How a company uses this

> A **Dubai HR-tech startup** selling a candidate-matching product into Germany discovered at launch review that their core feature was high-risk. In practice that meant: a documented **human-in-the-loop** step (a recruiter must review and can override every AI ranking), **audit logs** of every decision retained for traceability, a **data-governance** record of what the model was trained/prompted on, and bias testing across protected groups. Cost: ~2 engineer-months of compliance work bolted on. Had they classified the feature on day one, it would have been a design input, not a scramble. Production reality: the logging alone added a write to every inference call — a few ms and a storage line item, but non-negotiable for the audit trail regulators can demand.

## Common mistakes

- **Assuming "we're in Dubai, the EU law doesn't apply."** It applies to *output used in the EU*, regardless of where you sit.
- **Classifying by the model, not the use case.** GPT-4 isn't "high-risk" — *using it to screen loan applicants* is.
- **Treating transparency as optional.** Not labelling an AI chatbot or a deepfake is itself a violation.
- **Confusing the AI Act with GDPR.** They stack — you often owe duties under both (see [PII & data privacy](/responsible-ai/pii-data-privacy)).

## Interview tip

Say: *"First question I ask any feature is its AI Act risk tier, because that dictates the architecture. A chatbot is limited-risk — I just need an AI-disclosure notice. But anything that screens people for jobs, credit, or biometrics is high-risk, which forces human oversight, logging, and a conformity assessment. And it applies to us in Dubai the moment our output reaches an EU user."* That shows you treat law as a design constraint, not an afterthought.
