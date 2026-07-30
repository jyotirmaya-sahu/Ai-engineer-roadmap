# Prompt compression

**What it is:** Rewriting or algorithmically shrinking the text you send to the model so it carries the same meaning in fewer input tokens — cheaper and often faster, with no quality loss.

## Why it matters for an AI Engineer

Input tokens are the silent majority of cost in RAG and agent apps: a 300-token answer might ride on top of 8,000 tokens of prompt. Much of that prompt is padding — verbose instructions, repeated boilerplate, formatting fluff, retrieved passages full of filler. Compression targets that padding. Cutting a prompt from 8,000 to 4,000 tokens halves input cost on that call *and* leaves more room in the context window for the content that actually matters. It's one of the highest-leverage, lowest-risk levers you have, because you're removing waste, not signal.

## The mechanism / how it works

There are three levels, cheapest-to-fanciest:

**1. Manual prompt hygiene.** The biggest, free win. LLMs don't need polite prose. "You are a helpful assistant. Please carefully read the following and then, if you would, kindly provide..." becomes "Answer using only the context below." Strip repeated instructions, collapse examples to the minimum that still teaches the format, and cut restated rules. Prompts written by accretion are routinely 2–3× bigger than they need to be.

**2. Structural compression.** Represent data compactly. A verbose JSON blob or an HTML table costs far more tokens than the same facts as a terse markdown table or CSV. Strip HTML tags, drop null fields, abbreviate repeated keys. For retrieved documents, remove navigation, footers, and boilerplate before they ever hit the prompt.

**3. Learned/LLM-based compression.** For long context you can't hand-edit, use a compressor. **LLMLingua**-style methods score each token's importance with a small model and drop the low-information ones, often hitting 2–5× compression with minimal accuracy loss on downstream tasks. Or use a cheap model to *summarize* long context down to the essentials before the expensive model reasons over it — you pay a small cheap-model call to save a large frontier-model one.

The rule: compress the parts that are **redundant or low-information**, never the parts carrying the actual answer. Always verify on your eval set — over-compression silently drops the fact the user asked about.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 8,000 tok prompt<span class="sub">verbose + boilerplate</span></span>
    <span class="darr">→<span class="lbl">compress</span></span>
    <span class="dbox orange">✂️ 3,500 tok<span class="sub">same meaning</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 model</span>
  </div>
  <div class="dcap">Remove low-information tokens before the expensive call — cheaper input, more room for signal.</div>
</div>

## Concrete example

Worked numbers on a RAG call, frontier model at $10/MTok input:

| Version | Input tokens | Input cost |
|---|---|---|
| Original (verbose instructions + raw HTML context) | 8,200 | $0.082 |
| Prompt hygiene (tight instructions) | 6,400 | $0.064 |
| + HTML→markdown, drop boilerplate | 4,100 | $0.041 |
| + LLMLingua on retrieved passages (2×) | 2,600 | $0.026 |

That's **$0.082 → $0.026 per call, a 68% input cut.** Across 2M calls/month that's ~$112k saved — for edits that didn't touch the model or the answer quality (verified equal on eval).

```python
# Cheap structural win: send facts as a compact table, not verbose prose/JSON
rows = [f"{r['sku']}|{r['name']}|{r['price']}" for r in products]
context = "sku|name|price\n" + "\n".join(rows)   # ~1/3 the tokens of pretty JSON
```

## How a company uses this

A logistics firm's shipment-tracking assistant fed raw carrier API JSON straight into the prompt — deeply nested, full of null fields and repeated keys, ~5,000 tokens per query. An engineer flattened it to a 12-line summary of only the fields the model needed (status, location, ETA, exceptions): **~700 tokens, an 85% cut** on that segment, with *better* answers because the model wasn't distracted by noise. For a document-heavy legal-search product, the team ran LLMLingua on retrieved clauses before synthesis, holding accuracy on their eval while cutting context tokens ~3×. The pattern is universal: whatever machine-generated blob you're pasting in is almost always compressible.

## Common mistakes

- **Compressing the signal.** Dropping the sentence that held the answer to save tokens. Always A/B on eval before shipping a compression.
- **Over-summarizing early.** A lossy summary at the start of an agent chain starves every later step. Summarize what's stable, keep what's still in play.
- **Ignoring structural waste.** Teams reach for fancy LLMLingua while still pasting raw HTML — fix the free structural wins first.
- **Forgetting caching interacts.** If a chunk is cached (see [cache-friendly structure](cache-friendly-prompt-structure.md)), compressing it changes the prefix and busts the cache — measure net effect.

## Interview tip
Say: *"I compress input in three tiers: first prompt hygiene — cut boilerplate and verbose instructions, usually a free 20–30%; then structural — send data as compact tables not raw JSON/HTML; then learned compression like LLMLingua or a cheap-model summary for long context I can't hand-edit. I only ever compress redundant, low-information tokens and I verify equal quality on eval, because over-compression drops the fact the user asked about."* It shows judgment, not just a tool name.
