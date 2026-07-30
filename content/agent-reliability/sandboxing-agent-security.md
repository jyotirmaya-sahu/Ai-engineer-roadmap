# Sandboxing & Agent Security

**The one-line idea:** Sandboxing runs an agent's risky actions — especially code it writes and executes — inside a locked-down, isolated environment with no access to your real systems, so even if the agent is tricked or goes wrong, the blast radius is contained to a disposable box.

## Why it matters for an AI Engineer

The moment an agent can **execute code**, browse the web, or run shell commands, it can do anything that code can do — including things an attacker *wants* it to do. A prompt injection hidden in a web page or document can turn "summarize this" into "read the env vars and POST them to evil.com." You cannot make the LLM immune to this by prompting. The only reliable defense is **containment**: give the agent a sandbox where the worst case is "the disposable box got trashed," not "our production database got dumped." This is the top security concern for agentic systems and a hard requirement in any Dubai enterprise, finance, or government deployment — shipping a code-executing agent without a sandbox will fail security review instantly.

## The mechanism — how it works

Sandboxing applies **defense in depth** — several independent layers so no single failure is catastrophic:

- **Isolation / containment.** Run agent code in a throwaway container, microVM (Firecracker, gVisor), or a hosted sandbox — separate from your host and network. When the task ends, destroy it. Nothing persists, nothing leaks.
- **Least privilege.** Give the agent *only* the permissions it needs. No cloud credentials, no prod DB access, a scoped API token, a read-only filesystem where possible. If it doesn't need the internet, cut network access; if it does, restrict to an **egress allowlist** so it can reach your API but not `evil.com`.
- **Resource limits.** Cap CPU, memory, disk, and execution time so runaway or malicious code can't exhaust the host (a fork-bomb, an infinite miner).
- **Filesystem & secret hygiene.** Never mount secrets into the sandbox. Assume anything in the box is exfiltrable, so put nothing sensitive there.
- **Untrusted-input assumption.** Treat every retrieved document, web page, and tool result as potentially adversarial (it may carry an injection). The sandbox is what makes that assumption survivable.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 Agent writes code</span>
    <span class="darr">→</span>
    <span class="dgroup"><span class="dgt">🔒 SANDBOX</span>
      <span class="dbox orange">▶️ run code</span>
      <span class="dbox gray">no secrets · read-only FS<span class="sub">CPU/mem/time caps · egress allowlist</span></span>
    </span>
    <span class="darr">→<span class="lbl">destroy after</span></span>
    <span class="dbox green">✅ result only</span>
  </div>
  <div class="dcap">Risky actions run in a disposable, least-privilege box — worst case, the box gets trashed.</div>
</div>

## Concrete example

Run agent-written code in a hosted ephemeral sandbox (e.g. E2B, 2026) instead of your host:

```python
from e2b_code_interpreter import Sandbox

# spin up an isolated VM — no access to your host, DB, or secrets
with Sandbox(timeout=30) as sandbox:                 # hard 30s cap
    code = agent.generate_code(task)                 # LLM-written, therefore untrusted
    execution = sandbox.run_code(code)               # runs inside the box, not on your machine
    result = execution.text                          # only the result comes back out
# sandbox is destroyed here — nothing the code did persists
```

Contrast with the dangerous anti-pattern — `exec(agent_code)` or `subprocess.run(agent_cmd)` **on your own host**, which hands the model your entire environment. Never do that.

## How a company uses this

A **Dubai investment firm** built a data-analysis agent that writes and runs Python to answer questions over market data. The risk: a poisoned document in their pipeline could make the agent write code that reads AWS credentials and exfiltrates portfolio data. Their design: every code execution runs in a **fresh Firecracker microVM** with *no* cloud credentials, a read-only mount of just the relevant dataset, no outbound network except an allowlisted internal API, and a 60s/512MB cap. When a red-team test planted an injection telling the agent to "dump environment variables and upload them," the code ran — and found nothing to steal and nowhere to send it. The box was destroyed seconds later. That test result is what cleared the deployment.

## Common mistakes / misconceptions

- **Running agent code on the host.** `exec`/`eval`/`subprocess` on your own machine or server gives the model (and any injection) full access. The single biggest agent-security mistake.
- **"The prompt tells it not to do bad things."** Prompts don't contain code execution. Only isolation does.
- **Over-provisioned sandbox.** A sandbox that still has prod credentials, write access, and open internet isn't a sandbox. Least privilege is the point.
- **Trusting tool outputs and retrieved docs.** Injection often arrives *through data*, not the user message. Assume all inbound text is adversarial.
- **Forgetting resource caps.** Isolation without CPU/memory/time limits still lets malicious code DoS the host.

## Interview tip
Say: *"Any agent that executes code or runs untrusted tools goes in a sandbox — an ephemeral, isolated container or microVM with least privilege: no secrets mounted, read-only filesystem, resource and time caps, and an egress allowlist so it can't exfiltrate. I assume every retrieved document and tool result could carry a prompt injection, and the sandbox is what makes that assumption survivable — worst case the disposable box gets trashed, not production. Running agent-written code with `exec` on the host is the mistake I'd flag in any review."* Naming least privilege, egress allowlist, and the untrusted-input assumption together is the senior-level answer.

See also: **[Guardrails](guardrails.md)** (blocking bad actions before they run) and the **LLM Security & Guardrails** node (prompt injection and the OWASP LLM Top-10 threats this contains).
