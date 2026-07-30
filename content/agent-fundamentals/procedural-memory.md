# Procedural Memory

**What it is:** Memory of *how to do things* — reusable skills, workflows, and routines the agent has learned, like "the steps to onboard a new client" or "how to correctly format this company's invoices."

## Why it matters for an AI Engineer

Procedural memory is the third flavour of [long-term memory](long-term.md), and it's the one that lets an agent get *better at tasks over time* instead of re-figuring-out the same workflow on every run. Where [semantic memory](semantic-memory.md) stores facts and [episodic memory](episodic.md) stores events, procedural memory stores *know-how*: the successful sequence of actions for a recurring job. For an AI Engineer this is how you build agents that accumulate competence — capture a workflow once, replay it reliably forever — and it's the memory type behind "skills" and "learned tools" in modern agent platforms. It's also the cheapest way to make an agent both faster and more consistent: instead of reasoning from scratch, it follows a proven recipe.

## The mechanism: how it works

A procedural memory is a **stored procedure for the agent** — a named skill describing how to accomplish a task: the steps, the tools to use, and any gotchas. It comes in two forms:

- **Explicit / authored** — you (or a domain expert) write the routine: "To process a refund: 1) verify the order, 2) check the 14-day window, 3) call `issue_refund`, 4) email confirmation." This is essentially a saved prompt/playbook the agent loads when it recognises the task.
- **Learned / self-improved** — the agent notices a task it did successfully, *distils the winning sequence of steps into a reusable skill*, and stores it. Next time a similar task appears, it recalls and follows that procedure instead of re-deriving it. This is the "reflect on success → save the recipe" loop.

The lifecycle: **recognise the task type → recall the matching procedure → follow it (adapting to specifics) → optionally refine it** if a better way is found. Because procedures are about *actions and tools*, they're the tightest coupling between memory and the [agent loop](agent-loop.md): a procedure literally scripts which tools to call in what order.

The key difference from the other memory types: semantic = *what is true*, episodic = *what happened*, procedural = *how to act*. Procedural memory turns a general reasoner into a specialist with playbooks.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🔁 Task recurs: "process a refund"</span>
    <span class="darr">↓<span class="lbl">recall skill</span></span>
    <div class="dgroup"><span class="dgt">PROCEDURE: refund</span>
      <div class="flow">
        <span class="dbox orange">1 verify order</span><span class="darr">→</span>
        <span class="dbox orange">2 check window</span><span class="darr">→</span>
        <span class="dbox orange">3 issue_refund()</span><span class="darr">→</span>
        <span class="dbox orange">4 email ✓</span>
      </div>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Done consistently, no re-reasoning</span>
  </div>
  <div class="dcap">Procedural memory = a saved recipe of steps + tools for a recurring task.</div>
</div>

## Concrete example

Procedural memory as a library of skill "recipes" the agent loads by task type:

```python
# A skill store: task name -> procedure the agent follows
skills = {
    "refund": (
        "Procedure to process a refund:\n"
        "1. Call get_order(order_id) to verify it exists and is paid.\n"
        "2. If order.date is older than 14 days, DENY and explain policy.\n"
        "3. Otherwise call issue_refund(order_id).\n"
        "4. Call send_email(user, 'Your refund is processed').\n"
        "Gotcha: never refund a subscription without cancelling it first."
    ),
}

def run_task(task_type, user_request, client, tools):
    procedure = skills.get(task_type, "No saved procedure; reason from scratch.")
    system = f"You are an agent. Follow this learned procedure exactly:\n{procedure}"
    # ...then run the normal agent loop with this system prompt + tools...
    return system   # injected as the system message

# Learned/self-improvement: after a novel task succeeds, save its steps:
def learn_skill(task_type, successful_steps_summary):
    skills[task_type] = successful_steps_summary
```

The `skills` dict is procedural memory: the agent recalls the matching recipe and follows it, instead of re-inventing the refund workflow (and its "cancel-before-refund" gotcha) every time.

## How a company uses this

A property-management firm in Dubai runs an agent that handles tenant requests. Procedural memory holds authored playbooks for recurring workflows — *maintenance request*, *lease renewal*, *deposit return* — each specifying the exact tools and order, including compliance gotchas (deposit returns must attach an itemised deduction list per RERA rules). This gives two production wins: **consistency** (every deposit return follows the legally required steps, not the model's improvisation) and **speed** (the agent skips re-planning and executes a proven 4-step recipe, cutting a typical request from ~8 loop steps to ~4). They also let the agent *propose* new procedures: when it solves a novel request well, an engineer reviews and promotes it into the skill library — human-in-the-loop learned procedural memory. Consistency on compliance-sensitive workflows was the deciding factor for adopting it.

## Common mistakes

- **Confusing it with semantic memory.** "Refund window is 14 days" is a semantic *fact*; "the *steps* to process a refund" is a procedure. You often need both together.
- **Hard-coding procedures that should be tools.** If a step is deterministic (compute a date), make it a tool, not a natural-language instruction the model might fumble.
- **Auto-learning without review.** Letting an agent save its own procedures unchecked can bake in a mistake it made once. Gate learned skills behind human review for anything important.
- **Stale procedures.** When a policy changes, the saved recipe must be updated, or the agent confidently follows an outdated workflow.

## Interview tip
Say: *"Procedural memory is how-to knowledge — reusable skills and workflows, versus semantic facts and episodic events. It's either authored playbooks or self-learned recipes the agent distils from successful runs. It buys consistency and speed on recurring tasks: the agent follows a proven step-and-tool sequence instead of re-reasoning. For compliance-sensitive workflows I gate learned procedures behind human review."* Framing it as "playbooks that give consistency" resonates with enterprise interviewers.

See also: [Semantic memory](semantic-memory.md) (facts vs how-to), [Episodic](episodic.md), [Which memory type when](which-memory-type-when.md).
