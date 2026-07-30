# Code execution

**What it is:** a tool that lets the LLM *write and run code* — usually Python in a sandbox — so it can compute exact answers instead of guessing them in its head.

## Why it matters for an AI Engineer

LLMs are famously bad at arithmetic and precise logic — they *predict* text, they don't *calculate*. Ask one to multiply two big numbers, sort 500 rows, or compute a compound-interest schedule and it'll often be confidently wrong. Code execution fixes this by offloading the exact work to a real interpreter: the model writes a few lines of Python, the sandbox runs them, and the *actual result* comes back. This is the backbone of "data analyst" agents, charting, financial math, and any task where being *approximately right* isn't good enough. In 2026 it's also how coding agents test their own work. Knowing when — and how safely — to give a model a code sandbox is a core AI Engineer judgment call.

## The mechanism — how it works and why the sandbox matters

Code execution is just [function calling](function-calling.md) where the tool is "run this code." The loop:

1. The model decides the task needs computation and emits code (e.g. Python) as the tool argument.
2. **Your executor runs that code — inside a sandbox.** This is the whole game. The model is writing *arbitrary code*; if you `exec()` it in your own process, a bad or malicious snippet can read your files, hit your network, or wipe data. So you run it in an isolated environment: a container, a microVM, or a hosted sandbox, with **no network**, a **CPU/time limit**, a **memory cap**, and an ephemeral filesystem that's thrown away after.
3. **You capture stdout, the return value, and any error** and feed them back.
4. The model reads the result. If the code errored, it can *fix and re-run* — a self-correction loop that makes code-execution agents surprisingly robust.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🧮 "Compound interest on 50k AED, 4%, 10y?"</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🤖 writes Python</span>
    <span class="darr">↓<span class="lbl">run in sandbox: no net, timeout, mem cap</span></span>
    <span class="dbox orange">📦 Sandbox executes → 74012.21</span>
    <span class="darr">↓<span class="lbl">stdout/error back</span></span>
    <span class="dbox green">✅ exact answer (or model fixes error & retries)</span>
  </div>
  <div class="dcap">The model writes code; an ISOLATED sandbox runs it. Isolation is non-negotiable — it's arbitrary code.</div>
</div>

## Concrete example (runnable, 2026-current)

Most providers now offer a hosted sandbox so you don't build isolation yourself. Conceptually:

```python
from openai import OpenAI
client = OpenAI()

# The built-in code-interpreter / sandbox tool: the model writes AND runs Python
# in a provider-managed isolated container. You just enable it.
resp = client.responses.create(
    model="gpt-5.4",
    tools=[{"type": "code_interpreter"}],   # hosted, sandboxed Python
    input="A client invests 50000 AED at 4% annual interest compounded yearly "
          "for 10 years. What's the final amount? Show the calculation.",
)
print(resp.output_text)
# The model writes:  50000 * (1.04 ** 10)  -> runs it -> 74012.21, then explains it.
```

If you host your own executor instead, the rule is the same: run the model's code in a locked-down container (no network, `timeout`, memory limit, ephemeral disk), capture stdout/error, feed it back. **Never** `exec()` model output in your app process.

## How a company uses this — production lens

> **A Dubai investment firm** built a portfolio-analysis assistant. Analysts upload a CSV of holdings and ask "what's my currency exposure and the Sharpe ratio?" The agent writes pandas/numpy code, runs it in a **hosted sandbox with no internet access** (the holdings data must never leave), and returns exact figures plus a chart. Production numbers that mattered: they set a **30-second execution cap** (a bad `while` loop once pinned CPU), a **512MB memory limit** (a giant merge OOM'd the container), and **network fully disabled** for data-leak safety and compliance. Each run costs a bit more than a plain LLM call because of the sandbox compute, but the alternative — the model *guessing* a Sharpe ratio — is unacceptable for finance. The self-fix loop also helped: ~1 in 6 first attempts threw an error, and the model corrected them without human help.

## Common mistakes

- **Running model code in your own process.** `exec()` on LLM output is a remote-code-execution hole. Always isolate.
- **No time or memory limits.** Model writes an infinite loop or a memory bomb and hangs/crashes the host. Cap both.
- **Leaving the network on.** A sandbox with internet can exfiltrate data or fetch malware. Disable it unless truly needed.
- **Using it for everything.** Code execution is slower and costlier than a plain answer. Reach for it only when exactness or data-processing demands it.
- **Not feeding errors back.** The self-correction loop is the superpower — return the traceback so the model can fix and retry.

## Interview tip
Say: *"Code execution offloads exact computation to a real interpreter, so the model stops guessing at math. The critical detail is isolation — it's arbitrary model-written code, so it runs in a sandbox with no network, a timeout, and a memory cap, never in my app process. Feeding errors back lets the model self-correct."* Naming the security boundary *unprompted* is what signals seniority. Related: this is the same round-trip as [function calling](function-calling.md), just with code as the argument.
