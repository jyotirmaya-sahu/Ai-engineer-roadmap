# Output-token control

**What it is:** Deliberately making the model's *reply* shorter — capping and shaping output — because output tokens are the most expensive meter on the bill, usually 3–5× the price of input.

## Why it matters for an AI Engineer

Look at any pricing table and output costs several times more than input: a model might be $3/MTok in and $15/MTok out. Yet output is the meter engineers control the least — they cap input obsessively and let the model ramble on for 800 tokens when 120 would do. A model that "thinks out loud," restates the question, adds caveats, and wraps up with a summary is burning your most expensive tokens on words nobody reads. Output is also the *latency* driver: generation is sequential (one token at a time), so a shorter reply is both cheaper *and* faster. For high-volume features, trimming average output length is one of the most direct cost cuts available.

## The mechanism / how it works

Several levers, use together:

- **`max_tokens` / `max_output_tokens`** — a hard cap so a runaway generation can't cost you 4,000 tokens. Set it to a realistic ceiling for the task; it's a safety belt, not a shaping tool (the model may just get truncated).
- **Instruct for brevity** — tell the model the format and length: *"Answer in one sentence."* / *"Return only the JSON, no prose."* / *"Max 3 bullet points."* This actually shapes output, not just truncates it.
- **Structured / constrained output** — ask for exactly the fields you need (JSON schema, an enum, a number). A classifier that returns `{"label":"refund"}` costs a handful of tokens; the same model left free might write a paragraph explaining its choice.
- **Suppress the preamble** — models love to restate the question and add "I hope this helps." A system instruction like *"Do not restate the question. No preamble or closing."* removes pure-waste tokens.
- **Manage reasoning tokens.** Reasoning models generate hidden "thinking" tokens that you **pay for as output**. Use low/medium reasoning effort for easy tasks and reserve high effort for genuinely hard ones — thinking budget is real budget.

The guiding idea: **specify the output contract.** Tell the model exactly what shape and length you want, and it stops filling space by default.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 model</span>
    <span class="darr">→</span>
    <span class="dbox gray">😑 rambling 700 tok<span class="sub">$0.021</span></span>
    <span class="darr">→<span class="lbl">contract output</span></span>
    <span class="dbox green">✅ tight 120 tok<span class="sub">$0.0036</span></span>
  </div>
  <div class="dcap">Output tokens cost ~3–5× input. Shape the reply and you cut the priciest meter directly.</div>
</div>

## Concrete example

```python
r = client.chat.completions.create(
    model="gpt-5-mini",
    max_tokens=60,                          # hard ceiling
    messages=[
        {"role": "system", "content":
         "Reply in one sentence. No preamble, no restating the question."},
        {"role": "user", "content": "Is my transfer to another UAE bank instant?"},
    ],
)
```

Worked numbers, a Q&A feature, 1M calls/month, output at $15/MTok:

- **Uncontrolled** (avg 650 output tokens): 650M × $15/MTok = **$9,750/month.**
- **Controlled** (avg 130 output tokens, same answers): 130M × $15/MTok = **$1,950/month.**
- **$7,800/month saved (80%)** — and every reply returns ~5× faster because there's less to generate.

For a classifier, the win is starker: forcing `{"label":"..."}` instead of an explained paragraph can drop output from ~200 tokens to ~8 — a 25× cut on the output meter.

## How a company uses this

A UAE bank's balance-and-transfers assistant originally let the model answer conversationally — friendly, but 500–800 tokens per reply, and output was the dominant cost line. The team added a system instruction capping answers to two sentences with no preamble, plus `max_tokens` as a guardrail. Output length dropped ~75%, cutting the bill sharply *and* improving perceived speed on mobile, where users disliked long walls of text anyway. Separately, when they adopted a reasoning model for dispute triage, they discovered hidden thinking tokens had quietly become 60% of that feature's cost; dialing reasoning effort down to "medium" for routine cases (high only for flagged disputes) halved it with no accuracy loss. The lesson: output is a *specified contract*, and reasoning effort is a *dial*, not a default.

## Common mistakes

- **Only capping input.** Teams obsess over prompt size and ignore output, the pricier meter. Shape both.
- **Relying on `max_tokens` alone.** It truncates mid-sentence rather than producing a shorter *complete* answer; pair it with brevity instructions.
- **Free-text where structure fits.** Letting a classifier or extractor answer in prose wastes output tokens and makes parsing harder — use JSON/enum output.
- **Ignoring reasoning tokens.** Assuming "thinking" is free; it's billed as output and can dominate. Right-size the reasoning effort.

## Interview tip
Say: *"Output tokens cost roughly 3–5× input and drive latency because generation is sequential, so I treat the response as a contract: cap it with max_tokens as a guardrail, instruct for brevity, use structured JSON/enum output for classification and extraction, and strip preamble. On reasoning models I right-size the thinking effort, because hidden reasoning tokens bill as output and can quietly become the majority of a feature's cost. Shaping output is often my most direct cost cut on high-volume features — and users prefer the shorter answers anyway."* It shows you optimize the meter most engineers forget.
