# Semantic Memory

**What it is:** Memory of *facts and general knowledge* — distilled, timeless statements like "the user prefers metric units" or "the company's fiscal year starts in April" — stripped of when or how the agent learned them.

## Why it matters for an AI Engineer

Semantic memory is the second flavour of [long-term memory](long-term.md), and it's the workhorse of personalisation. Where [episodic memory](episodic.md) remembers *events* ("on Tuesday you asked X"), semantic memory remembers *facts* ("you're based in Dubai," "you're allergic to peanuts," "our refund policy is 14 days"). These facts are what let an agent behave like it *knows* the user and the domain without re-asking. For an AI Engineer, semantic memory is usually the highest-value, lowest-cost memory to build: a small set of durable facts injected into the prompt makes an agent feel dramatically more personal and competent, for a handful of tokens.

## The mechanism: how it works

A semantic memory is a **fact**: a compact, standalone statement true across time (until it changes). The key operation is **extraction** — turning messy conversation into clean facts:

1. **Extract** — after (or during) a session, an LLM reads the exchange and pulls out durable facts: "User works at Emirates NBD," "User prefers email over calls." You discard the conversational fluff and keep the reusable knowledge.
2. **Store** — save facts in a queryable store. Because facts are often about a subject, key-value or structured storage (per user, per entity) works well; free-form facts go in a [vector store](vector-memory.md) for similarity recall.
3. **Update / reconcile** — facts change. "User lives in London" must be *overwritten*, not duplicated, when they move to Dubai. Good semantic memory de-duplicates and resolves contradictions so the store holds the current truth.
4. **Recall** — inject the relevant facts into context for the current query (top-k by relevance, or all facts if the set is small).

The defining trait: semantic memory is **decontextualised**. It doesn't matter *when* or *in which conversation* the agent learned the fact — only that the fact is true. That's what separates it from episodic memory and makes it compact and reusable.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">💬 "I moved to Dubai last month, I bank with ENBD"</span>
    <span class="darr">→<span class="lbl">extract</span></span>
    <div class="dstack">
      <span class="dbox blue">📌 location = Dubai</span>
      <span class="dbox blue">📌 bank = Emirates NBD</span>
    </div>
  </div>
  <div class="dcap">Semantic memory distills conversation into timeless facts — the "when" is dropped.</div>
</div>

## Concrete example

Extract facts with an LLM, then upsert them (overwriting on key so facts stay current):

```python
from openai import OpenAI
import json
client = OpenAI()
facts = {}   # {user: {key: value}} — a DB in production

def extract_facts(text):
    r = client.chat.completions.create(
        model="gpt-4.1",
        messages=[{"role": "user",
            "content": "Extract durable user facts as a flat JSON object of "
                       "key:value (e.g. location, bank, preference). Only lasting "
                       f"facts, no events.\n\n{text}"}],
        response_format={"type": "json_object"})
    return json.loads(r.choices[0].message.content)

def update_facts(user, text):
    for k, v in extract_facts(text).items():
        facts.setdefault(user, {})[k] = v      # UPSERT: overwrite stale values

update_facts("u9", "I just moved to Dubai and I bank with Emirates NBD.")
# facts["u9"] == {"location": "Dubai", "bank": "Emirates NBD"}
update_facts("u9", "Actually I switched to ADCB.")
# facts["u9"]["bank"] == "ADCB"   # reconciled, not duplicated
```

The upsert on `k` is what keeps semantic memory *current* — a new value for `bank` overwrites the old one instead of leaving two contradictory facts.

## How a company uses this

A private-healthcare provider in Dubai gives patients an intake assistant. Semantic memory stores durable clinical facts per patient — allergies, chronic conditions, current medications, preferred language (English/Arabic). On every visit the agent recalls these ~10–20 facts and adapts: it won't suggest a drug the patient is allergic to, and it greets them in their language. Because the fact set per patient is small, they inject *all* of it (~200 tokens) with no vector search needed — cheap and reliable. The reconciliation logic is safety-critical: when a medication changes, the old fact is **overwritten**, because a stale "currently taking X" could cause a dangerous interaction suggestion. Semantic memory here is both a personalisation feature and a patient-safety mechanism.

## Common mistakes

- **Storing events as facts.** "User asked about refunds on Tuesday" is episodic, not semantic. Mixing them clutters the fact store and confuses recall.
- **Never reconciling.** Leaving both "lives in London" and "lives in Dubai" means the agent randomly picks a wrong one. Upsert by key; resolve contradictions.
- **Extracting too much.** Not every sentence is a durable fact. Over-extraction fills the store with noise like "user said thanks."
- **Forgetting privacy.** Semantic facts about people (health, finance) are sensitive — scope per user, secure, and support deletion, especially under Dubai/UAE data rules.

## Interview tip
Say: *"Semantic memory stores decontextualised facts — timeless statements like 'user is based in Dubai' — versus episodic memory's time-stamped events. I extract facts from conversation with an LLM, upsert them by key so stale values are overwritten, and inject the relevant ones into context. The two hard parts are clean extraction and reconciling contradictions so the store always holds current truth."* Emphasising reconciliation shows you've thought past the happy path.

See also: [Episodic](episodic.md) (events vs facts), [Long-term memory](long-term.md), [Which memory type when](which-memory-type-when.md).
