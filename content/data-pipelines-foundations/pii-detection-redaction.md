# PII Detection & Redaction

**The one-line idea:** automatically finding personal data — names, emails, phone numbers, national IDs, credit cards — in your text and masking or removing it *before* that text gets stored, embedded, logged, or sent to a model, so you don't leak private information or break privacy law.

## Why it matters for an AI Engineer

This is where data engineering meets *legal risk*, and it's non-optional. The moment data crosses a trust boundary — into a vector store, an LLM prompt, a log file, a fine-tuning corpus, or a third-party API — any personal data in it is now exposed somewhere it shouldn't be. In the UAE, the **PDPL (Personal Data Protection Law)** governs this, and finance/health/government projects have hard rules about what can leave the building. An LLM that memorized a customer's Emirates ID from training data, or a log that captured a phone number in a prompt, is a reportable incident. Interviewers for any enterprise/Dubai AI role will ask how you handle PII, because shipping without it is a fireable mistake, not a rough edge.

## The mechanism / how it works

Two steps: **detect**, then **transform**.

**Detection** finds the spans of PII in text. Three complementary methods, usually combined:
1. **Regex / pattern matching** — great for *structured* PII with fixed shapes: emails, phone numbers, credit cards (Luhn-checkable), IBANs, Emirates ID numbers. Fast, deterministic, cheap.
2. **NER (Named Entity Recognition)** — an ML model that finds *unstructured* PII by context: person names, locations, organizations. Catches "call Ahmed at the Dubai office" where no pattern exists.
3. **Context rules / checksums** — validate candidates (Luhn for cards, format checks for IDs) to cut false positives.

**Redaction/transformation** decides *what to do* with a detected span. Options, from most to least destructive:
- **Removal** — delete it entirely.
- **Masking** — replace with `[EMAIL]` or `****1234`.
- **Pseudonymization / tokenization** — replace with a stable fake token (`Ahmed` → `PERSON_47`) so you can still join/analyze without exposing the real value; the real↔token map is kept in a secure vault.
- **Hashing / encryption** — one-way or reversible transforms for fields you must retain.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 "Call Ahmed at +971 50 123 4567"</span>
    <span class="darr">→<span class="lbl">detect: regex + NER</span></span>
    <span class="dbox orange">🔍 spans: PERSON, PHONE</span>
    <span class="darr">→<span class="lbl">transform</span></span>
    <span class="dbox green">✅ "Call [NAME] at [PHONE]"</span>
  </div>
  <div class="dcap">Detect PII spans (patterns + ML), then mask/tokenize before the text is stored, embedded, or logged.</div>
</div>

Where you place this matters: redact **before** embedding and storage, and also scrub PII out of **prompts and logs** — the two places teams most often forget.

## Concrete example

Detection + anonymization with **Microsoft Presidio** (the open-source standard, combines regex + spaCy NER):

```python
# pip install presidio-analyzer presidio-anonymizer
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

text = "Call Ahmed at +971 50 123 4567 or ahmed@example.com"
results = analyzer.analyze(text=text, language="en")   # finds PERSON, PHONE, EMAIL

clean = anonymizer.anonymize(
    text=text, analyzer_results=results,
    operators={"DEFAULT": OperatorConfig("replace", {"new_value": "[REDACTED]"})},
).text
print(clean)   # Call [REDACTED] at [REDACTED] or [REDACTED]
```

You can register **custom recognizers** for region-specific PII like an Emirates ID pattern, and use different operators per entity type (mask emails, tokenize names).

## How a company uses this

A Dubai hospital building a clinical-notes assistant runs Presidio with custom recognizers for Emirates ID and local phone formats at *two* points: before any note is embedded into the RAG store, and in a middleware that scrubs prompts and responses before they hit logs or the model provider. Their driving constraint is regulatory — under health-data rules, raw patient identifiers must never leave their VPC, so names/IDs are **tokenized** (not just masked) so clinicians can still trace a note back via the secure vault, while the model only ever sees `PATIENT_2231`. The failure mode they engineered against is subtle: an early prototype masked PII in stored documents but *not* in the debug logs, and phone numbers showed up in Datadog — a leak that passed no test but failed the audit. The lesson they teach new hires: PII scrubbing must cover *every* exit, especially logs.

## Common mistakes / misconceptions

- **Regex-only.** Patterns can't catch names and free-text PII; you need NER too. NER-only misses structured IDs. Use both.
- **Forgetting logs and prompts.** Teams redact the corpus but leak PII into application logs or the LLM prompt/response. Every trust boundary counts.
- **Over-redaction destroying utility.** Nuking all entities can strip the meaning the model needs. Tokenization often beats deletion — keep structure, hide identity.
- **Assuming the model won't memorize.** If PII is in a fine-tuning set, the model can regurgitate it. Redact before training, always.

## Interview tip

Say: *"I treat PII as a trust-boundary problem: detect with regex for structured IDs plus NER for names and free text — Presidio is my default — and transform before the data is stored, embedded, logged, or sent to a provider. In regulated Dubai work under PDPL I tokenize rather than delete so I keep analytical utility while the real values stay in a secure vault, and I make sure logs and prompts are scrubbed too, not just the corpus."* Mentioning PDPL, tokenization-over-deletion, and *logs* signals you've shipped this for real.
