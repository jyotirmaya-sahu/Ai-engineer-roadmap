# Fallback chains

**The one-line idea:** Line up backups so that if plan A fails, you automatically try plan B, then plan C — a primary model, then an alternate provider, then a cheaper model, then finally a canned safe response — so the user always gets *something* instead of an error.

## Why it matters for an AI Engineer

Providers go down. Rate limits hit. A model refuses or returns garbage. If your app has exactly one path and that path fails, the user sees a 500. A fallback chain means a single point of failure becomes a *degraded but working* experience: maybe a slightly less capable model answers, or a cached response, or a graceful "I can't do that right now, here's what I can do." This is what turns "99% uptime" into "99.9% uptime" without buying more infrastructure — you're just refusing to let any one dependency be fatal. For an LLM app specifically, multi-provider fallback is now standard practice, and interviewers expect you to describe it.

## The mechanism — how it works

A fallback chain is an ordered list of options, tried in sequence until one succeeds:

1. **Order by quality-then-cost.** Primary = your best/preferred model. Next = an *independent* alternate (different provider/region — so a shared outage doesn't take out both). Then = cheaper/faster model. Last = a **static safe answer** or cached result that never fails.
2. **Independence is the whole point.** A fallback that shares the primary's failure mode is useless — GPT-4o → GPT-4o-mini both die if OpenAI is down. Real resilience is GPT-4o → **Bedrock Claude** (different vendor) → a rule-based response.
3. **Trigger on the right signals.** Fall through on: circuit-breaker open, timeout, 5xx/429 after retries, *or* a quality gate (empty output, failed validation, refusal). Don't fall through on user errors (400).
4. **Degrade transparently.** When you drop to a lesser model, it's fine — but log it, monitor the fallback rate, and if the fallback changes behavior the user should feel (e.g. no tool use), handle it. The **last link must be guaranteed to succeed** (a static message), so the chain can never fully fail.

Modern **LLM gateways** (LiteLLM, or your own) implement this declaratively: define primary + fallbacks + retry + timeout in config, and every call is protected.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🥇 GPT-4o<span class="sub">primary</span></span>
    <span class="darr">→<span class="lbl">fail</span></span>
    <span class="dbox blue">🥈 Bedrock Claude<span class="sub">alt provider</span></span>
    <span class="darr">→<span class="lbl">fail</span></span>
    <span class="dbox orange">🥉 mini model<span class="sub">cheap/fast</span></span>
    <span class="darr">→<span class="lbl">fail</span></span>
    <span class="dbox green">🛟 safe canned reply<span class="sub">never fails</span></span>
  </div>
  <div class="dcap">Try each option in order until one works; the last link is a static response so the chain can't fully fail.</div>
</div>

## Concrete example

A hand-rolled chain (clear to reason about), then the LiteLLM one-liner:

```python
def generate(prompt: str) -> str:
    chain = [
        lambda: call_openai("gpt-4o", prompt),          # primary
        lambda: call_bedrock("anthropic.claude", prompt),  # independent provider
        lambda: call_openai("gpt-4o-mini", prompt),     # cheaper/faster
    ]
    for attempt in chain:
        try:
            out = attempt()
            if out and out.strip():        # quality gate: reject empty
                return out
        except Exception as e:
            log.warning("fallback: %s", e)
            continue
    return "Sorry, I can't answer right now — please try again shortly."  # guaranteed
```

```python
# LiteLLM: declarative fallbacks + timeout + retries in one call
from litellm import completion
resp = completion(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain a wire transfer fee."}],
    fallbacks=["bedrock/anthropic.claude-3-5-sonnet", "gpt-4o-mini"],
    timeout=4, num_retries=2,
)
```

## How a company uses this

A **Dubai insurance** company's policy-Q&A assistant must stay up during business hours no matter what. Their chain: **Azure OpenAI GPT-4o (UAE North)** → **Bedrock Claude (me-central-1)** → **GPT-4o-mini** → static "I'll connect you to an agent." During a real Azure OpenAI capacity event, the primary breaker opened and ~100% of traffic flowed to the Bedrock link for ~25 minutes; users got answers from Claude instead, slightly different in tone but correct, and **nobody filed a downtime ticket.** They monitor **fallback rate** as a health metric — normally <0.5%; the spike to 100% paged the on-call *and* auto-mitigated at the same time. Keeping the two primaries on *different vendors in different regions* is what made it work; an all-OpenAI chain would have failed together. Cost note: the mini/last links also cap spend during a partial degradation.

## Common mistakes / misconceptions

- **Fallbacks that share a failure mode.** GPT-4o → GPT-4o-mini both die in an OpenAI outage. Make at least one fallback a *different vendor/region*.
- **No guaranteed last link.** If every link can fail, the chain can still 500. End with a static response or cache that always returns.
- **Silent quality drops.** Falling to a weaker model is fine, but log it and monitor the fallback rate — a rising rate is an early outage signal.
- **Falling through on user errors.** A 400/validation error will fail on every link too; don't waste the whole chain on it.
- **No quality gate.** Only checking for exceptions misses "returned empty/garbage." Gate on output validity, not just success.

## Interview tip
Say: *"I define an ordered fallback chain — best model first, then an independent provider in a different region, then a cheap model, and a guaranteed static response as the last link so it can never fully fail. Independence is the key: an all-one-vendor chain dies together in an outage. I trigger fallback on breaker-open, timeouts, 5xx-after-retries, and a quality gate for empty/invalid output, and I monitor fallback rate as an early warning. A gateway like LiteLLM lets me declare all of this in config."* Emphasizing *independent* fallbacks and a *guaranteed last link* is the mature answer.

See also: **[Circuit breakers](circuit-breakers.md)** (the signal that routes traffic down the chain) and **[Graceful degradation under load](graceful-degradation-under-load.md)** (degrading by *feature* as well as by *model*).
