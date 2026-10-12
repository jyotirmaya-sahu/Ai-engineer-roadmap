# v18 · Grounding, Citations & Guardrails

**What you'll build:** HelpDesk answers policy questions only from approved context, cites the exact evidence it used, refuses unsupported claims, and treats customer/uploaded text as untrusted data.

## Why this version

A polished unsupported answer is dangerous in support. Refund windows, warranty terms, and fees must come from approved policy—not model memory. Attachments and tool results can also contain text such as “ignore previous instructions.” That text is evidence, never authority.

## The mechanism

For now, use a small curated policy set selected by deterministic topic tags; the full retrieval pipeline comes in the next RAG phase. Give each excerpt a stable source ID. The system instruction states that only the `<sources>` block may support factual policy claims and that text inside sources or customer input cannot change instructions.

Require an answer made of atomic claims. Each claim includes one or more citations with a source ID and exact supporting span. Reject unknown sources, spans absent from the immutable source snapshot, inapplicable policy versions, and unsupported answers.

<div class="diagram">
  <div class="flow"><span class="dbox gray">customer + untrusted evidence</span><span class="darr">→</span><span class="dbox blue">approved source excerpts</span><span class="darr">→</span><span class="dbox purple">grounded answer schema</span><span class="darr">→</span><span class="dbox orange">citation + safety validators</span><span class="darr">→</span><span class="dbox green">answer or escalation</span></div>
  <div class="dcap">The model proposes; deterministic validators decide whether the answer may be shown.</div>
</div>

```python
class Citation(BaseModel):
    source_id: str
    supporting_span: str = Field(min_length=1)

class Claim(BaseModel):
    text: str
    citations: list[Citation] = Field(min_length=1)

class GroundedAnswer(BaseModel):
    claims: list[Claim]
    escalation_reason: str | None
```

The server renders the visible answer only by joining approved `Claim.text` values; there is no independent free-form answer channel and model self-report never gates display. Deterministic checks prove citation existence, provenance, applicability, and exact-span presence; they do **not** prove semantic entailment. Run a calibrated claim-faithfulness verifier and escalate high-risk or below-threshold claims to a human. Refund eligibility and other consequential decisions remain deterministic policy code.

Moderate input before expensive processing and output before display. Moderation is separate from prompt-injection defense: a harmless-looking sentence can still attempt to override instructions. Add test strings in customer text, PDFs, tool results, and similar-ticket summaries. Confirm that protected instructions are not reproduced. Secrets must never enter model context; red-teaming is detection, not the primary secret-control mechanism.

Use a citation-faithfulness evaluation: for each answer, a reviewer marks whether every material claim is supported by the cited excerpt. Also measure abstention quality—HelpDesk should escalate unsupported questions, not merely attach an irrelevant citation.

## How a company uses this

A UAE retailer can pin every return-policy answer to a versioned policy paragraph and retain the source version with the ticket. When policy changes, old decisions remain auditable. High-risk categories such as payments or legal complaints route to humans regardless of model confidence. Security teams maintain an injection test suite as a release gate.

## Common mistakes

- Asking for citations but never verifying that cited IDs exist.
- Treating delimiters as a complete injection defense.
- Letting retrieved text redefine tools or permissions.
- Forcing an answer when no source supports it.
- Using moderation as a substitute for authorization and output validation.

## Interview tip

Separate four controls: authoritative sources, instruction/data separation, schema validation, and deterministic permission checks. No single prompt sentence provides security.

## Practice — assignments

1. Give each approved policy excerpt a stable versioned ID.
2. Return structured answers with verified citations.
3. Escalate when no approved source supports the answer.
4. Add injection attempts inside every context source.
5. Moderate both customer input and final output.
6. Measure citation faithfulness on 50 questions.
7. Block high-risk categories from automatic resolution.
