# Routing

**What it is:** a first step that **classifies** the incoming request and sends it to the handler built for that category — like a hospital triage nurse who decides whether you go to X-ray, pharmacy, or the ER.

## Why it matters for an AI Engineer

Real inputs aren't uniform. A support inbox mixes password resets, refund disputes, and sales questions — each needs a different prompt, different tools, sometimes a different model. If you handle them all with one mega-prompt, it has to be a jack-of-all-trades: bloated, expensive, and mediocre at everything.

Routing lets you keep each handler **small and specialized** while still presenting one entry point to the user. It's also the biggest cost lever most teams overlook: route the easy 80% of traffic to a cheap fast model and reserve the expensive model for the hard 20%. For an AI Engineer, routing is where "make it good" and "make it cheap" stop fighting each other.

## The mechanism / how it works

A **router** — a cheap LLM call or a small classifier — reads the input and outputs a category label. Your code then dispatches to the matching handler. Each handler is its own mini-system (a prompt, maybe a [chain](prompt-chaining.md), its own tools).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">💬 Incoming request</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧭 Router: classify</span>
    <div class="flow">
      <span class="dbox blue">💳 Billing handler</span>
      <span class="dbox blue">🔧 Tech handler</span>
      <span class="dbox blue">🛍️ Sales handler</span>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Specialized answer</span>
  </div>
  <div class="dcap">One classifier fans out to specialized handlers; each stays small and focused.</div>
</div>

The critical design rule: the router does **one job — classify — and nothing else.** Keep its prompt tiny, its output constrained to a fixed set of labels (ideally via a JSON schema or enum), and its temperature at 0 for consistency. A vague router that "tries to also answer" is the fastest way to break the pattern. Always include a **fallback/default** route for inputs that match nothing, so unclassifiable requests don't crash or silently vanish.

Routing is cheap because the classifier call is short. That's what makes the cost trick work: a `gpt-4o-mini` router costs a fraction of a cent, then routes 80% of traffic to another mini-model and only sends genuinely hard cases to a frontier model.

## A concrete example

An LLM router that returns a constrained label, then dispatches to the right handler.

```python
from openai import OpenAI
client = OpenAI()

HANDLERS = {
    "billing": "You are a billing specialist. Be precise about amounts and dates.",
    "technical": "You are a senior support engineer. Give step-by-step fixes.",
    "sales": "You are a friendly sales rep. Highlight relevant plans.",
}

def route(message: str) -> str:
    r = client.chat.completions.create(
        model="gpt-4o-mini", temperature=0,
        messages=[{"role": "user", "content":
            f"Classify into exactly one of: billing, technical, sales.\n"
            f"Reply with only the word.\n\nMessage: {message}"}],
    )
    label = r.choices[0].message.content.strip().lower()
    return label if label in HANDLERS else "technical"   # fallback

def answer(message: str) -> str:
    system = HANDLERS[route(message)]
    r = client.chat.completions.create(
        model="gpt-4o", temperature=0.3,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": message}],
    )
    return r.choices[0].message.content

print(answer("I was charged twice this month, can you refund one?"))
```

The router constrains output to three labels and falls back to `technical` on anything weird — so the system never dispatches to an undefined handler.

## How a company uses this

A **Dubai bank's** WhatsApp assistant handles ~40,000 messages/day. A router classifies each into balance-check, card-dispute, or general-info. Balance checks (~55% of volume) route to a cheap model + a single API tool and answer in under a second; disputes route to a careful frontier-model handler with human-escalation built in. By keeping the frontier model off the majority of traffic, they cut LLM spend roughly 70% versus their original one-model-for-everything build, with *no* drop in dispute-handling quality — because that handler got *more* focused, not less.

## Common mistakes / misconceptions

- **A router that also answers.** Once the classifier starts drafting replies, it's no longer cheap or reliable. Classify only.
- **Open-ended labels.** Let the model invent category names and your dispatch code breaks. Constrain to a fixed enum and validate.
- **No fallback route.** Real traffic always includes weird inputs. Without a default, they error out or hit the wrong handler.
- **Too many categories.** Fine-grained routing (20 labels) misclassifies constantly. Start with 3–5 broad buckets; split only when data shows you need to.

## Interview tip
Say: *"Routing is a triage step — a cheap classifier that dispatches each input to a specialized handler. It keeps every handler small instead of one bloated do-everything prompt, and it's my main cost lever: route the easy majority to a small model and reserve the frontier model for hard cases. I constrain the router to a fixed label set with a default fallback, and it does nothing but classify."* That answer hits both quality and cost, which is exactly what interviewers want.
