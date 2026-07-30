# Long-Context Handling

**The one-line idea:** modern models accept huge windows (128K–1M+ tokens), but they don't use all of it equally well — long-context handling is the craft of *ordering and placing* information so the model actually attends to what matters.

## Why it matters for an AI Engineer

It's tempting to think "the window is a million tokens now, so I'll just paste everything in." In reality, big windows have two taxes: models **degrade** on information buried in the middle of a long context ("lost in the middle"), and you **pay per token** on every call plus eat latency that grows with length. So the interview-relevant skill isn't "use a big window" — it's knowing *when* a genuinely long context is the right tool, and *how* to structure it so quality doesn't collapse. Get this wrong and you'll have a system that's expensive, slow, and quietly ignores the one fact you needed.

## The mechanism / how it works

Two effects govern long context:

**Lost in the middle.** Empirically, models attend most reliably to the **beginning** and **end** of the context and least reliably to the **middle**. Put the crucial instruction or the key document at the top or bottom; never bury it at 50% depth in a 100K-token prompt. This is a robust, repeatedly-measured finding — treat it as a design constraint.

**Cost and latency scale with length.** Every input token is billed. Attention cost grows with context (roughly linearly in served systems, historically quadratic in the raw mechanism), so a 200K-token prompt is both pricier and slower to first token than a 5K one. A million-token call can cost dollars *per request*.

The practical playbook:

- **Retrieve, don't dump.** If you can find the relevant 5K tokens via [RAG](rag-dynamic-filters.md), do that instead of pasting 500K. Long context is a fallback for when relevance can't be pre-computed (e.g. "summarize this whole contract"), not a default.
- **Order deliberately.** Instructions and the most important evidence go at the **edges**. A common pattern: system instructions on top, then documents, then *re-state the question at the very bottom* so it's the last thing the model reads.
- **Structure it.** Clear headers, numbered sources, and "here are the documents / here is the task" separators help the model navigate.

<div class="diagram">
  <div class="dstack">
    <span class="dbox green">✅ top — instructions + key fact (attended)</span>
    <span class="dbox gray">middle — bulk documents (weakest attention)</span>
    <span class="dbox green">✅ bottom — restate the question (attended)</span>
  </div>
  <div class="dcap">Edges get the strongest attention; put what matters at top and bottom, bulk in the middle.</div>
</div>

## Concrete example

```python
# Long-context prompt engineered for "lost in the middle".
def build_long_prompt(question, docs):
    parts = [f"# Task\nAnswer using ONLY the sources. Question: {question}\n",  # top edge
             "# Sources"]
    for i, d in enumerate(docs, 1):                     # bulk in the middle
        parts.append(f"\n## Source {i} — {d.title}\n{d.text}")
    parts.append(f"\n# Now answer this exact question:\n{question}")            # bottom edge
    return "\n".join(parts)
# Question appears at BOTH edges; sources structured with headers in the middle.
```

The doubled question is the cheap, well-known trick: it guarantees the task sits in a high-attention zone regardless of how many documents fill the middle.

## How a company uses this

A Dubai insurer's claims assistant sometimes must reason over a *full* 80-page policy at once (cross-references make chunking lossy), so long context is genuinely warranted. They measured that placing the claim question only at the top let the model miss clauses near the middle; restating it at the bottom and adding per-clause headers lifted accuracy noticeably. But because an 80-page call costs ~$0.30 and adds seconds of latency, they use it *only* for the whole-document reasoning path and route ordinary lookups through cheap RAG. That "long context only when chunking loses too much" rule is the core production judgment.

## Common mistakes / misconceptions

- **"Bigger window = just paste everything."** It raises cost and latency and triggers lost-in-the-middle. Use retrieval when you can.
- **Burying the instruction.** The one sentence that matters must not sit at 50% depth. Edges only.
- **Ignoring the bill.** Long-context calls can be 20–100× the cost of a retrieval-based one. Know your per-request price.
- **Assuming perfect recall.** Even "1M-token" models miss mid-context facts. Verify with your own eval, don't trust the spec sheet.

## Interview tip

Say: *"Big windows aren't free — models lose facts in the middle and cost/latency scale with length. So I retrieve when I can, and when I truly need long context I structure it: instructions and the key question at the top *and* bottom, documents in the middle with headers. I reserve full long-context calls for cases where chunking would lose cross-references, and I know the per-request cost."* Naming "lost in the middle" and the edge-placement fix is the specific signal interviewers want.
