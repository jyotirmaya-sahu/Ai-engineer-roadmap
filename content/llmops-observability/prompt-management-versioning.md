# Prompt management & versioning

**What it is:** treating your prompts as *versioned, deployable artifacts* — stored, labeled, and swappable at runtime — instead of string literals buried in your code.

## Why it matters for an AI Engineer

In an LLM app the prompt *is* the program. A one-word tweak can swing quality, cost, and safety more than a code change. Yet teams routinely hardcode prompts as strings, edit them live, and have no idea which version produced last Tuesday's answers. That's untenable: when quality drops you can't tell what changed, you can't roll back, and every prompt edit needs an engineer and a redeploy. Prompt management fixes all of that — it's the knob you turn when [drift detection](/llmops-observability/drift-detection) or [feedback](/llmops-observability/feedback-loops) says something's wrong, and being able to roll back in seconds is what turned the fintech incident in this node's overview into a 5-minute fix. It's also what lets a *non-engineer* (a domain expert) safely iterate on prompts. High-value, and a clear "have you run this in prod?" interview signal.

## The mechanism — how it works

Move the prompt out of code and into a **prompt registry** (Langfuse Prompts, or a config store / git). Each prompt gets:

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">📝 prompt "support-answer"</span>
    <span class="darr">↓</span>
    <div class="dstack">
      <span class="dbox gray">v1 — original</span>
      <span class="dbox gray">v2 — added "cite the source"</span>
      <span class="dbox orange">v3 — shorter, cheaper &nbsp;🏷️ <b>staging</b></span>
      <span class="dbox green">v2 &nbsp;🏷️ <b>production</b> ← app fetches this label</span>
    </div>
    <span class="darr">↓<span class="lbl">bad release?</span></span>
    <span class="dbox green">re-point "production" → v1 &nbsp;(instant rollback, no deploy)</span>
  </div>
  <div class="dcap">Prompts are versioned artifacts; the app fetches by label, so promoting/rolling back is a pointer move, not a redeploy.</div>
</div>

The key ideas:
- **Versioning** — every save is an immutable version, like git commits. You can diff v2 vs v3 and see exactly what changed.
- **Labels/aliases** — a moving pointer like `production` or `staging` points at a specific version. Your code fetches `get_prompt("support-answer", label="production")` — it never hardcodes a version. Promoting = re-pointing the label.
- **Decoupled from deploys** — changing which version is live is a config change, not a code release. Rollback is instant.
- **Linked to traces** — each trace records *which prompt version* produced it, so quality metrics are attributable per version (did v3 actually lower cost without hurting faithfulness?).
- **Caching** — the SDK caches the fetched prompt so you don't add a network hop per request.

This turns prompt iteration into a safe, measurable, non-engineer-friendly workflow.

## Concrete example

```python
from langfuse import get_client
lf = get_client()

# App fetches the version currently labeled "production" — cached, no per-call latency
p = lf.get_prompt("support-answer", label="production")
messages = p.compile(question=q, context=ctx)   # fill {{question}}/{{context}} placeholders

resp = openai.chat.completions.create(model="gpt-4o-mini", messages=messages)
# link the trace to this exact prompt version → per-version quality metrics
lf.update_current_generation(prompt=p)

# To ship a new prompt: create v4 in the UI, test on staging label,
# then move the "production" label to v4. No code change, no redeploy.
# Bad? Move "production" back to v3. Instant rollback.
```

## How a company uses this

A Dubai telco's support assistant lets the *support-operations team* (not engineers) edit the answer prompt in Langfuse. They A/B two versions by pointing `production` at v5 for 50% of traffic and v6 for the other 50%, then compare per-version faithfulness and cost from the linked traces — v6 was 15% cheaper with equal quality, so they promoted it fully. Later a v7 that "improved tone" quietly raised the refusal rate; because every trace tagged its version, they saw v7 was the culprit and **rolled back in under a minute by moving one label** — no engineer, no deploy, no incident. That auditability (which version said what, when) also matters for the telco's compliance reviews.

## Common mistakes
- **Prompts hardcoded as strings in code** — every change is a deploy, and you can't correlate a version with its quality.
- **Editing the live prompt with no version history** — quality drops and you can't tell what changed or roll back.
- **Not linking the version to traces** — then your A/B or quality comparison has no way to attribute results to a version.
- **No staging label** — testing a new prompt straight on 100% of production is how you cause the incident you were trying to prevent.

## Interview tip
Say: *"I treat prompts as versioned artifacts in a registry like Langfuse, not string literals. The app fetches by a moving label like `production`, so promoting or rolling back a prompt is a pointer change, not a redeploy — instant rollback when quality drops. Every trace records its prompt version, so I get per-version quality and cost, can A/B safely, and even let domain experts iterate without touching code."* This is the *action* end of the loop that [drift detection](/llmops-observability/drift-detection) and [feedback](/llmops-observability/feedback-loops) trigger.
