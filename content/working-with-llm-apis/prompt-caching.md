# Prompt Caching

**The one-line idea:** prompt caching reuses computation for an identical, stable prompt prefix, reducing repeated prefill cost and latency.

## Why it matters for an AI Engineer

Many applications send the same long system instructions, tool schemas, policy documents, or reference corpus on every request. The model normally performs the expensive prefill calculation again. Caching lets a provider reuse that prefix while processing only the changing suffix.

## How it works

<div class="diagram">
  <div class="flow">
    <span class="dbox green">Stable prefix<span class="sub">policy · tools · examples</span></span>
    <span class="darr">+</span>
    <span class="dbox orange">Changing suffix<span class="sub">user message</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">Cache hit<span class="sub">reuse prefix prefill</span></span>
  </div>
</div>

Cache matching is prefix-based. Put static content first and volatile content last. A timestamp, random request ID, changing tool order, or personalized sentence near the beginning shifts every following token and destroys the match.

```python
from anthropic import Anthropic

client = Anthropic()
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=500,
    system=[{
        "type": "text",
        "text": open("company_policy.txt").read(),
        "cache_control": {"type": "ephemeral"},
    }],
    messages=[{"role": "user", "content": "Can this expense be reimbursed?"}],
)

print(response.usage)  # inspect cache creation/read token fields
```

Provider behavior differs: some platforms cache eligible prefixes automatically, while others expose cache breakpoints or retention controls. Minimum prefix length, lifetime, pricing, residency, and zero-data-retention compatibility can also differ. Treat caching as a provider capability and verify it in current documentation and usage metadata.

Measure:

- cache-hit ratio;
- cached-read versus cache-write tokens;
- time to first token;
- cost per successful request;
- invalidations caused by prompt releases.

## How a company uses this

An enterprise support assistant sends a 30,000-token policy and tool definition prefix with every conversation. Keeping that block byte-for-byte stable and appending the user-specific context after it can substantially reduce repeated prefill work. The team versions the prefix deliberately and watches hit rate after each deployment.

## Common mistakes

- Calling semantic response caching “prompt caching.” Response caches reuse an answer; prompt caches reuse model computation.
- Putting dynamic dates or user IDs at the start.
- Assuming a hit without inspecting usage.
- Caching sensitive data without checking retention and residency terms.
- Expecting output tokens or retrieval latency to become cheaper.

## Interview tip

Say: *“Prompt caching is exact stable-prefix reuse. I order content static-to-dynamic, keep tool ordering deterministic, version the prefix intentionally, and validate cache reads and TTFT in telemetry. It complements—but does not replace—semantic response caching.”*

