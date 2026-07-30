# GitHub

**What it is:** GitHub is a website that hosts your Git repositories in the cloud, so you can back up code, share it, collaborate, and show it to the world.

## Why it matters for an AI Engineer

Git lives on your laptop. GitHub puts it online. That unlocks three things you cannot live without: a backup if your machine dies, a way for teammates to pull and push the same code, and a public portfolio recruiters actually look at. When you apply for an AI Engineer role in Dubai, your GitHub profile is often the first thing a hiring manager opens. A few real, well-documented AI projects there beat a paragraph of claims on a CV.

GitHub also runs your automated tests (Actions), hosts your project's docs, and is where pull requests and code review happen. It is the center of gravity for modern development.

## Remotes: connecting local Git to GitHub

A **remote** is the GitHub-hosted copy of your repo. The default remote name is `origin`.

```bash
# Clone an existing GitHub repo to your machine
git clone https://github.com/you/rag-chatbot.git
cd rag-chatbot

# See your remotes
git remote -v
```

To connect a brand-new local repo to a fresh empty GitHub repo:

```bash
git remote add origin https://github.com/you/rag-chatbot.git
git push -u origin main
```

## The clone / push / pull cycle

```bash
git clone <url>     # download a repo the first time
git pull            # fetch and merge the latest changes from GitHub
git push            # send your commits up to GitHub
```

The habit: `git pull` before you start work (get the team's latest), `git push` when your commits are ready to share. Pull often to avoid drifting out of sync.

Modern GitHub uses tokens or SSH, not passwords. The easiest setup is the GitHub CLI:

```bash
gh auth login       # walk through browser login once, done
```

## README — your project's front door

Every repo needs a `README.md` at the root. It is the first thing anyone sees. A good README has:

- One line on what the project does.
- How to install and run it (exact commands).
- A short example of it working.
- Maybe a screenshot or sample output.

```markdown
# RAG Chatbot
Answers questions over your PDFs using retrieval + GPT.

## Run
​```bash
pip install -r requirements.txt
python app.py
​```
```

For a job hunt, the README is where you sell the project. No README = looks abandoned.

## GitHub Actions — automation in the cloud

**Actions** runs commands automatically when things happen — on every push or pull request. Most common use: run your tests. You add a YAML file under `.github/workflows/`:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: pytest
```

Now every push runs your tests on GitHub's servers and shows a green check or red X. This is CI, and it makes your project look professional.

## A real company example

A Dubai health-tech startup keeps its LLM symptom-checker on GitHub. New engineers clone the repo and are running locally in minutes thanks to a clear README. Every pull request triggers a GitHub Actions workflow that runs the evaluation suite and posts the accuracy score right on the PR. The team never merges code that drops accuracy, because the robot check catches it first. Their whole collaboration — code, review, testing, docs — lives in one GitHub repo.

## Common mistakes and gotchas

- **No README.** Recruiters skip repos that do not explain themselves. Always write one.
- **Committing secrets.** A leaked API key on public GitHub gets scraped by bots in minutes. Use `.gitignore` for `.env` and rotate any key that slips out.
- **A graveyard of half-finished repos.** Three polished projects beat twenty empty ones. Curate.
- **Forgetting to pull.** You push and get rejected because the remote moved ahead. `git pull` first.
- **Making everything private.** For a portfolio, your best projects should be public so employers can see them.

## Interview / practical tip

Have two or three public repos that are genuinely runnable, each with a clean README and green CI badge. In an interview, share the link and walk through one. Being able to say "here is my RAG project, the README shows how to run it, and Actions runs the eval suite on every push" demonstrates real engineering habits — far more convincing than describing a project you cannot show.
