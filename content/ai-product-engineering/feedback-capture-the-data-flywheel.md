# Feedback capture & the data flywheel

**What it is:** instrumenting your product to record how users react to AI outputs — thumbs, edits, retries, corrections — and feeding that signal back to make the model better, so the product improves the more it's used.

## Why it matters for an AI Engineer

A static AI feature decays: the world shifts, new edge cases appear, competitors iterate. A feature *with a feedback loop* compounds — every user interaction becomes fuel to improve prompts, retrieval, and eventually a fine-tuned model. This is the **data flywheel**: more users → more feedback → better model → happier users → more users. It's the durable moat behind products like GitHub Copilot and every serious LLM product. For an AI engineer it's also the cheapest source of the two things you most need: a real **evaluation set** (so you can measure changes — see [Success metrics](success-metrics-before-building.md)) and **training data** (for fine-tuning later). Companies specifically hire engineers who know how to build this loop, because it's the difference between a demo and a product that gets better on its own.

## The mechanism: signal → dataset → improvement

There are two kinds of feedback, and the second is far more valuable:

- **Explicit feedback** — the user deliberately rates: 👍/👎, star ratings, "report this answer." Clean signal, but sparse (most users never click).
- **Implicit feedback** — behavior that reveals satisfaction *without the user rating anything*: Did they copy the answer? Edit the AI's draft heavily (bad) or accept it as-is (good)? Retry the query (bad)? Abandon (bad)? Click the cited source (engaged)? Implicit signal is abundant because it's a byproduct of normal use.

The loop has four stages:
1. **Capture** — log input, output, model version, and the feedback signal, tied together with an ID.
2. **Curate** — turn raw logs into a labeled dataset. Thumbs-down cases become your *failure set*; heavily-edited drafts show the correct answer (the user's final version is the label).
3. **Improve** — use that dataset three ways, cheapest first: (a) add failures to your **eval set** to catch regressions, (b) refine prompts/retrieval against those failures, (c) once you have enough clean pairs, **fine-tune**.
4. **Redeploy & measure** — ship the improvement, watch the metric, repeat.

The subtle craft is designing the UX so capturing feedback is *frictionless* and *automatic* — the human corrections from your [human-in-the-loop](human-in-the-loop-ux.md) flow are the highest-quality label you'll ever get, for free.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 AI output</span>
    <span class="darr">→</span>
    <span class="dbox gray">🧑 User reacts<span class="sub">👍👎 / edits / retries</span></span>
    <span class="darr">→<span class="lbl">log</span></span>
    <span class="dbox blue">🗄️ Dataset<span class="sub">eval + fine-tune</span></span>
    <span class="darr">→<span class="lbl">improve</span></span>
    <span class="dbox green">✅ Better model</span>
  </div>
  <div class="dcap">The flywheel: usage produces feedback, feedback produces a dataset, the dataset produces a better model — which drives more usage.</div>
</div>

## Concrete example

Capturing both explicit and implicit signal on an AI draft-reply feature:

```python
import time, uuid

def serve_draft(user_id, prompt):
    draft_id = str(uuid.uuid4())
    draft = llm_draft(prompt)
    log_event("draft_shown", draft_id=draft_id, prompt=prompt,
              output=draft, model="gpt-x-2026", ts=time.time())
    return draft_id, draft

def on_user_send(draft_id, original_draft, final_sent_text):
    # implicit signal: how much did the human change the AI's draft?
    edit_ratio = levenshtein(original_draft, final_sent_text) / max(len(original_draft), 1)
    log_event("draft_result", draft_id=draft_id,
              accepted_as_is=edit_ratio < 0.05,   # near-zero edits = good
              final_text=final_sent_text,          # the human-corrected LABEL
              edit_ratio=edit_ratio)

# nightly: build datasets from logs
# - edit_ratio > 0.4  -> failure cases -> add to eval set + prompt review
# - accepted_as_is    -> confirmed-good pairs -> fine-tune candidates
```

`final_text` is the gold label — the answer the human actually wanted — captured with zero extra user effort. That's the flywheel turning.

## How a company uses this

A Dubai HR-tech platform shipped an AI that drafts job descriptions. They logged every draft plus the recruiter's final edited version. Analyzing edit patterns showed recruiters *always* rewrote the salary/benefits section — the model's guesses there were consistently off. That insight fed two fixes: a prompt change (pull benefits from structured company data instead of generating them) and an eval set built from the worst-edited drafts. Over a quarter, the average edit ratio fell from ~35% to ~12%, meaning recruiters spent far less time fixing drafts. Eventually they had enough clean draft→final pairs to fine-tune a smaller, cheaper model that matched the big one on their task — cutting inference cost while *improving* fit, purely from feedback they were already collecting.

## Common mistakes
- **No logging** — you can't improve what you didn't record. Log input, output, model version, and outcome from day one.
- **Relying only on explicit 👍/👎** — <5% of users click; mine implicit signals (edits, retries, copies, abandons).
- **Collecting feedback but never using it** — a dashboard nobody acts on isn't a flywheel.
- **Ignoring privacy** — logging user data (especially in the UAE/GDPR-adjacent contexts) needs consent, PII handling, and retention limits. Anonymize.

## Interview tip
Say: *"I instrument feedback from day one — explicit ratings plus implicit signals like edit distance, retries, and acceptance. Thumbs-down and heavily-edited cases become my eval set to catch regressions; confirmed-good pairs become fine-tuning data. That's the data flywheel: the product improves the more it's used, and human corrections give me high-quality labels for free."* Framing feedback as *both* an eval source and a fine-tuning source shows you understand how real AI products compound over time.
