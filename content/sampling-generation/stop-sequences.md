# Stop sequences

**The one-line idea:** give the API a list of strings that act as a "kill switch" — the instant the model is about to produce one of them, generation stops and the string itself is not included in the output.

## Why it matters for an AI Engineer

Stop sequences are how you make a model *stop at the right place* instead of rambling on, hallucinating the other side of a conversation, or spilling past a structured block. They're essential for chat-turn boundaries, few-shot prompting, and any format where you need generation to end at a known marker. In production they prevent a whole class of bugs — the model "continuing" a dialogue by inventing the user's next message — and they're cheap: cheaper than paying for tokens you'd throw away anyway (see **[max tokens](max-tokens.md)**).

## The mechanism / how it works

You pass an array of strings (OpenAI `stop`, Anthropic `stop_sequences`). As the model generates token by token, the API watches the growing output. The moment the accumulated text would contain one of your stop strings, generation **halts before emitting it**, and the response's **finish_reason** is set to `stop` (OpenAI) or the `stop_sequence` field tells you *which* one fired (Anthropic).

Two things to internalize:

1. **The stop string is excluded from the returned text.** If you stop on `"\n\nUser:"`, you get everything up to it, not including it.
2. **Matching is on the text, and boundaries matter.** A stop sequence only fires when the model *generates* it. Choose markers that are distinctive and won't appear naturally mid-answer, or you'll truncate early.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 generating…<span class="sub">"Sure, here is the answer.\n\nUser:"</span></span>
    <span class="darr">→<span class="lbl">sees "\n\nUser:"</span></span>
    <span class="dbox orange">🛑 halt before it</span>
    <span class="darr">→</span>
    <span class="dbox green">return text up to marker<span class="sub">"Sure, here is the answer."</span></span>
  </div>
  <div class="dcap">A stop sequence ends generation at a known marker and is stripped from the output.</div>
</div>

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

# We're building a fake dialogue and want ONLY the assistant's turn.
r = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[{"role": "user", "content":
        "Continue this chat as the Agent.\n\nCustomer: Where is my order?\nAgent:"}],
    stop=["\nCustomer:", "\nAgent:"],   # stop before either speaker's next turn
    max_tokens=100,
)
print(repr(r.choices[0].message.content))  # just the Agent line, no next turn
print(r.choices[0].finish_reason)          # "stop"
```

Classic uses: stopping on a code-fence marker to end a code block, on `"</json>"` to close a structured section, or on `"\n\n"` to keep an answer to a single paragraph.

## How a company uses this

A Dubai telecom's support bot uses templated prompts that end with `"Agent:"` and sets a stop sequence of `"\nCustomer:"`. Without it, the model would happily *invent* the customer's next complaint and answer that too — leaking a fabricated conversation into the reply. With it, generation ends cleanly at the agent's turn. A data-extraction pipeline at the same company wraps output in `<record>…</record>` and stops on `</record>`, guaranteeing it never generates trailing commentary after the structured block — which keeps the downstream JSON parser from choking. Stop sequences turn "the model usually stops here" into "the model *always* stops here."

## Common mistakes / misconceptions

- **Picking a marker that appears in normal text.** Stopping on `"."` or `" the"` truncates almost immediately. Use distinctive multi-character markers.
- **Expecting the stop string in the output.** It's removed — if you need it, append it yourself after the call.
- **Forgetting whitespace/newlines are literal.** `"User:"` and `"\nUser:"` and `" User:"` are different strings; match what the model actually generates.
- **Relying on stop sequences alone for length control.** Always pair with **[max tokens](max-tokens.md)** as a hard backstop in case the marker never appears.
- **Too many / overlapping sequences.** Most APIs cap the count (e.g. 4). Keep the list tight and unambiguous.

## Interview tip

Say: *"Stop sequences are strings that halt generation the moment the model would produce them, and they're excluded from the output. I use them for chat-turn boundaries — like stopping on the next speaker's label so the model doesn't hallucinate the other side — and to close structured blocks. I always back them with a max_tokens ceiling in case the marker never fires."* The "so it doesn't hallucinate the user's next turn" example is the one that shows real usage.
