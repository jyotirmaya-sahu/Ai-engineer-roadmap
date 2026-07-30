# Model routing / cascades

**What it is:** Sending each request to the *cheapest model that can handle it* — a small model for easy questions, a frontier model only for hard ones — instead of paying frontier prices for everything.

## Why it matters for an AI Engineer

Most traffic is easy. In a typical support or Q&A workload, 50–80% of requests are simple lookups, classifications, or rephrasings that a cheap model answers perfectly — yet teams route *everything* to a frontier model "to be safe." That's paying $10/MTok for work a $0.15/MTok model does just as well. Routing is often the single biggest cost lever after caching, because the price gap between model tiers is 10–50×. The engineer who can safely shift the easy majority to a cheap model — without the hard minority slipping through — captures most of that gap.

## The mechanism / how it works

Two patterns, often combined:

**Routing (decide up front).** A lightweight classifier looks at the request and picks a model *before* calling. The classifier can be:

- **Rules/heuristics** — short query, known intent (balance lookup) → cheap model; contains "dispute", "legal", long context → frontier. Free and fast.
- **A small LLM as router** — a cheap model reads the query and outputs `easy | hard`. Costs a few tokens, catches nuance rules miss.
- **A learned router** (e.g. RouteLLM-style) — trained on which queries each tier gets right.

**Cascade (escalate on failure).** Try the cheap model first; if its answer fails a quick check — low confidence, missing required fields, a validator/self-eval says "not sure" — *fall back* to the expensive model. You pay for the cheap call plus, occasionally, the expensive one. Cascades work when you can cheaply detect a bad cheap answer.

The trade-off you're managing is **cost vs. the risk of under-serving a hard query with a weak model.** You tune the routing threshold against your eval set: push more traffic to the cheap tier until quality on hard cases starts to drop, then back off. Route on the *decision*, not vibes — measure the quality of each tier per query type.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📥 request</span>
    <span class="darr">↓</span>
    <span class="dbox orange">🧭 router: easy or hard?</span>
    <div class="flow">
      <span class="dbox green">easy → 🪶 cheap model<span class="sub">$0.15/MTok</span></span>
      <span class="dbox purple">hard → 🧠 frontier<span class="sub">$10/MTok</span></span>
    </div>
  </div>
  <div class="dcap">Classify difficulty, then route to the cheapest model that clears the bar. Cascade = try cheap, escalate on failure.</div>
</div>

## Concrete example

```python
def route(query, context):
    hard_signals = ["dispute", "legal", "refund", "complaint"]
    if len(context) > 6000 or any(s in query.lower() for s in hard_signals):
        return "gpt-5"          # frontier
    return "gpt-5-nano"         # cheap

def answer(query, context):
    model = route(query, context)
    resp = chat(model, build(query, context))
    if model != "gpt-5" and low_confidence(resp):   # cascade: escalate uncertain
        resp = chat("gpt-5", build(query, context))
    return resp
```

Worked numbers, 1M requests/month, 70% easy / 30% hard, ~1,500 tokens each:

- **All frontier** ($10/$30): ~$18,000/month.
- **Routed** (70% at nano $0.05/$0.40, 30% frontier): ~$5,600/month.
- **~$12,400/month saved (~69%)**, with a cascade catching the few easy-but-actually-hard cases so quality holds.

## How a company uses this

A regional telco's billing assistant found that ~65% of queries were "what's my balance / when is my bill due" — pure lookups. They routed those to a small model and reserved the frontier model for disputes, plan changes, and anything long-context. Bill fell ~60%, and because they added a confidence-based cascade, the rare misclassified hard question still got escalated, so CSAT was unchanged. A different team built a **LiteLLM** gateway in front of all providers so routing, fallbacks, and per-model cost tracking lived in one place — and could shift traffic to a cheaper provider during a price change or an outage without touching app code. The operational lesson both learned: routing is only safe if you continuously eval each tier per query type, because model quality drifts as you change prompts and providers ship new versions.

## Common mistakes

- **Routing on vibes, not eval.** Assuming the cheap model "can't do X" without testing — or the reverse, over-trusting it on cases it fails.
- **No cascade safety net.** A pure up-front router with no escalation path silently under-serves the hard queries it misclassifies.
- **Router that costs more than it saves.** Using a frontier model *as* the router defeats the point; keep the router cheap or rule-based.
- **Set-and-forget.** Model versions and prompts change; a routing threshold tuned six months ago may now send hard queries to a model that regressed. Re-eval regularly.

## Interview tip
Say: *"Most traffic is easy, so I route it cheap-first: a rule or small-model router sends simple queries to a cheap model and reserves the frontier model for hard or long-context ones, with a confidence-based cascade to escalate the cheap model's uncertain answers. The price gap between tiers is 10–50×, so this is usually my biggest lever after caching. I tune the threshold against eval per query type and re-check it when models or prompts change, because that's where routing quietly breaks."* It shows you balance cost against under-serving risk with data.
