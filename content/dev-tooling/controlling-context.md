# Claude Code: Controlling Context

**What it is:** Context is everything Claude Code currently "knows" in a session — the files it has read, your instructions, and the conversation so far. Controlling it means deciding what to put in and what to leave out.

## Why it matters for an AI Engineer

An AI model has a **context window** — a limited amount of text it can hold at once. Fill it with junk and results get worse, slower, and more expensive. Give it the right files and clear instructions and it nails the task. Managing context well is the single biggest factor in getting good output from any AI tool. As an AI Engineer you will manage context in your own LLM apps too (that is what RAG is), so building the instinct here pays off twice.

## The context window, plainly

Think of context as Claude's short-term memory for this session. It is big but not infinite. Everything counts against it: the files read, your messages, Claude's replies, command output. When it gets crowded with old, irrelevant stuff, Claude can lose the thread — mixing up files or forgetting your earlier instruction.

The fix is not "one long endless session." It is deliberate context: keep what is relevant, drop what is not.

## /clear — reset between tasks

When you finish one task and start an unrelated one, clear the context:

```
/clear
```

This wipes the conversation and starts fresh. Do it when you switch from, say, "fix the auth bug" to "write the deployment docs." Carrying the auth conversation into the docs task just clutters Claude's memory and can confuse it.

Rule of thumb: **new task, new context.** A fresh `/clear` often fixes a session that has started giving muddled answers.

## Being precise about files

The more exactly you point Claude at the right files, the better it does. Vague requests make Claude read half the repo hunting for the target, wasting context.

```
# Vague — Claude has to guess and read widely
> fix the caching

# Precise — Claude goes straight there
> in src/llm.py, the cache in call_model() never expires — add a 1-hour TTL
```

Name the file. Name the function. State the exact change. Precision saves context and gets the right result the first time.

## Managing what is in context

- Mention specific files by path so Claude reads only those.
- Do not ask Claude to read giant files it does not need — that eats the window.
- Start a fresh session for a fresh problem instead of piling onto a long one.
- If a session gets sluggish or confused, `/clear` and re-state the task cleanly.

## CLAUDE.md — permanent project memory

A file named `CLAUDE.md` at your project root is read automatically at the start of every session. It is where you put facts Claude should always know about this project, so you do not repeat them every time.

```markdown
# CLAUDE.md

## What this is
A RAG chatbot over insurance PDFs. FastAPI backend, Postgres + pgvector.

## Rules
- Never commit .env — secrets live there.
- Run `pytest` before every commit.
- Use the existing `get_client()` helper for LLM calls; do not create new clients.
- Embeddings model is text-embedding-3-small. Do not change it without asking.
```

Now every session already knows your stack, your conventions, and your do-nots — without wasting context re-explaining. This is the highest-leverage file in your repo for working with Claude Code.

## A real company example

A Dubai insurance-AI team keeps a detailed `CLAUDE.md` in their repo: the tech stack, the "never touch the embeddings model" rule, and "always use the shared LLM client." New engineers — and Claude — instantly follow the team's conventions. During work, engineers `/clear` between unrelated tickets and always name the exact file to change. The result: consistent, on-convention edits with far less back-and-forth. The team treats context hygiene as a core skill, not an afterthought.

## Common mistakes and gotchas

- **One endless mega-session.** Old, irrelevant context degrades answers. `/clear` between tasks.
- **Vague requests.** "Fix the bug" makes Claude read the whole repo. Name the file and the change.
- **No CLAUDE.md.** You re-explain the project every session and Claude keeps breaking conventions.
- **Dumping huge irrelevant files into context.** Only include what the task needs.
- **Assuming Claude remembers across `/clear` or new sessions.** It does not — except what is in CLAUDE.md.

## Interview / practical tip

If asked how you get good results from AI tools, talk about context management: precise, file-scoped requests, clearing context between tasks, and a project memory file for conventions. Then connect it: "the same principle drives RAG — feed the model only the relevant context, not everything." That link shows you understand *why* context matters, not just how to click buttons.
