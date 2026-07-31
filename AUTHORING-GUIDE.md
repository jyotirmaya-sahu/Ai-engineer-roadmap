# Authoring Guide — read before writing any article

Audience: a learner targeting an **AI Engineer role in Dubai** (interview-ready Aug 2026,
~1yr career gap, strong motivation). One Markdown article per topic/tile.

## The mindset (read first — this governs everything below)
**Write as a teacher teaching a from-scratch student who has never heard of the topic.**
Assume zero prior knowledge of THIS topic. Your job is that the student *fully grasps* it by
the end — not that you "covered" it.
- **Never introduce a term you haven't already defined.** The moment a new word appears
  (weight, bias, endpoint, embedding…), define it right there in plain words before using it.
  No forward-references to concepts a later tile teaches, except a one-line "later tile covers X".
- **Build in order, one idea at a time.** Like teaching programming: variables → types →
  functions, never jump ahead. Each concept rests only on things already explained. End sections
  with a one-line bridge to the next ("you now have X — next, why we need Y").
- **Ground every abstraction immediately.** If you say "a model is a set of numbers," show the
  literal `list`/array in code in the same breath. No claim left as a floating abstraction.
- **Prefer a worked, concrete example over a definition.** Show the smallest real thing (code
  with real numbers, or a hand-traced calculation) and let the definition fall out of it.
- **If a beginner would ask "but why?" or "what is that?", answer it inline** — don't leave the
  obvious next question hanging. (e.g. "why multiply?", "why 2 numbers?", "how does it check itself?")

## Connective tissue — it's ONE journey, not isolated nodes
The whole roadmap is a single continuous story, and the **capstone app "HelpDesk"** is the spine
running through it. Every node/tile should feel connected to what came before and after — a stream,
not disconnected topics.
- **Open with a bridge** from the previous node/phase: "You just built/learned X — now Y." A short
  blockquote callout at the top works well (see `content/sampling-generation.md`).
- **Tie the "how a company uses this" back to HelpDesk** wherever natural — show how *this* concept
  changes the app the learner is actually building, not a random unrelated company.
- **Close with a forward bridge** to the next node ("…then the next node adds Z").
- Reference sibling concepts by link so the graph feels woven, not siloed.

## Quality bar (strict — non-negotiable)
- **Teach the topic FULLY. NEVER delegate.** No "read the docs", "explore further", no
  unexplained jargon, no "here's a list to go learn". The article IS the complete lesson.
- Plain language for a smart beginner. Short sentences. Analogy first, then real mechanism.
- When a node is a big/foundational area, give it a **base/primer tile first** that establishes
  vocabulary and the "why" before the deep-dive tiles (see ml-foundations "What is machine
  learning?" and working-with-llm-apis "SDK setup & call pattern" as models).
- **Every article includes, in order:**
  1. `# <Title>`
  2. one-line **what it is** hook
  3. **why it matters for an AI Engineer** (tie to real LLM app behavior: cost, quality, limits, jobs)
  4. **the mechanism / how it works** — the actual teaching, thorough
  5. a **concrete example** — runnable code where it helps (correct, 2026-current APIs), or small worked numbers
  6. **how a company uses this** — real-world, AI/enterprise/Dubai where natural
  7. **common mistakes / misconceptions**
  8. **interview tip**
- ~500–900 words each (hands-on tiles may run longer). Accurate as of 2026. Code must actually run.
- **Hands-on / coding tiles end with a "Practice — assignments" section:** 6–10 plain
  "Write a program that…" tasks, ordered so each builds on the last. State the task and the
  expected behavior only — NO filenames, function signatures, or step-by-step hints (the learner
  writes the code themselves and will push it to a repo). "Programming" = writing and running code.

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
- **NEVER put a blank line inside a `<div class="diagram">…</div>` block.** A blank line makes the
  markdown parser close the raw-HTML block and render the rest as a *code block* (you'll see the raw
  `<div>` tags). Keep the whole diagram as contiguous lines. Also keep diagrams reasonably flat —
  giant deeply-nested diagrams are fragile; prefer two smaller diagrams over one huge one.
- **For TRUE flowcharts** (decision diamonds, Yes/No branches, non-linear paths) the box classes
  read badly — use **inline `<svg>`** instead (rehype-raw renders it; no sanitizer). Rounded `<rect>`
  nodes, a `<polygon>` diamond for decisions, `<line>`/`<path>` edges with an arrowhead `<marker>`,
  edge labels as `<text>`. Wrap in `<div style="max-width:…;margin:… auto;">` and use a `viewBox`
  with `width="100%"` so it scales. Keep the SVG contiguous (same blank-line rule). See
  `content/build-the-capstone-app/v6-auth-per-user-history.md` for a working model.

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
