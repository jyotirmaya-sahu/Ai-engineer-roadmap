# Data leakage / PII

**What it is:** sensitive data — customer PII, secrets, internal documents — flowing somewhere it shouldn't: into a prompt sent to a third-party model, into logs, or straight into an answer shown to the wrong person.

## Why it matters for an AI Engineer

This is the threat that gets companies *fined*. Dubai and the wider UAE have real data-protection law (the UAE Personal Data Protection Law, plus sector rules from the DIFC and the central bank), and finance/healthcare clients will audit exactly where their data goes. An AI Engineer who can't answer "does customer PII leave our tenant when you call the LLM?" won't clear a bank's security review. Data leakage is quiet — no error, no crash — which is exactly why it's dangerous and why interviewers test whether you *design* for it rather than discover it after a breach.

## The mechanism

Leakage happens at four points in an LLM pipeline:

1. **Into the prompt (third-party exposure).** You paste a customer's full record into a prompt sent to OpenAI/Anthropic/etc. Now their PII sits in a vendor's systems. Whether that's allowed depends on your data-processing agreement and where the endpoint is hosted.
2. **Into logs / traces.** Observability tools (LangSmith, your own logging) capture full prompts and responses. If those contain PII and your logs aren't access-controlled, you've made a second copy of sensitive data in a less-guarded place.
3. **Into the answer (broken access control).** RAG retrieves a document the *current* user isn't allowed to see, and the model summarizes it to them. The model has no idea about your permission model — it will happily read whatever chunk retrieval hands it.
4. **Training-data memorization.** If you fine-tune on real customer data, the model can later regurgitate a memorized name or number to a different user.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👤 User query + 📄 customer record</span>
    <span class="darr">↓<span class="lbl">redact PII</span></span>
    <span class="dbox orange">🕵️ scrub → [NAME], [ACCOUNT]</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 LLM (third-party)</span>
    <span class="darr">↓<span class="lbl">re-insert if needed</span></span>
    <span class="dbox green">✅ answer • logs store redacted only</span>
  </div>
  <div class="dcap">Redact before the model and before logging; keep the real values on your side.</div>
</div>

The core defenses: **redact PII before it leaves your boundary**, **enforce access control at retrieval time** (filter the vector search by the user's permissions — see [Embeddings & Indexing](../embeddings-indexing.md)), and **scrub logs**.

## Concrete example

Redacting PII before it ever reaches a third-party model, using Microsoft Presidio:

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer, anonymizer = AnalyzerEngine(), AnonymizerEngine()

text = "Ahmed Khan (Emirates ID 784-1990-1234567-8, ahmed@bank.ae) disputes charge AED 4,200."
found = analyzer.analyze(text=text, language="en")          # detect PERSON, EMAIL, etc.
safe = anonymizer.anonymize(text=text, analyzer_results=found).text
print(safe)
# "<PERSON> (Emirates ID <...>, <EMAIL_ADDRESS>) disputes charge AED 4,200."
# Send `safe` to the LLM. Keep the mapping locally if you must re-insert real values.
```

Now the third-party model — and your logs — only ever see placeholders. You reason over the structure of the complaint without exposing who the customer is.

## How a company uses this

**A Dubai insurer** built a claims-triage assistant. Their compliance line was hard: *no policyholder PII may leave the UAE tenant.* They enforced it in three layers — (1) a Presidio redaction pass on every prompt so names, Emirates IDs, and policy numbers become tokens before the LLM call; (2) RAG retrieval filtered by the agent's branch and the claimant's ID, so an agent physically cannot retrieve another region's files; (3) a logging middleware that stores only the redacted prompt/response, with raw text dropped. When the regulator audited, they could show that even a compromised log store held zero real PII. At ~50k claims/month, the redaction added a few ms per request — a trivial cost for passing the audit.

## Common mistakes

- **Redacting the prompt but logging the raw input.** The unredacted copy in logs is still a breach.
- **Ignoring retrieval access control.** The model will summarize any chunk it's given; filter *before* retrieval, per user.
- **Assuming "we use an API, so it's fine."** Where the endpoint runs and what your contract says determines legality — check the DPA and data residency.
- **Fine-tuning on raw PII**, which risks memorized leakage to other users.

## Interview tip
Say: *"I treat PII exposure as a design constraint, not an afterthought. I redact sensitive fields before anything leaves our boundary (e.g. Presidio), enforce access control at retrieval time so RAG can't surface data the user isn't cleared for, and scrub logs so observability doesn't become a second unguarded copy. In the UAE I'd confirm data residency and the vendor DPA."* Naming residency and retrieval-level access control shows you understand leakage as more than "don't print the password."
