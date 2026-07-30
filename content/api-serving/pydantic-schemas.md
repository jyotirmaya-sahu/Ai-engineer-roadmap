# Pydantic schemas

**What it is:** A Pydantic schema is a Python class that describes the exact shape of your request or response data — and automatically validates, parses, and rejects anything that doesn't fit.

## Why it matters for an AI Engineer

Your model is expensive and fragile; the network is full of malformed junk. A schema is the guard at the gate: it turns "someone sent `{"mesage": ""}`" into a clean 422 error *before* a single token is generated, instead of a `KeyError` crash deep inside your handler. It also documents your API for free and makes structured LLM outputs safe. Pydantic is so central that it's what FastAPI, LangChain, and the OpenAI SDK all use to define data. Knowing it well is non-negotiable for the job.

## The mechanism / how it works

You define a class inheriting from `BaseModel`, with fields annotated by type. When FastAPI sees that class as an endpoint argument, it:

1. **Reads** the JSON body.
2. **Coerces** types where sensible (`"42"` → `42`).
3. **Validates** every field against its type and constraints.
4. On success, hands your function a fully-typed object (`payload.message`, with editor autocomplete).
5. On failure, returns a **422** with a precise, per-field error — you write zero validation code.

Constraints go via `Field`: `Field(..., min_length=1, max_length=4000)`. The `...` means *required*. Give a default (`temperature: float = 0.7`) and the field becomes optional. Nested models, lists, enums, and `Optional[...]` all work. A **response_model** validates what you send back too — and strips any extra fields, so you never leak an internal secret by accident.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">raw JSON body</span>
    <span class="darr">↓</span>
    <span class="dbox purple">ChatRequest(BaseModel)<span class="sub">validate + coerce</span></span>
    <span class="darr">↓<span class="lbl">bad</span></span>
    <span class="dbox orange">422 with field errors</span>
  </div>
  <div class="flow v">
    <span class="dbox purple">✓ valid</span>
    <span class="darr">↓</span>
    <span class="dbox green">typed object → your handler</span>
  </div>
  <div class="dcap">A schema either produces a clean typed object or a precise 422 — before your model runs.</div>
</div>

## Concrete example

```python
# Pydantic v2 (2026 standard), shipped with FastAPI
from fastapi import FastAPI
from pydantic import BaseModel, Field
from enum import Enum

app = FastAPI()

class Model(str, Enum):
    gpt4o = "gpt-4o"
    haiku = "claude-haiku"

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    model: Model = Model.gpt4o
    temperature: float = Field(0.7, ge=0.0, le=2.0)

class ChatResponse(BaseModel):
    reply: str
    tokens_used: int

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    # req is fully typed & validated here
    return ChatResponse(reply=f"[{req.model}] {req.message}", tokens_used=12)
```

Send `{"message": ""}` → automatic 422: *"message: String should have at least 1 character."* Send `temperature: 5` → 422: *"less than or equal to 2."* You wrote none of that logic. And the `/docs` page now shows the exact request/response shapes with an example.

## How a company uses this

Two production uses. **First**, input validation at the trust boundary: a Dubai fintech's `/chat` endpoint enforces `max_length=4000` on the message so a caller can't paste a 2-million-character prompt and trigger a huge token bill or an OOM. **Second — and this is the AI-specific superpower — structured LLM output.** They ask the model to extract data ("pull the amount, IBAN, and date from this transfer request") and pass a Pydantic schema to the LLM (via OpenAI's structured-output mode or an `instructor`-style wrapper). The model *must* return JSON matching that schema; Pydantic validates it, and anything malformed is caught and retried instead of silently corrupting the database. This is how teams turn a chatty LLM into a reliable data-extraction component at scale.

## Common mistakes

- **Using a bare `dict` as the body type** — you get no validation, no docs, no autocomplete. Always define a `BaseModel`.
- **Forgetting `response_model`** — internal fields leak, and the response shape drifts silently.
- **Mixing Pydantic v1 and v2 syntax** — v2 is the 2026 default; `@validator` is now `@field_validator`, and `.dict()` is `.model_dump()`.
- **Over-loose types** (`data: dict`) inside the model — be specific so validation actually protects you.

## Interview tip
Say: *"Pydantic is my validation layer. Every endpoint has a request model with `Field` constraints so bad input becomes a 422 before it hits the model, and a `response_model` so I never leak internal fields. For LLM work I reuse the same schemas to force structured outputs — the model must return JSON that validates, which turns a probabilistic model into a dependable component."* The structured-output point separates AI engineers from generic web devs.

See also: [Endpoints](endpoints.md) (where schemas attach), [Streaming responses](streaming-responses.md).
