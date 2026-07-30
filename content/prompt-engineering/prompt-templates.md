# Prompt templates

**What it is:** A prompt template is a reusable prompt with named placeholders — `"Summarize {document} for a {audience}"` — that your code fills in at runtime, instead of building prompt strings by hand each time.

## Why it matters for an AI Engineer
In a real app you don't write a fresh prompt per request — you have *one* well-crafted prompt with slots for the variable bits (the user's question, retrieved context, the customer's name). Templates turn prompts into **reusable, testable code artifacts**: one place to edit, consistent structure on every call, and a clean seam between your stable instructions and dynamic data. This is table stakes for production — an AI Engineer who concatenates strings inline produces prompts that are inconsistent, un-versionable, and injection-prone. Templates are the foundation that [versioning](./versioning.md) and [A/B testing](./experiment-tracking-a-b.md) build on.

## The mechanism
A template separates the **fixed skeleton** (instructions, structure, [delimiters](./delimiters.md), format rules) from the **variable slots** (data that changes per request). At call time you *render* the template by substituting values into the slots. Key practices:

- **Keep the stable part stable.** The instruction skeleton doesn't change per request, which also makes it [cacheable](../context-engineering/prompt-kv-caching.md) — put dynamic slots *after* the stable prefix.
- **Fence the variables.** Wrap injected values in [delimiters](./delimiters.md) so user/retrieved data can't blur into instructions — templating and injection defense go together.
- **Escape or validate inputs.** A naive f-string lets a `}` or a stray delimiter in user data break the template; use a real templating layer and treat slot values as untrusted.
- **Store templates as named, standalone objects** (files or a registry), not inline literals — so they can be reviewed, diffed, and swapped.

You can do this with plain Python `.format()`/f-strings for simple cases, or purpose-built tools — LangChain's `PromptTemplate`, Jinja2, or a lightweight prompt registry — when you need partials, conditionals, or loops (e.g. rendering a variable number of few-shot examples or retrieved chunks).

## Concrete example
A reusable RAG-answer template, rendered per request:

```python
from openai import OpenAI
client = OpenAI()

RAG_TEMPLATE = """You are a support assistant. Answer ONLY from the CONTEXT.
If the answer isn't there, say "I don't know." Cite sources like [1].

<context>
{context}
</context>

Question: {question}"""

def answer(question, context):
    prompt = RAG_TEMPLATE.format(context=context, question=question)  # render
    r = client.chat.completions.create(
        model="gpt-4o", temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )
    return r.choices[0].message.content

ctx = "[1] Returns accepted within 14 days.\n[2] Delivery is 1-2 days in Dubai."
print(answer("How long do I have to return an item?", ctx))
# -> "You have 14 days to return an item [1]."
```

Every call goes through the *same* vetted structure — grounding rule, citation format, fenced context — with only the slots changing. Change the rule once in `RAG_TEMPLATE` and every call updates.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧩 Template<span class="sub">fixed skeleton + {slots}</span></span>
    <span class="darr">→<span class="lbl">fill slots</span></span>
    <span class="dbox orange">📝 Rendered prompt</span>
    <span class="darr">→</span>
    <span class="dbox green">🧠 LLM call</span>
  </div>
  <div class="dcap">One vetted skeleton, dynamic data injected into named slots at runtime.</div>
</div>

## How a company uses this
A Dubai SaaS company runs ~30 LLM features (summaries, replies, extractions, classifications) across its product. Each is a named template in a central prompt registry with typed slots and a documented output schema. Benefits they cite: a single place to fix a bug (edit the template, every caller inherits it), consistent [delimiters](./delimiters.md)/grounding across all features (safety by construction), and — because templates are discrete objects — they can [version](./versioning.md) and [A/B test](./experiment-tracking-a-b.md) each one. They also enforce that all slot values pass through an escaping+validation layer, which closed an injection hole where a user's name field once contained a fake `</context>` tag. Templating is what made 30 features maintainable instead of 30 piles of ad-hoc strings.

## Common mistakes
- **Inline string concatenation everywhere.** Inconsistent, un-versionable, hard to test. Centralize into named templates.
- **Unescaped slot values.** User data can break the template or inject delimiters — treat slots as untrusted, escape/validate them.
- **Dynamic data before the stable prefix.** Kills prompt caching; put variable slots after the fixed skeleton.
- **One giant template with tons of conditionals.** If it's branching heavily, split into separate templates (see [chaining](./prompt-chaining-decomposition.md)).
- **Templates buried in code, not reviewable.** Store them where they can be diffed and reviewed like any critical config.

## Interview tip
Say: *"I treat prompts as templated code — a fixed, cacheable skeleton with fenced, escaped slots for dynamic data, stored as named objects in a registry so they can be reviewed, versioned, and A/B tested. String-concatenating prompts inline is how you get inconsistent, un-testable, injection-prone prompts."* That shows you think of prompts as engineered artifacts, which is the whole Ops mindset.
