# The M×N Integration Problem

**What it is:** the combinatorial explosion of custom glue code you get when every AI app has to be wired by hand to every tool — the exact pain MCP was invented to kill.

## Why it matters for an AI Engineer

This is the "why does MCP exist" question, and interviewers ask it because it separates people who *use* MCP from people who understand the *problem class* it solves. If you can frame integration as an M×N-vs-M+N cost curve, you can also reason about API gateways, driver interfaces, and any standardization decision. It's a systems-thinking signal, not a trivia one.

## The mechanism / how it works

Say your company runs **M** AI applications — a Claude Desktop assistant, a customer-support bot, an internal Cursor/Claude Code setup. Each needs to reach **N** tools — GitHub, Postgres, Slack, your CRM, a ticketing system.

Before any standard, each app talks to each tool in that tool's own dialect. The support bot needs GitHub-specific code; Cursor needs its *own* GitHub-specific code; both need separate Postgres code. Every (app, tool) pair is a bespoke integration you write, test, and maintain.

The number of integrations is **M × N**. With 4 apps and 6 tools that's **24** hand-written connectors. Add one new tool and you write it 4 more times — once per app. Add one new app and you re-implement all 6 tools. The cost grows *multiplicatively*, and worse, each connector is duplicated logic that drifts out of sync.

MCP breaks the pairing. Each tool exposes **one** MCP server. Each app is **one** MCP client. Every client speaks the same protocol to every server, so the count collapses to **M + N** — the servers plus the clients, added, not multiplied.

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">Without a standard — M×N</span>
    <div class="flow">
      <span class="dbox green">🤖 4 apps</span>
      <span class="darr">✗ each wires each</span>
      <span class="dbox gray">🗄️ 6 tools</span>
      <span class="darr">=</span>
      <span class="dbox orange">24 connectors</span>
    </div>
  </div>
  <div class="dgroup">
    <span class="dgt">With MCP — M+N</span>
    <div class="flow">
      <span class="dbox green">🤖 4 clients</span>
      <span class="darr">→</span>
      <span class="dbox purple wide">🔌 one protocol</span>
      <span class="darr">→</span>
      <span class="dbox blue">🗄️ 6 servers</span>
      <span class="darr">=</span>
      <span class="dbox green">10 pieces</span>
    </div>
  </div>
  <div class="dcap">24 bespoke connectors collapse to 10 reusable pieces — and each new tool is written once.</div>
</div>

## Worked numbers

The multiplicative curve bites fast:

| Apps (M) | Tools (N) | M×N (before) | M+N (MCP) |
|---|---|---|---|
| 3 | 5 | 15 | 8 |
| 5 | 10 | 50 | 15 |
| 10 | 20 | 200 | 30 |

At 10 apps × 20 tools you'd maintain **200** integrations vs **30** MCP components — and adding tool #21 costs *one* server, not ten.

## How a company uses this

A Dubai fintech had three AI surfaces — a customer chatbot, an internal ops assistant, and developers on Claude Code — each independently coding against the same core-banking API, the same KYC service, and the same ticketing system. Nine connectors, three teams, three sets of bugs, three security reviews. They rebuilt each backend as **one** authenticated MCP server. Now shipping a new "fraud-lookup" tool means writing one server; all three surfaces gain it the same afternoon with no client changes. The maintenance headcount for integrations dropped from roughly a full engineer to a fraction of one.

## Common mistakes

- **Thinking it's about convenience, not cost curve.** The point isn't "MCP is nicer" — it's that hand-wiring scales *multiplicatively* and standardizing scales *additively*.
- **Confusing it with function calling.** Function calling is how *one* model calls *one* tool. M×N is the org-wide duplication problem across many apps and tools — see [MCP vs plain function calling](mcp-vs-plain-function-calling.md).
- **Assuming N is small forever.** Tool count grows relentlessly in real companies; the multiplicative term is the one that hurts.

## Interview tip

Draw it: "M apps, N tools, M×N custom connectors — MCP makes each tool one server and each app one client, so it's M+N." Then land the punchline: *"The win isn't ergonomics, it's turning a multiplicative maintenance cost into an additive one — a new tool is written once, not once per app."* That framing is what an [open standard](open-standard.md) buys you.
