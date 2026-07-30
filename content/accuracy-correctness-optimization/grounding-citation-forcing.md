# Grounding & citation-forcing

**What it is:** Forcing the model to base every claim on retrieved text — and to *quote where it got it* — so it can't quietly invent facts.

## Why it matters for an AI Engineer

A RAG system retrieves documents, but *nothing makes the model actually use them*. Ungrounded, it happily blends retrieved facts with plausible inventions from its training data, and you can't tell which is which. Citation-forcing turns the model from a confident narrator into a clerk that must point at the file. It's the single highest-leverage anti-hallucination technique for factual apps, and "every answer carries a citation you can click" is exactly what a Dubai bank or law firm demands before signing off on a deployment.

## The mechanism

Grounding has two parts working together:

1. **Instruct-and-format.** You tell the model, in the system prompt, to answer *only* from the provided context, to attach a source marker to each sentence, and to refuse if the context doesn't contain the answer. You give it retrieved chunks each tagged with an ID: `[1] policy_v3, p.12: "..."`. The model then writes answers like *"Termination requires 30 days' notice [1]."*

2. **Verify the citations.** The prompt instruction is a request, not a guarantee — models sometimes cite the wrong chunk or fabricate a marker. So a second step programmatically checks that (a) every citation ID actually exists in the retrieved set, and (b) the cited chunk genuinely supports the sentence (an NLI/entailment model or a cheap LLM-judge call). Sentences that fail get dropped or flagged.

The key mental shift: grounding is a **constraint on the answer**, and citation is the **audit trail that lets you enforce it**. Without the citation you can only *hope* it used the source; with it you can *check*.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ "notice period?"</span>
    <span class="darr">↓</span>
    <span class="dbox blue">📚 retrieved chunks [1][2][3]</span>
    <span class="darr">↓<span class="lbl">answer only from these + cite</span></span>
    <span class="dbox purple">🤖 "30 days [1]"</span>
    <span class="darr">↓<span class="lbl">does [1] support it?</span></span>
    <span class="dbox green">✅ verified & cited</span>
  </div>
  <div class="dcap">Answer is constrained to sources; the citation is the audit trail a verifier checks.</div>
</div>

## Concrete example

```python
from anthropic import Anthropic
client = Anthropic()

chunks = [
    {"id": 1, "text": "Either party may terminate with 30 days written notice."},
    {"id": 2, "text": "Fees are billed monthly in AED."},
]
context = "\n".join(f"[{c['id']}] {c['text']}" for c in chunks)

SYSTEM = (
    "Answer ONLY using the numbered context. After each sentence, cite the "
    "source id like [1]. If the context does not contain the answer, reply "
    "exactly: I don't know based on the provided documents."
)
resp = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=300,
    system=SYSTEM,
    messages=[{"role": "user",
               "content": f"Context:\n{context}\n\nQ: What is the termination notice period?"}],
)
answer = resp.content[0].text

# Verify: every [n] cited must exist in the retrieved set
import re
valid = {c["id"] for c in chunks}
cited = {int(n) for n in re.findall(r"\[(\d+)\]", answer)}
assert cited <= valid, f"Model cited non-existent sources: {cited - valid}"
print(answer)   # -> "The termination notice period is 30 days [1]."
```

The `assert` is the load-bearing part: it catches fabricated citations before they reach a user.

## How a company uses this

A Dubai law firm's contract-Q&A tool must let a lawyer click any sentence and jump to the exact clause. At ~2M clauses and thousands of queries a day, they run grounding in two tiers: the generation prompt forces citations (near-zero extra cost), and a cheap **entailment check** (a small NLI model, ~15ms per sentence on CPU) confirms each cited clause actually supports the claim. Sentences that fail entailment — about 3% — are stripped and the answer falls back to "I don't know." That verifier costs a fraction of a cent per query but is the reason the tool is trusted for billable work: an uncited or unsupported claim never reaches the lawyer.

## Common mistakes

- **Trusting the citation without checking it.** Models cite plausibly-wrong chunks; always verify the citation actually entails the claim (see [Verification & validators](./verification-validators.md)).
- **Grounding prose but not the refusal.** If you force citations but don't also allow "I don't know," the model invents a citation to satisfy the format. Pair grounding with [abstention](./i-don-t-know-calibration.md).
- **Chunks too big to cite precisely.** If a chunk is a whole page, "[1]" points at a page, not a clause — useless as an audit trail. Grounding quality depends on chunk granularity upstream.

## Interview tip
Say: *"Citation-forcing constrains the answer to retrieved sources and gives me an audit trail I can verify — I check every citation ID exists and that an entailment model confirms it actually supports the sentence, dropping the ones that don't. It only works if I also permit 'I don't know,' otherwise the model fabricates a citation to satisfy the format."* That shows you know grounding is a constraint you *enforce*, not just a prompt you *ask for*.
