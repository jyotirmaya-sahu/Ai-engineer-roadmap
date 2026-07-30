# Grounding & citations

**What it is:** Grounding is instructing the model to answer *only* from a set of provided sources, and citations are making it point to *which* source each claim came from — so answers are verifiable, not invented.

## Why it matters for an AI Engineer
An ungrounded LLM answers from its fuzzy training memory and will confidently state things that are wrong or outdated. In any factual app — support over your docs, legal Q&A, financial info — that's unacceptable. Grounding ties every answer to real, current source text you control, and citations let a user (or auditor) *check* it. This is the beating heart of RAG and the single biggest lever against [hallucination](./avoiding-hallucination.md). For an AI Engineer, "make it grounded and cited" is one of the most common production requirements you'll be handed.

## The mechanism
Grounding is a prompt discipline layered on retrieval:

1. **Retrieve** relevant source chunks (via RAG) and put them in the prompt, each fenced with an ID: `[1] <text>`, `[2] <text>`.
2. **Instruct** the model, firmly: *"Answer ONLY using the CONTEXT below. If the answer isn't in the context, say you don't know. Cite the source ID in brackets after each claim."*
3. **Constrain** with [delimiters](./delimiters.md) so context is clearly data, and often [structured output](./structured-output.md) so citations come back as a machine-checkable field.

The reason it works: you're shifting the model's job from "recall a fact" (unreliable) to "read and quote from this text" (reliable — LLMs are excellent at reading comprehension). The "if it's not here, say you don't know" clause is essential — without an explicit escape hatch, the model fills gaps with its training memory, and you're back to hallucinating.

Citations add a verification layer: because each claim names a source ID, you (or an automated check) can confirm the cited chunk actually supports the claim — catching the case where the model cites `[2]` for something `[2]` never said.

## Concrete example
```python
from openai import OpenAI
client = OpenAI()

context = """[1] Standard delivery within Dubai takes 1-2 business days.
[2] Returns are accepted within 14 days of delivery for unused items.
[3] Cash on delivery is available for orders under 500 AED."""

SYSTEM = """Answer ONLY from the CONTEXT. After each fact, cite its source like [1].
If the answer is not in the context, reply exactly: "I don't have that information." """

r = client.chat.completions.create(
    model="gpt-4o", temperature=0,
    messages=[
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": f"CONTEXT:\n{context}\n\nCan I return an item after 20 days, and pay cash?"},
    ],
)
print(r.choices[0].message.content)
# -> "Returns are only accepted within 14 days [2], so 20 days is too late.
#     Cash on delivery is available for orders under 500 AED [3]."
# Note: it does NOT invent a 20-day exception — it grounds strictly in [2].
```

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ Retrieved sources [1][2][3]</span>
    <span class="darr">→<span class="lbl">"answer only from this"</span></span>
    <span class="dbox purple">🧠 LLM reads & quotes</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Answer with [citations]</span>
  </div>
  <div class="dcap">Grounding turns "recall a fact" into "read and cite the provided text" — verifiable, not invented.</div>
</div>

## How a company uses this
A Dubai law firm's contract assistant (from the RAG examples) must never state a clause that isn't in the actual document — a wrong "termination notice is 30 days" could cause real legal harm. Every answer is grounded in retrieved clauses and cites the clause number, and the UI links each citation back to the highlighted source paragraph so a lawyer verifies in one click. They add an automated **citation-faithfulness check**: a second cheap LLM call verifies each cited clause actually supports the stated claim, flagging mismatches for review. At scale this catches the ~2–3% of answers where retrieval was right but the model over-stated — the difference between a trustworthy legal tool and a liability.

## Common mistakes
- **No "say I don't know" escape hatch.** Without it, the model fills gaps from training memory — grounding defeated.
- **Weak instruction.** "Use the context" is too soft; use "ONLY from the context" as a firm rule.
- **Citing without verifying.** A citation the source doesn't actually support is worse than none — add a faithfulness check for high-stakes use.
- **Dumping too much context.** Irrelevant chunks dilute the answer and invite the model to blend in outside knowledge. Retrieve tightly.
- **Not fencing the context.** Mixed with instructions, retrieved text can also cause [injection](./prompt-injection-defense.md).

## Interview tip
Say: *"Grounding means answering strictly from retrieved sources with an explicit 'if it's not here, say I don't know' clause, and citing each claim's source ID so it's verifiable. It reframes the model's job from unreliable recall to reliable reading. For high-stakes use I add a citation-faithfulness check to confirm the source actually supports each claim."* That shows you know grounding is the core RAG reliability lever — and that citations must be *checked*, not just present.
