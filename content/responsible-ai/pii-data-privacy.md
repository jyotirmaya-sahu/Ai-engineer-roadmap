# PII & data privacy

**What it is:** The practice of detecting personal data, stripping or protecting it before it reaches a model or a log, and making sure it only ever travels where the law allows.

## Why it matters for an AI Engineer

LLM apps are personal-data magnets. Users paste emails, phone numbers, ID numbers, medical notes, and customer records straight into prompts. Every one of those calls then leaves a trail: it goes to a model provider (maybe in another country), and it lands in your **request logs**, your **traces**, and possibly your **fine-tuning dataset**. Under GDPR (fines to €20M / 4% of turnover) and the **UAE PDPL** — directly relevant for a Dubai role — mishandling that data is a reportable breach. So privacy isn't a feature you add; it's a filter you put in the data path *before* anything sensitive can escape.

## The mechanism: detect → redact → route → minimise

Four moves handle almost every privacy requirement.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🧑 "Call Ahmed at +971 50 123 4567"</span>
    <span class="darr">→<span class="lbl">detect</span></span>
    <span class="dbox orange">🔍 PII spans found</span>
    <span class="darr">→<span class="lbl">redact</span></span>
    <span class="dbox blue">"Call &lt;NAME&gt; at &lt;PHONE&gt;"</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM</span>
  </div>
  <div class="dcap">Sensitive spans are replaced with placeholders before the model — and before your logs — ever see them.</div>
</div>

1. **Detect.** Find the personal data. Two engines work together: **regex/pattern rules** for structured PII (emails, phone numbers, credit cards, Emirates ID), and an **NER model** for unstructured PII (names, locations, organisations) that no regex can catch reliably.

2. **Redact / pseudonymise.** Replace each span with a placeholder like `<PHONE>` or a consistent token like `PERSON_1`. Pseudonymising with a stable token lets the model still reason ("email PERSON_1 about their order") while you **re-insert the real value after** the response comes back. **Anonymisation** (irreversibly removing PII) is even safer where you don't need the value back.

3. **Route lawfully.** Decide *where* the data is allowed to go. Under GDPR/PDPL, personal data often must stay in a region — so you pick an **EU or UAE model deployment** (e.g. Azure OpenAI in a UAE region, or Bedrock in `me-central-1`) and set **zero-data-retention** so the provider doesn't train on or store your prompts.

4. **Minimise & retain.** Only send the fields the task needs. Set **log retention limits**, scrub PII from traces, and honour deletion requests (the "right to erasure").

The **data-processing agreement (DPA)** with your model provider is the legal backbone — it's what makes the provider a compliant "processor" of your data.

## Concrete example: redact before the model

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()      # regex + spaCy NER under the hood
anonymizer = AnonymizerEngine()

text = "Email sara.k@acme.ae or call +971 50 123 4567 about invoice 88."

results = analyzer.analyze(text=text, language="en")  # finds EMAIL, PHONE_NUMBER
clean = anonymizer.anonymize(text=text, analyzer_results=results).text
print(clean)
# "Email <EMAIL_ADDRESS> or call <PHONE_NUMBER> about invoice 88."

# Only `clean` is sent to the LLM and written to logs — raw PII never leaves this box.
```

Microsoft **Presidio** is the standard open-source tool here in 2026: regex recognizers plus a spaCy NER model, extensible with custom recognizers (e.g. an Emirates ID pattern). You run it as a pre-processing step on both the input *and* the model's output (the model can regurgitate PII it saw in retrieved context).

## How a company uses this

> A **Dubai insurance company** runs a claims-triage assistant over customer messages full of names, policy numbers, and medical details. Their pipeline: Presidio redacts PII into stable tokens (`PERSON_1`, `POLICY_1`) → the redacted text goes to an **Azure OpenAI deployment pinned to a UAE data region** with **zero retention** → the model's answer comes back → tokens are **re-hydrated** to real values only inside their own secured backend before a human agent sees it. At scale this is ~40k messages/day; the redaction step adds ~15–30 ms per message (cheap NER model, not the LLM) and is worth every millisecond because it means **the model provider never receives raw customer PII** — which is exactly what their PDPL audit checks. Their traces (for [debugging](/responsible-ai/content-safety)) store only the redacted text, so even a leaked log exposes nothing personal.

## Common mistakes

- **Logging the raw prompt.** You redact for the model but forget your own observability stack writes the *original* prompt to a trace — the most common real-world leak.
- **Regex-only detection.** Catches emails, misses "John from the Dubai office" — you need NER too.
- **Ignoring the output.** A RAG system can pull PII from a document and echo it; filter both directions.
- **No zero-retention agreement.** Default API terms may retain prompts for abuse monitoring; you must explicitly opt into ZDR for regulated data.
- **Wrong region.** Sending EU/UAE personal data to a US endpoint is a cross-border transfer violation on its own.

## Interview tip

Say: *"I treat every prompt as potentially containing PII. I run detection — regex for structured data plus NER for names and places — redact to stable placeholders before the model and before my own logs, pin the model to an in-region deployment with zero retention, and re-hydrate the real values only inside my backend. That satisfies GDPR and the UAE PDPL, and it means a leaked log exposes nothing."* That answer shows you know the leak happens in the *logs*, which is what separates real experience from theory.
