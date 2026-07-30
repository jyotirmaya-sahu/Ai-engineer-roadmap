# Versioning

**What it is:** Prompt versioning is tracking every change to your prompts — like source-controlling code — so you know exactly which prompt version is running, can compare versions, and can roll back a bad one instantly.

## Why it matters for an AI Engineer
Prompts are production logic. A one-word change can swing accuracy, cost, tone, or safety across millions of requests. If prompts live as untracked strings that people edit by hand, you get the classic nightmares: "it worked yesterday and no one knows what changed," a silent regression you can't diagnose, and no way to roll back. Versioning makes prompts *observable and reversible*. For an AI Engineer it's the discipline that turns prompt engineering from tinkering into operable software — and it's what makes [A/B testing](./experiment-tracking-a-b.md) and debugging even possible.

## The mechanism
Versioning means every prompt has an **identity and history**: a name, a version number/hash, and a record of what changed, when, by whom, and why. Two levels:

- **Baseline: prompts in Git.** Store [templates](./prompt-templates.md) as files in your repo. Every change is a commit — diffable, reviewable via pull request, tied to the code release. Free, and enough for many teams. The rule: **no editing the live prompt by hand; changes go through the same review as code.**
- **Prompt management platforms** (LangSmith, PromptLayer, Langfuse, Humanloop, etc.). These add prompt-specific superpowers: version a prompt *independently* of a code deploy (so non-engineers can iterate), link each version to its eval/A-B results, tag which version is `production` vs `staging`, and roll back with a click. Useful when prompts change faster than code or when PMs/domain experts own them.

Two things make versioning actually pay off:

1. **Log the version with every request.** Store the prompt version ID alongside each LLM call's inputs/outputs. Now when quality drops, you can see *exactly* which version produced the bad outputs and correlate a regression to a specific change.
2. **Instant rollback.** Because versions are immutable and named, reverting is selecting the previous version — not scrambling to remember what the prompt used to say.

## Concrete example
A minimal version-aware prompt loader that stamps every call with its version:

```python
import hashlib, logging
from openai import OpenAI
client = OpenAI()

PROMPTS = {
    "support_reply": {
        "version": "v3",
        "text": "You are a support agent. Answer only from CONTEXT; cite sources [n]. "
                "If unknown, say 'I don't know.'",
    },
}

def call(prompt_name, user_msg):
    p = PROMPTS[prompt_name]
    ver = p["version"]
    phash = hashlib.sha256(p["text"].encode()).hexdigest()[:8]
    r = client.chat.completions.create(
        model="gpt-4o", temperature=0,
        messages=[{"role": "system", "content": p["text"]},
                  {"role": "user", "content": user_msg}],
    )
    out = r.choices[0].message.content
    logging.info("prompt=%s version=%s hash=%s", prompt_name, ver, phash)  # trace it
    return out
```

Every log line carries the prompt name, version, and content hash — so any bad output is traceable to the exact prompt that made it, and the hash catches "someone edited the text but forgot to bump the version."

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">v1</span>
    <span class="darr">→</span>
    <span class="dbox blue">v2</span>
    <span class="darr">→</span>
    <span class="dbox green">v3 (production)</span>
    <span class="darr">↩<span class="lbl">rollback</span></span>
    <span class="dbox orange">v2 (if v3 regresses)</span>
  </div>
  <div class="dcap">Named, immutable versions — every request tagged, any regression reversible in one step.</div>
</div>

## How a company uses this
A Dubai bank treats its assistant's system prompt as regulated production config. Every change is a pull request with a required eval run (the ~500-pair suite from [avoiding hallucination](./avoiding-hallucination.md)) attached, reviewed and approved before merge; the live prompt version ID is logged with every customer conversation. When a change once nudged the hallucination rate up, they saw it in the version-tagged metrics within hours, correlated it to the exact prompt version, and rolled back in minutes instead of days — no guessing what had changed. Versioning is precisely what turned "a scary black-box prompt" into an auditable, reversible, compliance-friendly asset.

## Common mistakes
- **Editing the live prompt by hand.** Untracked changes = silent regressions no one can explain. Route every change through review.
- **Not logging the version per request.** Without it you can't tie a bad output to the prompt that caused it — versioning loses most of its value.
- **Bumping text without bumping the version (or vice versa).** Use a content hash to catch drift between "the label" and "the actual text."
- **No rollback plan.** Versions are only useful if reverting is trivial; make previous versions immutable and instantly selectable.
- **Over-tooling too early.** Git is a fine start; adopt a prompt platform when prompts genuinely change faster than code or non-engineers own them.

## Interview tip
Say: *"I version prompts like code — named, immutable versions in Git or a prompt platform, changes via review with an eval attached, the version ID logged on every request, and one-click rollback. That makes prompts observable and reversible, so a regression is traceable to an exact version and fixed in minutes, not guessed at for days."* Emphasizing *log the version per request* and *rollback* signals you've actually operated this in production.
