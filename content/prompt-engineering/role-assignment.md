# Role assignment

**What it is:** Role assignment (aka persona prompting) is telling the model *who to be* — "You are a senior tax accountant," "You are a friendly kids' tutor" — to shape its expertise, tone, and vocabulary.

## Why it matters for an AI Engineer
The same question gets a different answer depending on who you tell the model it is. "Explain a mortgage" from "a plain-language advisor for first-time buyers" reads nothing like the same request from "a financial regulator." Role assignment is a cheap, one-line lever to control **tone, depth, and domain framing** without listing a hundred style rules. For an AI Engineer it's how you make one model serve different products — a friendly consumer bot vs. an expert internal tool — from the same underlying API.

## The mechanism
When you assign a role, you're conditioning the model on a region of its training distribution. It has seen vast amounts of text written by accountants, teachers, lawyers, marketers. Saying "You are an X" nudges next-token predictions toward the vocabulary, structure, and register typical of X's writing. It doesn't give the model *new knowledge* — it can't make it a real accountant — but it *activates and foregrounds* the relevant style and framing it already learned.

Practical rules:

- **Be specific.** "You are a helpful assistant" does almost nothing. "You are a pediatric nurse explaining medication to a worried parent, warm and jargon-free" shapes real behaviour.
- **Roles set style, not facts.** For correctness you still need [grounding](./grounding-citations.md) and [few-shot](./few-shot.md) examples — a persona won't stop hallucination.
- **Combine with audience.** Naming *who the answer is for* ("explain to a 10-year-old") is often more powerful than the persona alone.
- **Put it in the [system prompt](./system-prompting.md)** so the persona persists across the whole conversation.

## Concrete example
```python
from openai import OpenAI
client = OpenAI()

def answer(role):
    return client.chat.completions.create(
        model="gpt-4o-mini", temperature=0.4,
        messages=[
            {"role": "system", "content": role},
            {"role": "user", "content": "What is compound interest?"},
        ],
    ).choices[0].message.content

print(answer("You are a witty tutor explaining to a curious 12-year-old. Use one everyday analogy, 3 sentences max."))
# -> "Imagine a snowball rolling downhill: it grabs more snow, then that new snow grabs even MORE..."

print(answer("You are a financial analyst writing for institutional investors. Be precise and use correct terminology."))
# -> "Compound interest accrues on both principal and previously accumulated interest, yielding exponential growth per A = P(1+r/n)^(nt)..."
```

Same model, same question — the role changes vocabulary, analogy use, and depth entirely.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ "What is compound interest?"</span>
    <span class="darr">→</span>
    <span class="dbox purple">🎭 Persona: kids' tutor</span>
    <span class="darr">→</span>
    <span class="dbox green">🍭 Snowball analogy</span>
  </div>
  <div class="dcap">The persona steers tone, vocabulary, and depth — not the underlying facts.</div>
</div>

## How a company uses this
A Dubai edtech platform serves the *same* curriculum content to different age groups from one backend. They swap a single persona line — "explain to a 7-year-old with a story" vs. "explain to a university student with precise terms" — to re-target every lesson without rewriting content or maintaining separate models. A/B tests (see [experiment tracking](./experiment-tracking-a-b.md)) showed the tuned persona raised younger-student comprehension-quiz scores meaningfully. Production caveat: they still route factual claims through a [grounding](./grounding-citations.md) step, because a "friendly tutor" persona makes hallucinations *sound* more confident and trustworthy — persona amplifies tone, including when the content is wrong.

## Common mistakes
- **Expecting a persona to add knowledge.** "You are a doctor" doesn't make medical facts reliable; it just changes the style. Ground the facts separately.
- **Vague roles.** "Be helpful and professional" barely moves the needle; specificity is everything.
- **Persona hiding hallucination.** An authoritative persona makes wrong answers more convincing — dangerous without grounding/guardrails.
- **Overacting.** Heavy personas ("Talk like a pirate") can degrade task accuracy; keep it as strong as needed and no more.

## Interview tip
Say: *"Role assignment is a cheap lever for tone, depth, and domain framing — I put a specific persona in the system prompt to re-target the same content for different audiences. But I'm clear it shapes *style, not facts*: a confident persona can make hallucinations more convincing, so I always pair it with grounding for anything factual."* That distinction — style vs. truth — is what interviewers want to hear.
