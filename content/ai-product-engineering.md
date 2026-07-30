# AI Product Engineering

**The one-line idea:** AI Product Engineering is owning the *outcome* a feature is supposed to deliver — deciding whether it needs AI at all, defining what "good" means, designing the UX around a model that sometimes lies, and closing the loop so the product gets smarter — instead of just wiring a model to an endpoint.

## Why we even need it

Most AI features that ship never get used, and most that get used quietly get switched off. The reason is almost never the model. It's that someone bolted an LLM onto a problem without asking three boring questions: *Does this actually need AI? What does success look like? What happens when the model is wrong?*

An LLM is a probabilistic component. It's confidently wrong sometimes, non-deterministic always, and expensive at scale. If you treat it like a normal function that returns the right answer, your product breaks in ways your users notice before you do. AI Product Engineering is the discipline of building *around* that uncertainty — scoping tightly, measuring honestly, and designing an interface that stays trustworthy even when the model isn't.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">💡 Idea</span>
    <span class="darr">→<span class="lbl">scope</span></span>
    <span class="dbox purple">🎯 Right problem?</span>
    <span class="darr">→<span class="lbl">measure</span></span>
    <span class="dbox orange">📏 Success metric</span>
    <span class="darr">→<span class="lbl">design</span></span>
    <span class="dbox blue">🧑 Human-in-loop UX</span>
    <span class="darr">→<span class="lbl">learn</span></span>
    <span class="dbox green">🔁 Feedback flywheel</span>
  </div>
  <div class="dcap">Product engineering wraps the model in scoping, metrics, UX, and a learning loop — the model is one box, not the whole story.</div>
</div>

## Why it matters for an AI Engineer

The market has split. "Build a RAG pipeline" is now table stakes; a hundred bootcamp grads can do it. What Dubai employers pay a premium for — especially at product companies like Careem, Tabby, and the banks — is an engineer who can be handed a vague business goal ("reduce support ticket volume") and come back with a *shipped feature that actually moves the number* and doesn't get rolled back after a hallucination embarrasses the brand. That means judgment: knowing when to say "this should be a SQL query, not an LLM," knowing how to prove the feature works, and designing so a wrong answer degrades gracefully instead of destroying user trust. This node is the difference between "AI developer" and "AI product engineer" on your CV — and it's the level that clears the interview.

## The tiles you'll learn (and when to reach for each)

| Tile | Core idea | Reach for it when |
|---|---|---|
| [Is this even an AI problem?](ai-product-engineering/is-this-even-an-ai-problem.md) | Filter out problems AI shouldn't touch | Anytime someone says "let's add AI to X" |
| [Success metrics before building](ai-product-engineering/success-metrics-before-building.md) | Define "good" numerically *first* | Before you write a single prompt |
| [When deterministic code wins](ai-product-engineering/when-deterministic-code-wins.md) | Rules/regex/SQL beat LLMs for exact tasks | The task has one correct answer |
| [Human-in-the-loop UX](ai-product-engineering/human-in-the-loop-ux.md) | Keep a human on high-stakes decisions | Errors are costly, irreversible, or regulated |
| [Handling non-determinism](ai-product-engineering/handling-non-determinism.md) | Same input, different output — design for it | Any user-facing LLM feature |
| [Feedback capture & the data flywheel](ai-product-engineering/feedback-capture-the-data-flywheel.md) | Turn usage into training/eval data | You want the product to improve over time |
| [Trust & transparency](ai-product-engineering/trust-transparency.md) | Show sources, confidence, and limits | Users must decide whether to believe the output |

Read them top-to-bottom: scoping first (what to build), then product design (how to make it survive contact with real users).

## Real world: how a company uses this

> **A Dubai fintech** wanted an "AI assistant" to answer customer questions about their statements. The first instinct was a chatbot over the whole knowledge base. A product engineer stopped and asked the scoping questions: 70% of queries were "what's my balance / when's my payment due" — pure database lookups, no AI needed. Those got routed to deterministic code (instant, free, always correct). The remaining 30% — genuinely open-ended questions — went to a RAG assistant that *cited the exact policy clause* (transparency) and offered a "talk to an agent" button on low confidence (human-in-the-loop). They defined success as *deflection rate without complaint escalation*, not "questions answered." Every thumbs-down fed an eval set (the flywheel). Result: cheaper, faster, and trusted by compliance — because AI was used only where it earned its place.

## Interview tip
Say: *"I treat the model as one component, not the product. Before building I ask whether it even needs AI, what number defines success, and where a human stays in the loop. I design for non-determinism, expose sources and confidence so users can trust the output, and capture feedback as an eval and training signal. Most failed AI features fail at product design, not modeling."* That answer signals seniority — it's the judgment layer interviewers are probing for.

---

*Below: deep-dive articles on each part of AI product engineering.*
