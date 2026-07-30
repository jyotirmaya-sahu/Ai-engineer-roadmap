# Authoring Guide — read before writing any article

Audience: a learner targeting an **AI Engineer role in Dubai** (interview-ready Aug 2026,
~1yr career gap, strong motivation). One Markdown article per topic/tile.

## Quality bar (strict — non-negotiable)
- **Teach the topic FULLY. NEVER delegate.** No "read the docs", "explore further", no
  unexplained jargon, no "here's a list to go learn". The article IS the complete lesson.
- Plain language for a smart beginner. Short sentences. Analogy first, then real mechanism.
- **Every article includes, in order:**
  1. `# <Title>`
  2. one-line **what it is** hook
  3. **why it matters for an AI Engineer** (tie to real LLM app behavior: cost, quality, limits, jobs)
  4. **the mechanism / how it works** — the actual teaching, thorough
  5. a **concrete example** — runnable code where it helps (correct, 2026-current APIs), or small worked numbers
  6. **how a company uses this** — real-world, AI/enterprise/Dubai where natural
  7. **common mistakes / misconceptions**
  8. **interview tip**
- ~500–900 words each. Accurate as of 2026. Code must actually run.

## Diagrams — use CUSTOM HTML, NEVER mermaid
Mermaid does not render in this app. When a diagram helps, hand-write HTML with ONLY these
classes (they exist in globals.css):

- `<div class="diagram"> … </div>` — outer wrapper (always).
- `<div class="flow"> … </div>` — horizontal line of boxes+arrows. Add `v` → `<div class="flow v">` for vertical.
- `<span class="dbox"> … </span>` — a node. Colors: `dbox blue|green|purple|orange|yellow|gray`. Add `wide` for wider. Subtitle inside: `Text<span class="sub">subtitle</span>`.
- `<span class="darr">→</span>` — arrow (use `↓` vertical). Optional label: `→<span class="lbl">note</span>`.
- `<div class="dgroup"><span class="dgt">TITLE</span> …flows… </div>` — labeled dashed container (for phases/subgraphs).
- `<div class="dstack"> …dboxes… </div>` — tight vertical stack (layers, token sequence).
- `<div class="dcap">caption</div>` — one-line italic caption (add to every diagram).
- Emojis encouraged in boxes (📄 🗄️ 🤖 ✅ 🔢 🧠 🔍).
- Color convention: input=gray, model/compute=purple, storage/data=blue, intermediate=orange, output/success=green/yellow.

### Diagram example (renders correctly — match this)
```
<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Input</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Process</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Output</span>
  </div>
  <div class="dcap">One-line explanation of the flow.</div>
</div>
```

## Production lens (required)
Concepts alone are not enough — the job is running these at company scale. Every tile's
"how a company uses this" section must touch real production behavior where relevant: scale
(millions of docs / high QPS), latency (ms budgets), cost ($ at scale), debugging, and
failure modes. Use concrete numbers, not hand-waving. Major domains (RAG, Agents, LLM apps)
also get a dedicated **"X in Production"** node covering scale/latency/cost/debugging/HA in depth.

## Location
Write each file to an ABSOLUTE path under `/Users/jyotirmayasahu/Desktop/side-projects/ai-roadmap/content/<node-slug>/<tile-slug>.md`.
Never search for the project; never touch any `bts-quest` repo. Slug = lowercase, non-alphanumerics→hyphens.
