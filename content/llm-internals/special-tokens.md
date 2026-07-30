# Special Tokens

**What it is:** Reserved tokens in the vocabulary that aren't real words — they mark structure like "start of text," "end of turn," or "this is the system message," telling the model where things begin and end.

## Why it matters for an AI Engineer

Special tokens are the invisible scaffolding behind chat. They're why a model knows the difference between the *system* prompt, the *user*, and the *assistant*; why it stops generating at the right place; and why **manually concatenating messages into one string often breaks** a chat model. When you call `chat.completions`, the API applies these tokens for you — but the moment you self-host, fine-tune, or build agent loops, getting them right (or wrong) is the difference between coherent output and garbage.

## The mechanism

During tokenizer/model training, certain IDs are reserved for control rather than language. Common ones:

- **BOS (beginning-of-sequence)** — e.g. `<s>` or `<|begin_of_text|>`: marks the start of input.
- **EOS (end-of-sequence)** — e.g. `</s>` or `<|end_of_text|>`: the model emits this to say "I'm done." Generation loops **stop when they see it** (or an equivalent stop token).
- **PAD** — fills short sequences to a uniform length for batching; masked out so it doesn't affect the result.
- **UNK** — legacy "unknown" token (rare now with byte-level BPE).
- **Chat/role tokens** — e.g. Llama 3's `<|start_header_id|>system<|end_header_id|>`, `<|eot_id|>` (end of turn), or ChatML's `<|im_start|>` / `<|im_end|>`: they delimit *who is speaking*.

The **chat template** is the exact recipe that arranges your messages into a single token stream using these markers. Each model family has its own template — mixing them up is a common bug.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">messages = [system, user]</span>
    <span class="darr">↓</span>
    <span class="dbox purple">Apply chat template</span>
    <span class="darr">↓</span>
    <span class="dbox wide">&lt;|im_start|&gt;system ... &lt;|im_end|&gt; &lt;|im_start|&gt;user ... &lt;|im_end|&gt; &lt;|im_start|&gt;assistant</span>
    <span class="darr">↓</span>
    <span class="dbox green">🧠 Model generates until &lt;|im_end|&gt; / EOS</span>
  </div>
  <div class="dcap">The chat template wraps messages in role/control tokens; the trailing assistant marker cues the model to reply.</div>
</div>

The trailing `assistant` marker with nothing after it is the cue: "your turn — generate the assistant reply now."

## Concrete example

With `transformers`, the template does the work:

```python
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B-Instruct")
messages = [
    {"role": "system", "content": "You are terse."},
    {"role": "user", "content": "Hi"},
]
prompt = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
print(prompt)
# <|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are terse.<|eot_id|>
# <|start_header_id|>user<|end_header_id|>\n\nHi<|eot_id|>
# <|start_header_id|>assistant<|end_header_id|>\n\n
```

If you'd instead pasted "system: You are terse. user: Hi" as plain text, the model wouldn't recognize the roles — it was trained on the *special-token* format, not that literal string.

## How this shows up in production

- **Hosted chat APIs hide this:** OpenAI/Anthropic apply the template server-side, which is why you just pass a `messages` list. The tokens are still there under the hood.
- **Stop sequences:** Agent frameworks set stop tokens (e.g. `<|eot_id|>`) so the model doesn't hallucinate the *next* speaker's turn. Wrong stop token = the model role-plays the user replying to itself.
- **Fine-tuning gotcha:** Training data must match the base model's exact special-token format, or the fine-tune degrades. This is a frequent silent bug.

## Common misconceptions

- **"Special tokens are just plain text I can type."** They're reserved IDs. Typing the literal string `<|im_end|>` may or may not map to the real control token depending on tokenizer settings — don't rely on it.
- **"All models use the same chat format."** No — Llama, ChatML/OpenAI, Mistral, Gemma each differ. Always use the model's own `apply_chat_template`.
- **"The model decides on its own when to stop."** It stops because it *generates* an EOS/end-of-turn token and the serving loop halts on it — a mechanical stop condition you can configure.

## Interview tip

Say: *"Special tokens are reserved vocabulary entries for structure — BOS/EOS mark boundaries, and chat models use role tokens via a chat template to separate system, user, and assistant turns. The model stops when it emits an end-of-turn/EOS token. Hosted APIs apply the template for you, but if you self-host or fine-tune you must match the model's exact format."* Mentioning `apply_chat_template` signals hands-on experience.
