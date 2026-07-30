# CI/CD

**What it is:** Continuous Integration / Continuous Delivery — automating the pipeline that takes a code (or prompt) change from a commit all the way to running in production, with checks at every gate so nothing ships untested.

## Why it matters for an AI Engineer

Deploying an LLM app by hand — SSH in, `git pull`, restart, hope — is how you ship the bug that costs you the weekend. CI/CD makes deploys **repeatable, tested, and reversible**. For AI apps it does something extra: it's where you insert the [automated eval gates](/llmops-observability/automated-eval-gates) that stop a quality regression from reaching users. "Deployment" appears in 82% of the Dubai JDs behind this roadmap, and CI/CD is the backbone of it — the difference between "I trained a model in a notebook" and "I ship a service other people depend on." Interviewers ask "walk me through how a change gets to production" precisely to see if you think in pipelines.

## The mechanism — how it works

**CI** (Continuous Integration): every push runs an automated pipeline — install deps, lint, run tests, build the container. If anything fails, the merge is blocked. It keeps `main` always-green so bugs are caught in minutes, not after release.

**CD** (Continuous Delivery/Deployment): once CI passes, the artifact is automatically deployed — to staging always, and to production either automatically or on one click.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📝 git push</span>
    <span class="darr">→</span>
    <span class="dbox blue">🧪 CI: lint · unit tests · build image</span>
    <span class="darr">→</span>
    <span class="dbox orange">🎯 eval gate<span class="sub">quality suite must pass</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🚀 deploy staging</span>
    <span class="darr">→<span class="lbl">canary</span></span>
    <span class="dbox green">✅ deploy prod</span>
  </div>
  <div class="dcap">A change flows through automated gates; an AI pipeline adds an eval gate that classic pipelines don't have.</div>
</div>

The pieces that matter for AI apps:
- **Containerize** ([Docker](/api-serving)) so "works on my machine" == "works in prod" — the same image runs everywhere.
- **The eval gate** — a stage that runs your quality suite and *fails the build* if faithfulness/accuracy drops below threshold. This is the LLM-specific step (its own [tile](/llmops-observability/automated-eval-gates)).
- **Progressive rollout** — deploy to a small % of traffic (canary) first, watch [monitoring](/llmops-observability/monitoring-logging) dashboards, then ramp to 100%. If metrics dip, auto-rollback.
- **Rollback** — every deploy is versioned so reverting is one command. (Prompt changes roll back even faster via [prompt versioning](/llmops-observability/prompt-management-versioning) — no rebuild needed.)

## Concrete example

```yaml
# .github/workflows/deploy.yml — GitHub Actions, 2026
name: deploy
on: { push: { branches: [main] } }
jobs:
  ship:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: ruff check . && pytest tests/ -q      # CI: lint + unit tests
      - run: python eval/run_suite.py --min-score 0.85   # EVAL GATE: fails job if quality drops
      - run: docker build -t app:${{ github.sha }} .     # reproducible artifact
      - run: ./deploy.sh app:${{ github.sha }} --canary 10   # 10% canary, ramp if healthy
```

If the eval suite scores below 0.85, the job exits non-zero and the deploy never happens — a bad prompt is stopped before any user sees it.

## How a company uses this

A Dubai logistics company's document-extraction AI ships via GitHub Actions. Every PR runs unit tests + an eval gate over 300 labeled invoices; a change that dropped extraction accuracy from 96% to 91% **failed CI and was never merged**. Production deploys go out as a **10% canary** watched against p95 latency and error rate for 15 minutes before ramping — one bad model bump auto-rolled-back when canary error rate crossed 2%, affecting a tenth of traffic for a quarter hour instead of everyone all day. Deploy frequency went from "scary monthly release" to several safe deploys a week, because the pipeline — not a nervous human — enforces the checks.

## Common mistakes
- **Manual deploys** — unrepeatable, unreviewable, and the source of "who changed prod?" mysteries.
- **CI with only lint/unit tests for an AI app** — those pass while the model quietly hallucinates. Add the [eval gate](/llmops-observability/automated-eval-gates).
- **Deploying to 100% at once** — no canary means a regression hits every user simultaneously.
- **No fast rollback path** — if reverting takes an hour, a bad deploy is an hour-long outage.

## Interview tip
Say: *"CI runs lint, unit tests, and — crucially for an LLM app — an eval gate that fails the build if quality drops. CD containerizes the artifact and rolls it out as a canary I watch on the monitoring dashboards before ramping to 100%, with one-command rollback. Prompt changes roll back even faster because they're versioned separately from the code."* This is the frame that ties [testing frameworks](/llmops-observability/testing-frameworks) and [eval gates](/llmops-observability/automated-eval-gates) together into a delivery story.
