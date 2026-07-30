# Sandboxing & least privilege

**What it is:** the two containment principles that keep a compromised LLM from doing real damage — **least privilege** (every tool gets the minimum access it needs) and **sandboxing** (any model-generated code runs in an isolated environment that can't touch your real systems).

## Why it matters for an AI Engineer

Every other guardrail can be bypassed — [prompt injection](prompt-injection.md) has no perfect fix. So the mature security stance is: *assume the model will occasionally be tricked, and make sure it can't reach anything valuable when it is.* Sandboxing and least privilege are the last line — the one that turns "catastrophe" into "annoyance." This is the answer that impresses senior interviewers, because it shows you design for the failure case, not just the happy path. In Dubai's finance and government roles, "even a fully-compromised agent can't exfiltrate data or move money" is frequently the sentence a security review is looking for.

## The mechanism

**Least privilege** means scoping *access*, not behavior:

- Each tool runs under its **own** narrow credential, not one shared admin account.
- Database roles are **read-only** unless writing is essential; scoped to the rows the user owns.
- Tools are scoped to the **authenticated user** (the balance tool reads *this* session's account, ignoring any model-supplied ID).
- API keys and service accounts carry the **minimum scopes** the task needs.

**Sandboxing** means isolating *execution*:

- Model-generated code runs in a **disposable container / microVM** (gVisor, Firecracker, or a hosted code-interpreter sandbox), never on your host or app process.
- The sandbox has **no network** (or an allowlist only), **no host filesystem**, tight **CPU/memory/time limits**, and is **destroyed after each run**.
- Outbound calls the agent makes go through an **egress allowlist** so it can't reach internal services (blocking SSRF).

<div class="diagram">
  <div class="flow v">
    <span class="dbox orange">⚠️ compromised agent tries to `rm -rf` / exfiltrate</span>
    <span class="darr">↓</span>
    <span class="dgroup"><span class="dgt">SANDBOX (disposable, no network, no host FS)</span>
      <span class="dbox purple">💻 code runs here</span>
    </span>
    <span class="darr">↓<span class="lbl">contained</span></span>
    <span class="dbox green">✅ blast radius = one throwaway container</span>
  </div>
  <div class="dcap">Even a fully hijacked agent can only harm the disposable sandbox, not your systems.</div>
</div>

The two combine as **defense in depth**: least privilege shrinks what each tool *can* do; sandboxing contains what executed code *can reach*. Guardrails try to stop the attack; these limit the damage when they don't.

## Concrete example

Running model-generated code in an isolated, network-less, time-limited container instead of on the host:

```python
import docker
client = docker.from_env()

def run_untrusted(code: str) -> str:
    try:
        return client.containers.run(
            image="python:3.12-slim",
            command=["python", "-c", code],
            network_disabled=True,        # no network → no exfiltration / SSRF
            mem_limit="256m",             # cap memory
            pids_limit=64,
            read_only=True,               # read-only root filesystem
            remove=True,                  # destroy container after run
            stderr=True,
            # in production also: seccomp/gVisor runtime, CPU quota, wall-clock timeout
        ).decode()
    except docker.errors.ContainerError as e:
        return f"error: {e}"

print(run_untrusted("print(2**10)"))                 # 1024
print(run_untrusted("import os; os.system('rm -rf /')"))  # harmless: throwaway, read-only, no host
```

The dangerous command runs, but only against a disposable, read-only, network-less container — it can't touch your host, your data, or the internet. For serverless options, hosted sandboxes (E2B, Modal, code-interpreter APIs) give the same isolation without managing Docker.

## How a company uses this

**A Dubai fintech's** analytics agent lets internal users ask questions that the agent answers by *writing and running Python* over reporting data. The obvious risk: generated code could read secrets, hit internal APIs, or delete files. Their design assumes the code is hostile: it executes in a per-request Firecracker microVM with no network, no host mount, a 10-second wall-clock limit, and only a read-only copy of the relevant dataset injected in — destroyed after every run. Separately, the agent's DB access uses a read-only role scoped to the user's business unit (least privilege), so even the *data-fetching* path can't write or cross tenants. When a red-team exercise fed it an injection telling it to exfiltrate the customer table, the code ran — and reached nothing, because there was no network and no write access. That's the whole point: the containment held even though the injection "succeeded."

## Common mistakes

- **Running model code with `eval`/`exec` in your app process.** One line of hostile code owns your server. Always isolate.
- **A shared powerful service account** across all tools instead of per-tool scoped credentials.
- **Sandbox with network access**, which re-opens exfiltration and SSRF — disable or allowlist egress.
- **Trusting model-supplied identifiers** (account/user IDs) instead of the authenticated session.
- **Treating guardrails as sufficient.** They reduce; sandboxing/least-privilege *contain*. You need both.

## Interview tip
Say: *"I assume guardrails will sometimes fail, so I contain the blast radius. Least privilege: every tool gets its own minimal credential, DB roles are read-only and scoped to the user, tools use the authenticated session not model-supplied IDs. Sandboxing: any generated code runs in a disposable, network-less, resource-capped container that's destroyed after each run. The goal is that even a fully-compromised agent can't reach anything valuable."* Leading with 'assume compromise, limit blast radius' is the senior-engineer framing interviewers are listening for.
