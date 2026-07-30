# Model routing

**What it is:** Sending each request to the *cheapest model that can handle it* — easy queries to a small/cheap model, hard ones to a frontier model — instead of paying frontier prices for everything.

## Why it matters for an AI Engineer

Most traffic is easy. If you send every request to GPT-class models, you massively overpay, because a large fraction could've been answered by a model that costs **10–30× less per token**. Routing is one of the biggest cost levers in production LLM apps — it can **cut a bill by half or more** while keeping quality where it matters. It also improves latency (small models are faster). Designing a router — and defending how you decide "easy vs hard" without wrecking quality — is a classic cost-optimization interview question.

## The mechanism / how it works

A router is a **decision made before the main call**: look at the request, estimate its difficulty, pick a model. The strategies, cheapest-to-build first:

- **Rule / heuristic routing:** simple signals — prompt length, task type, keywords, whether it's a known template. E.g. "classification → cheap model; open-ended reasoning → big model." Zero added latency, surprisingly effective as a baseline.
- **Classifier routing:** a tiny, fast model (or even a fine-tuned embedding classifier) predicts difficulty/category and routes accordingly. Adds a few ms.
- **LLM-as-router:** a cheap model reads the query and decides the tier. More flexible, but adds a call — use only if the savings justify it.
- **Cascade / escalation:** try the cheap model first, run a quick **quality check** (confidence, a validator, or an [eval](../evaluation/llm-as-judge.md)); if it fails, escalate to the big model. Maximizes cheap-model usage but the failed attempts add latency/cost, so it pays off only when the cheap model succeeds *often*.

The core trade-off is **cost saved vs quality risk from misroutes**. The safety discipline: measure quality *per tier*, and route conservatively on high-stakes queries (when unsure, send it up). A misrouted hard query to a weak model produces a confidently wrong answer — worse than the cost you saved.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ incoming request</span>
    <span class="darr">↓<span class="lbl">estimate difficulty</span></span>
    <div class="flow">
      <span class="dbox green">easy → 🐇 small model<span class="sub">cheap, fast</span></span>
      <span class="dbox orange">medium → mid model</span>
      <span class="dbox purple">hard → 🧠 frontier model<span class="sub">expensive</span></span>
    </div>
  </div>
  <div class="dcap">Match each query to the cheapest model that can answer it well — most traffic is easy.</div>
</div>

## Concrete example

A pragmatic heuristic router, extended by a cascade:

```python
def route(query, task):
    if task in ("classify", "extract", "short_faq"):
        return "gpt-4o-mini"           # cheap tier for structured/easy work
    if len(query) < 200 and "reasoning" not in task:
        return "gpt-4o-mini"
    return "gpt-4o"                    # reserve the frontier model for hard work

def answer(query, task):
    m = route(query, task)
    out = llm(m, query)
    if m == "gpt-4o-mini" and low_confidence(out):   # cascade: escalate on failure
        out = llm("gpt-4o", query)
    return out
```

Frameworks help: **[LiteLLM](litellm-gateway.md)** does routing/tier-fallback in config, and libraries like **RouteLLM** learn a router from preference data.

## How a company uses this

A SaaS support platform found ~70% of its tickets were simple ("where's my invoice?", "reset password") and only ~10% needed deep reasoning. They moved the easy majority to a small model (GPT-4o-mini class) and reserved the frontier model for the hard 10%, with a cascade to escalate low-confidence small-model answers. Result: **~55% lower LLM spend** at equal user-rated quality, plus faster median responses since most traffic now hit a snappier model. The number that governed the design was the **per-tier quality score** — they only widened the cheap tier as far as its eval stayed above threshold, and kept a conservative "route up when uncertain" rule for billing/legal-sensitive queries. Combined with a [semantic cache](prompt-semantic-cache.md) in front, cheap-tier routing plus cache hits handled the vast majority of traffic at a fraction of frontier cost.

## Common mistakes

- **Routing on cost alone, ignoring quality.** A cheap answer to a hard question is a costly wrong answer — measure quality per tier.
- **Over-engineering the router.** An LLM-as-router adds a call and latency; a rule or tiny classifier is often enough — start simple.
- **No escalation path.** Without a cascade/fallback, a misroute has no recovery — let low-confidence cheap answers escalate.
- **Not re-checking as models change.** Model prices and capabilities shift; re-tune tiers periodically.

## Interview tip
Say: *"Most traffic is easy, so I route: cheap/small model for classification and simple queries, frontier model only for genuinely hard reasoning — usually a heuristic or tiny classifier, sometimes a cascade that escalates low-confidence cheap answers. That routinely cuts cost 50%+ at equal quality and improves latency. The discipline is measuring quality per tier and routing up when uncertain, because a misrouted hard query gives a confidently wrong answer that's worse than the money saved. I stack it with a semantic cache in front."* Leading with "most traffic is easy" frames the whole answer correctly.
