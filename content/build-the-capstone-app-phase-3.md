# Build: The Capstone App — Phase 3

**The one-line idea:** turn HelpDesk's prompts and context into explicit, versioned software so its behavior stays safe, relevant, affordable, and measurable across long customer conversations.

## Why Phase 3 exists

At v15, HelpDesk has impressive capabilities: tools, multimodal intake, similar-ticket search, provider resilience, batch work, and fallback behavior. But its intelligence still depends on prompt strings and an ever-growing collection of messages. That becomes fragile as the product grows. One prompt change can silently lower ticket quality; old conversation turns can bury current instructions; untrusted attachment text can try to override policy.

Phase 3 builds the control layer. Prompts become named, versioned artifacts. Complex work becomes a small workflow with validated boundaries. Customer facts live outside the chat transcript. A context assembler selects, orders, and budgets everything the model sees.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">user + memory + tools</span><span class="darr">→</span><span class="dbox orange">context assembler</span><span class="darr">→</span><span class="dbox purple">versioned prompt workflow</span><span class="darr">→</span><span class="dbox blue">validators + guardrails</span><span class="darr">→</span><span class="dbox green">measured answer</span>
  </div>
  <div class="dcap">Phase 3 controls what the model sees, what it may produce, and how changes are evaluated.</div>
</div>

## The build sequence

| Version | What you add | Lessons made real |
|---|---|---|
| [v16 · Versioned prompt library](build-the-capstone-app-phase-3/v16-versioned-prompt-library.md) | typed templates outside route handlers | system prompts, roles, delimiters, templates, versioning |
| [v17 · Few-shot structured triage](build-the-capstone-app-phase-3/v17-few-shot-structured-triage.md) | consistent ticket classification and escalation | zero/few-shot, structured output, examples |
| [v18 · Grounding, citations & guardrails](build-the-capstone-app-phase-3/v18-grounding-citations-guardrails.md) | evidence-bound answers with safety checks | grounding, hallucination control, injection defense, moderation |
| [v19 · Chained support workflow](build-the-capstone-app-phase-3/v19-chained-support-workflow.md) | small validated stages instead of one giant prompt | decomposition, ReAct-style tool use, verification |
| [v20 · External customer memory](build-the-capstone-app-phase-3/v20-external-customer-memory.md) | durable approved facts loaded on demand | external memory, tool results as context, isolation |
| [v21 · Context budget & compaction](build-the-capstone-app-phase-3/v21-context-budget-compaction.md) | token-budgeted assembly for long conversations | pruning, summarization, compaction, caching |
| [v22 · Prompt experiments & Phase 3 demo](build-the-capstone-app-phase-3/v22-prompt-experiments-phase-3-demo.md) | offline evaluation and controlled rollout | A/B tests, prompt tracking, end-to-end evidence |

## The rule for this phase

Every model call must declare its prompt version, context budget, input sources, output schema, and failure behavior. Do not expose hidden reasoning or store it as customer data. Ask models for concise decisions, evidence, and confidence—not private chain-of-thought. Where extra reliability is needed, use independent checks or repeated structured votes and measure whether the added cost helps.

Phase 3 inherits the v8.1 delivery contract. A milestone is not complete with a prompt snippet: it must include its migration, registry/service change, route contract, visible UI state, versioned fixtures, executable evaluation, tenant/privacy test, failure behavior, feature flag, and rollback. A conversation pins one immutable **release bundle** containing prompt, model/settings, schema, tools, examples, context policy, guardrails, policy snapshot, and embedding version; aliases may select a bundle only when the conversation begins.

## Interview tip

Describe the change in engineering terms: *“I moved prompts out of endpoints into a versioned registry, built a context assembler with per-source budgets, isolated untrusted evidence, compacted old conversation state, and gated prompt releases on a labelled evaluation set.”* This sounds like an operated system because it is one.

---

*Below: seven Phase 3 milestones. Continue from v15 and build them in order.*
