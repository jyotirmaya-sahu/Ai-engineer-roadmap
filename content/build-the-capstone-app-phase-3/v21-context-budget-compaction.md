# v21 · Context Budget & Compaction

**What you'll build:** a context assembler that gives every source a token budget, prunes low-value content, compacts old conversation turns, and preserves a cache-friendly stable prefix.

## Why this version

By v20, a single call could include system instructions, examples, customer memory, chat history, policy excerpts, tool results, attachments, and the new question. Appending everything increases cost and latency while important facts get lost. The window is a budget, not a bucket.

## The mechanism

Define an explicit budget below the model limit so output and tool calls have room. Reserve tokens by priority: stable instructions first, current question and recent turns next, then necessary tool evidence, selected memory, and older history. Count with the model's tokenizer before sending.

<div class="diagram">
  <div class="flow"><span class="dbox blue">system 1.5k</span><span class="dbox orange">recent chat 3k</span><span class="dbox purple">evidence 5k</span><span class="dbox gray">memory 1k</span><span class="darr">→</span><span class="dbox green">10.5k input + 1.5k output</span></div>
  <div class="dcap">Each source earns space by relevance and priority; unused capacity does not justify irrelevant text.</div>
</div>

```python
@dataclass
class ContextBudget:
    total_context: int = 12_000
    system: int = 1_500
    recent_chat: int = 3_000
    evidence: int = 5_000
    memory: int = 1_000
    output_reserve: int = 1_500

def assemble(parts, budget, count_tokens):
    return {
        "system": fit(parts.system, budget.system, count_tokens),
        "memory": rank_and_fit(parts.memory, budget.memory, count_tokens),
        "evidence": rank_and_fit(parts.evidence, budget.evidence, count_tokens),
        "chat": compact_chat(parts.chat, budget.recent_chat, count_tokens),
    }
```

The source allocations are a 10.5k maximum input inside a 12k total budget; the remaining 1.5k is output reserve. Tool definitions, output schemas, wrapper/role tokens, and delimiters count too, so count the final rendered request and trim again when necessary. Trim only complete messages or excerpts—never slice JSON/XML mid-structure. Keep the current question in its own highest-priority field.

When old history no longer fits, summarize it into structured state: customer goal, confirmed facts, actions taken, unresolved questions, promises made, and source message range. Keep recent turns verbatim. Never let a summary overwrite confirmed facts; store it as a derived artifact that can be regenerated.

Isolate subtask contexts: classification does not need full policy text; image analysis does not need months of chat. For long documents, select relevant sections rather than relying on giant windows. Keep system instructions and few-shot examples as an identical prefix across requests so prompt/KV caching can reduce latency and cost.

Add telemetry for tokens by source, compaction count, cache-read tokens, input cost, and answers later judged to have omitted needed context. Test conversations of 5, 50, and 500 turns.

## How a company uses this

A production assistant may enforce a 12k total context budget—at most 10.5k input plus 1.5k output—even when the model supports 128k. This gives predictable p95 latency and spend. It alerts when evidence is repeatedly truncated or summaries grow, which indicates the selection strategy—not the model window—needs improvement.

## Common mistakes

- Filling the advertised context limit on every request.
- Summarizing recent exact details that tools still need.
- Allowing a model-generated summary to become unquestioned truth.
- Mixing every subtask into one shared context.
- Changing stable prompt prefixes and losing cache benefits.

## Interview tip

Give a concrete budget and ordering policy. Explain what stays verbatim, what is summarized, what is dropped, and how omission errors are monitored.

## Practice — assignments

1. Measure tokens by source for existing conversations.
2. Enforce a 12k total context budget with at most 10.5k input and 1.5k output reserve.
3. Compact old turns into structured state.
4. Keep recent turns and tool evidence verbatim.
5. Give classification and drafting separate contexts.
6. Measure cache-read tokens after stabilizing the prefix.
7. Load-test 500-turn synthetic conversations.
