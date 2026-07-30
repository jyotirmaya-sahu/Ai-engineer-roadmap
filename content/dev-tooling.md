# Dev Tooling

**The one-line idea:** Dev tooling is the everyday kit an AI engineer uses to actually *ship* — version control, GitHub, the terminal, an AI coding agent, and safe handling of secrets — the boring machinery that turns "code that works on my laptop" into "code a team can run in production."

## Why we even need it

Here's the line that separates a notebook tinkerer from an engineer: **can someone else run your work, and can you change it next month without breaking it?**

A model in a Jupyter notebook is a science experiment. It lives on one machine, in one head, with API keys pasted right into cell 3. The moment you need a teammate, a second environment, a code review, or a deploy, that setup collapses. Dev tooling is the difference. It's not glamorous and it's not AI — but interviews and real jobs assume you have it cold, and lacking it is the fastest way to look junior.

The good news: it's a small, learnable set of tools that every professional developer uses every single day. Learn them once and they pay off forever.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">💻 you + CLI</span>
      <span class="darr">→</span>
      <span class="dbox purple">🤖 Claude Code</span>
      <span class="darr">→</span>
      <span class="dbox orange">🌿 git branch</span>
    </div>
    <div class="flow">
      <span class="dbox orange">🌿 branch</span>
      <span class="darr">→<span class="lbl">push</span></span>
      <span class="dbox blue">🐙 GitHub PR</span>
      <span class="darr">→<span class="lbl">review + merge</span></span>
      <span class="dbox green">🚀 shipped</span>
    </div>
  </div>
  <div class="dcap">Terminal → AI agent → version control → GitHub review → production. Secrets stay in .env, never in the code.</div>
</div>

## The pieces you'll learn (and when to reach for each)

| Tile | What it is | Why it matters |
|---|---|---|
| **Git basics** | Track and save versions of your code | undo mistakes, see history, never lose work |
| **Branches** | Isolated copies to work on a change | build a feature without breaking `main` |
| **Pull requests** | Propose + review changes before merge | how teams check each other's work |
| **GitHub** | Cloud home for repos, PRs, issues, CI | where the code and collaboration live |
| **Claude Code** | Terminal AI agent that edits your codebase | your daily pair-programmer and force multiplier |
| **CLI** | The command line / terminal | the native environment of every real dev tool |
| **Env vars & .env** | Config kept outside your code | swap settings per machine without editing code |
| **Secrets management** | Safe storage of API keys and passwords | keep credentials out of Git and out of leaks |

These fall into three natural groups: **version control** (Git, branches, PRs, GitHub) for tracking and collaborating on code; **your working environment** (CLI, Claude Code) for actually doing the work; and **configuration & safety** (env vars, secrets) so credentials never leak.

## Claude Code deserves its own paragraph

Claude Code isn't just autocomplete — it's an agent that reads your repo, edits files, runs commands, and iterates. Getting good at it is now a genuine AI-engineering skill, and its sub-topics reflect that: **daily workflows** (how to actually drive it through real tasks), **controlling context** (feeding it the right files, not the whole repo, so it stays accurate and cheap), **hooks & SDK** (automating steps and building it into your own tools), and **MCP integration** (connecting it to external systems — databases, APIs, docs — so it can act beyond the codebase). Used well, one engineer with Claude Code ships what used to take a small team.

## The one rule you must never break: secrets

The single most common junior mistake — and an instant interview red flag — is committing an API key to Git. Once a secret is in Git history, it's *permanently* there and must be rotated. That's why **env vars, `.env` files, and secrets management** aren't optional side-topics: keys live in a `.env` file that Git ignores, and your code reads them from the environment. Learn this pattern before you write a single line that touches an API.

## Real world: how a company uses this

> A small **Dubai AI startup** hires an engineer who's brilliant at models but pastes the OpenAI key straight into the source and works only in notebooks. Day one, a teammate can't reproduce the work; day three, the key leaks in a public repo and racks up a bill. Contrast the engineer who **branches for every change, opens a PR for review, keeps keys in `.env` + a secrets manager, and drives Claude Code with tight context** — they onboard in an afternoon and ship safely. Same modeling skill; wildly different value to the team.

## Interview tip
Say: *"I treat every change as a branch → PR → review → merge, never committing straight to main. Secrets live in `.env` and a secrets manager — never in code or Git history — and if one leaks I rotate it immediately. I work from the terminal and lean on Claude Code, but I control its context deliberately and use MCP to connect it to our real systems. Basically: reproducible, reviewable, and secure by default."* That answer alone reads as 'this person has shipped on a team.'

---

*Below: deep-dive articles on each dev tool.*
