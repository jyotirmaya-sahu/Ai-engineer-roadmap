# Build-a-Node instructions (for author subagents)

You are given ONE node name. Produce its full content: a node overview + one deep-dive
article per tile. Follow this exactly.

## Steps
1. READ `/Users/jyotirmayasahu/Desktop/side-projects/ai-roadmap/AUTHORING-GUIDE.md` (quality
   bar, required sections, the PRODUCTION LENS, and the custom-HTML diagram vocabulary — NEVER mermaid).
2. READ `/Users/jyotirmayasahu/Desktop/side-projects/ai-roadmap/content/chunking.md` — the model for a NODE OVERVIEW.
3. READ `/Users/jyotirmayasahu/Desktop/side-projects/ai-roadmap/lib/roadmap.ts`, find YOUR node object
   (match the `node:` name you were given), and read its `groups` → `tiles`. Each tile's display
   text is either the string or the `t` field. That list IS your set of tile articles.

## Slug rule (MUST match exactly, or links break)
`slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")`
- Node slug = slugify(node name). Tile slug = slugify(tile text).
- Example: "Vector vs keyword vs SQL vs graph — when to use which" → `vector-vs-keyword-vs-sql-vs-graph-when-to-use-which`.

## Files to write (ABSOLUTE paths under the project)
- Overview: `/Users/jyotirmayasahu/Desktop/side-projects/ai-roadmap/content/<node-slug>.md`
- Each tile: `/Users/jyotirmayasahu/Desktop/side-projects/ai-roadmap/content/<node-slug>/<tile-slug>.md`
Create the `<node-slug>/` directory. Never write anywhere else. Ignore any `bts-quest` repo.

## The overview article (content/<node-slug>.md)
Model it on chunking.md: `# <Node Name>` → one-line idea → **why we even need it** →
one custom-HTML diagram → why it matters for an AI Engineer → a **table mapping every tile**
with "when to reach for each" → a real-world Dubai/enterprise example → interview tip →
end with `*Below: deep-dive articles on each ___.*`

## Each tile article (content/<node-slug>/<tile-slug>.md)
Full 8-section structure from the guide: `# <Tile Title>` → what-it-is hook → why it matters
for an AI Engineer → mechanism (teach it FULLY, no delegation) → concrete runnable 2026-current
code or worked numbers → **how a company uses this** (with the production lens: real scale/latency/
cost/failure numbers where relevant) → common mistakes → interview tip. ~500–900 words.
Add a custom-HTML diagram where it clarifies. Cross-reference sibling tiles by relative path.

## Finish
Write the overview + EVERY tile (skip none). Then confirm: files written, and `grep` shows no
```mermaid anywhere in what you wrote.
