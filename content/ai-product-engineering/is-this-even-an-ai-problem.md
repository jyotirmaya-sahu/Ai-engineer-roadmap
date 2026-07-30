# Is this even an AI problem?

**What it is:** a short, brutal filter you run *before* building — a set of questions that tells you whether a problem genuinely needs a large language model, or whether AI is just a fashionable answer to a problem that plain code would solve better.

## Why it matters for an AI Engineer

Every LLM call costs money, adds latency, and introduces a chance of being wrong. If you reach for AI on a problem that has one deterministic correct answer, you've made your product slower, more expensive, and *less* reliable — and you'll spend months debugging hallucinations that a `WHERE` clause never had. The most senior-sounding thing you can say in a design review is "this doesn't need AI." Employers notice engineers who protect the product from unnecessary AI, because those engineers ship features that work and stay shipped. Knowing when *not* to use the tool is the clearest signal that you understand the tool.

## The mechanism: the filter

AI (specifically an LLM) earns its place only when the task has **fuzzy input, fuzzy rules, or fuzzy output** — something you genuinely cannot enumerate with logic. Run the problem through four gates:

1. **Is there a clear correct answer, computable from data?** "What's the user's balance?" → no AI. It's a lookup. LLMs are for problems where the answer is *judged*, not *computed*.
2. **Is the input unstructured and variable?** Free-text emails, messy PDFs, natural-language questions → good AI fit. Fixed dropdown values → not an AI fit.
3. **Would writing explicit rules be impossible or endless?** Sentiment, summarization, "does this review sound angry?", "extract the intent" → rules explode combinatorially; a model generalizes. If you can write ten `if` statements and be done, do that.
4. **Can you tolerate being wrong sometimes?** LLMs are probabilistic. If a single wrong answer is catastrophic and unrecoverable (transferring money, medical dosing), either don't use AI or wrap it in [human-in-the-loop](human-in-the-loop-ux.md) review.

If a problem passes gates 2 and 3 *and* survives gate 4, it's a real AI problem. Otherwise, prefer [deterministic code](when-deterministic-code-wins.md).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🧩 Task</span>
    <span class="darr">↓<span class="lbl">clear computable answer?</span></span>
    <span class="dbox blue">🗄️ Use DB / rules</span>
    <span class="darr">↓<span class="lbl">no — fuzzy input & rules?</span></span>
    <span class="dbox purple">🧠 Use an LLM</span>
    <span class="darr">↓<span class="lbl">but errors catastrophic?</span></span>
    <span class="dbox green">🧑 LLM + human review</span>
  </div>
  <div class="dcap">Only fuzzy-input, fuzzy-rule, error-tolerant problems belong to an LLM.</div>
</div>

## Concrete example

A team gets: *"Build AI to categorize incoming support tickets."* Run the filter on the real data:

| Sub-task | Verdict | Why |
|---|---|---|
| Detect language of ticket | Not AI (library) | `langdetect` is deterministic, free, instant |
| Route "refund"/"cancel" keywords | Not AI (rules) | Exact keywords → a lookup table |
| Classify open-ended complaints into 12 nuanced themes | **AI** | Fuzzy meaning, no enumerable rules |
| Detect a threat of legal action | AI **+ human** | Fuzzy, but a miss is expensive → escalate |

Same "AI ticketing" project, but only *one* piece is genuinely an LLM job. Naively LLM-ing all four would cost 4x, be slower, and get the deterministic parts *wrong* more often than code would.

## How a company uses this

At a Dubai e-commerce company, product wanted "AI-powered search." An engineer profiled real queries: ~85% were exact SKU codes, brand names, and category filters — classic keyword/database search, where an LLM would be *slower and less accurate*. Only the long-tail "gift for my dad who likes fishing"-type queries benefited from semantic understanding. They shipped deterministic search as the default and routed the ~15% ambiguous queries to an LLM-reranked path. At their scale (millions of queries/day), forcing everything through an LLM would have added ~400ms median latency and a five-figure monthly bill for *worse* results on the common case. Scoping AI to the 15% that needed it was the whole win.

## Common mistakes
- **"AI everywhere" mandate from leadership** → resist by mapping which sub-tasks are actually fuzzy. Show the split.
- **Using an LLM for extraction that has a stable schema** — often a regex or a parser is more reliable and free.
- **Ignoring the error cost.** "It's usually right" is fine for suggestions, fatal for irreversible actions.
- **Confusing "hard for me to code" with "needs AI."** A gnarly-but-deterministic task needs better code, not a model.

## Interview tip
When given a product prompt, *don't* jump to architecture. Say: *"First I'd decompose it and check which parts are genuinely fuzzy versus a lookup. I'd only use an LLM where the input is unstructured, rules would be endless, and we can tolerate occasional errors — and I'd gate high-stakes cases behind a human."* Interviewers are often testing whether you'll over-apply AI. Passing that test up front sets the tone for the whole loop.
