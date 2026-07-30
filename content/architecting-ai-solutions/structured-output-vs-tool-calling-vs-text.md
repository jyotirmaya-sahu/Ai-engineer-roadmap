# Structured output vs tool-calling vs text

**What it is:** the decision of *what form the model's answer takes* — free-form text for a human, a strict JSON object for your code, or a tool/function call that makes the model *act*.

## Why it matters for an AI Engineer

The moment an LLM's output feeds *code* instead of a human's eyes, "return some text and I'll parse it" becomes a fragility nightmare — one stray word or a markdown fence and your `json.loads` throws in production. Modern APIs solve this with **structured output** (guaranteed-valid JSON) and **tool-calling** (the model emits a call your code executes). Picking the right output mode is what makes an LLM a reliable *component* in a system rather than a chatbot you babysit. Interviewers probe it because parsing free-text with regex is the mark of someone who hasn't shipped.

## The mechanism: three output modes

<div class="diagram">
  <div class="flow">
    <span class="dbox green">💬 Free text<span class="sub">for a human to read</span></span>
    <span class="dbox blue">🔢 Structured (JSON)<span class="sub">for your code to consume</span></span>
    <span class="dbox orange">🛠️ Tool call<span class="sub">for the model to act</span></span>
  </div>
  <div class="dcap">Who consumes the output — a human, your code, or an external system — decides the mode.</div>
</div>

- **Free text** — natural language. Use when a **human** reads the output: chat replies, summaries, drafts, explanations. Flexible and expressive; *unreliable to parse* by machine. If nothing downstream is code, this is right.
- **Structured output** — the model returns JSON conforming to a schema you define (JSON mode / "response format" with a schema, or a Pydantic model). The API **guarantees valid, schema-matching JSON** — no more "sometimes it wraps it in ```json```." Use when your **code** consumes the answer: extract fields, classify into an enum, populate a UI, hand data to the next step. This replaces brittle regex parsing entirely.
- **Tool-calling (function-calling)** — you describe functions (`get_weather(city)`, `create_ticket(...)`); the model, instead of answering, returns *which function to call with which arguments*. Your code runs it and (optionally) feeds the result back. Use when the model must **act** — fetch live data, hit an API, trigger a side effect, or route to the right store (as in [vector vs keyword vs SQL vs graph](vector-vs-keyword-vs-sql-vs-graph.md)).

| Mode | Consumed by | Reach for it when | Reliability for machines |
|---|---|---|---|
| **Free text** | a human | chat, summaries, drafts | ✗ (don't machine-parse) |
| **Structured JSON** | your code | extraction, classification, UI data | ✔ schema-guaranteed |
| **Tool-calling** | your code + external systems | fetch data / take an action | ✔ validated args |

**The subtle relationship:** structured output and tool-calling are cousins — both make the model emit *validated, structured* data instead of prose. The difference is **intent**: structured output *returns data to you*; tool-calling *asks you to run something*. And you mix modes in one system — a tool-call fetches an order (action), a structured step extracts fields (data), a final free-text step writes the human-friendly reply.

## Worked example: structured output done right

```python
from pydantic import BaseModel
from openai import OpenAI
client = OpenAI()

class Ticket(BaseModel):
    category: str          # "billing" | "technical" | "other"
    urgency: int           # 1-5
    summary: str

# The API guarantees the response parses into this schema — no regex, no try/except on json.loads
resp = client.responses.parse(
    model="gpt-5.4-mini",
    input="My payment failed three times and I'm furious.",
    text_format=Ticket,
)
t = resp.output_parsed          # -> Ticket(category='billing', urgency=5, summary='...')
route_to_queue(t.category)      # safe: it's a validated object, not a hopeful string
```

Compare the naive version: `"Reply as JSON: {category, urgency}"` then `json.loads(response)` — which breaks the first time the model adds a friendly sentence or a code fence. Schema-enforced structured output makes that class of bug *impossible*.

## How a company uses this

> **A Dubai clinic's intake assistant.** The patient chats in free text (human-facing — natural language is right there). Behind it, a **structured-output** call extracts `{symptom, duration_days, severity, department}` as a validated object that populates the clinic's system directly — no fragile parsing, so a chatty patient message never crashes the pipeline. When the patient asks "is Dr. Khan free Thursday?", the model emits a **tool-call** `check_availability(doctor, date)` that hits the real booking API, and the result comes back for a final **free-text** confirmation. Three modes, one flow, each matched to its consumer. Before they moved extraction to schema-enforced structured output, ~3% of intake messages failed to parse and dropped on the floor — the switch took that class of failure to zero.

## Common mistakes
- **Parsing free text with regex/`json.loads`.** The archetypal production bug. If code consumes it, use structured output — don't hope the text is clean.
- **Asking for JSON in the prompt instead of using structured-output mode.** "Reply only in JSON" is a *request*, not a guarantee; the model still occasionally adds prose or fences. Use the API's schema-enforced mode so validity is guaranteed.
- **Tool-calling when you only need data.** If you just want fields extracted, that's structured output, not a tool call — no function needs to run.
- **Free text where a schema belongs.** Populating a UI from an LLM's prose paragraph is asking for breakage. Define the schema.
- **Over-constraining creative output.** The flip side: forcing a chatty, human-facing reply into rigid JSON makes it robotic. If a human reads it, let it be text.

## Interview tip
Say: *"I choose the output mode by who consumes it. A human reads it → free text. My code consumes it → structured output with a schema, so it's guaranteed valid — I never regex-parse an LLM. The model needs to act or fetch live data → tool-calling. And I mix them: a tool-call fetches, a structured step extracts, a free-text step writes the reply. Prompting 'reply in JSON' isn't the same as schema-enforced structured output — only the latter guarantees it parses."* That last distinction is a strong senior tell.
