# Data Prep & Formatting

**The one-line idea:** fine-tuning learns from your examples *exactly as formatted*, so building a clean, consistent dataset in the model's expected chat template is the step that actually decides whether the tune works.

## Why it matters for an AI Engineer

Everyone focuses on the training run, but **the dataset is 80% of the outcome.** A perfect training config on messy, inconsistent data produces a worse model; mediocre config on clean, consistent data produces a great one. Getting the *format* wrong — the wrong chat template, or training on the whole example instead of just the answer — silently wrecks results even when the loss curve looks fine. This is the least glamorous and most decisive skill in fine-tuning, and a favorite "so how did you actually prepare the data?" interview probe.

## The mechanism / how it works

**1. Pick the task shape.** Most fine-tunes are one of:
- **Instruction / chat:** `{system, user, assistant}` turns. The common case.
- **Completion:** `prompt → completion` text pairs.
- **Preference:** `{prompt, chosen, rejected}` for [RLHF / DPO](rlhf-dpo.md).

**2. Match the model's chat template — exactly.** Each instruct model was trained with specific special tokens (e.g. Llama-3's `<|start_header_id|>user<|end_header_id|>` … `<|eot_id|>`). If you fine-tune with a *different* format than the model expects, you fight its pretraining. Always apply the model's own template with `tokenizer.apply_chat_template()` rather than hand-writing delimiters.

**3. Mask the prompt — train only on the response.** You want the model to learn to *produce the answer*, not to parrot the question. Loss should be computed only on the assistant tokens; the user/system tokens are context, not a learning target. Getting this wrong makes the model echo prompts.

**4. Clean and de-duplicate.** Remove near-duplicates, contradictory labels (same input, different output), truncated examples, and anything longer than your `max_seq_length`. **Consistency of format and voice** across examples is the single biggest quality lever (see [Data-volume thresholds](data-volume-thresholds.md)).

**5. Split.** Hold out ~10% as an eval set *before* training so you can prove improvement ([Train & evaluate](train-evaluate.md)).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📄 Raw examples</span>
    <span class="darr">↓<span class="lbl">clean · dedupe · fix labels</span></span>
    <span class="dbox orange">🧹 Consistent {system,user,assistant}</span>
    <span class="darr">↓<span class="lbl">apply model's chat template</span></span>
    <span class="dbox blue">🔤 Tokenized + prompt-masked</span>
    <span class="darr">↓<span class="lbl">90 / 10 split</span></span>
    <span class="dbox green">✅ Train + held-out eval</span>
  </div>
  <div class="dcap">The pipeline that turns raw pairs into a training-ready dataset. Format errors here silently ruin the tune.</div>
</div>

## Concrete example

```python
from datasets import load_dataset
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")

# Each row: {"messages": [{"role":"system",...},{"role":"user",...},{"role":"assistant",...}]}
ds = load_dataset("json", data_files="train.jsonl")["train"]

def format_row(row):
    # Use the MODEL'S own template — do not hand-write <|...|> tokens
    text = tok.apply_chat_template(row["messages"], tokenize=False)
    return {"text": text}

ds = ds.map(format_row)
ds = ds.filter(lambda r: len(tok(r["text"])["input_ids"]) <= 2048)  # drop over-long
ds = ds.train_test_split(test_size=0.1)   # 90/10 split
print(ds["train"][0]["text"][:300])
```

TRL's `SFTTrainer` can apply prompt-masking automatically when you pass the chat-format dataset — but you must still hand it the *right template*.

## How a company uses this

A Dubai bank's team fine-tuned a model to write compliance summaries and got gibberish on the first run — the loss looked healthy, but outputs were garbage. Root cause: they'd formatted the data with a **generic Alpaca template** while the base was a **Llama-3 Instruct** model expecting its own special tokens. Re-exporting the same 900 examples through `apply_chat_template` — no new data, no config change — turned the next run into a production-quality model. The lesson they now enforce: *the dataset format must match the model's template, and that's checked before any GPU is booked.*

## Common mistakes
- **Wrong chat template** — the #1 silent killer, as above.
- **Training on the full example** instead of masking the prompt → the model echoes questions.
- **Inconsistent labels/voice** → a blurry target the model can't lock onto.
- **No eval split**, so you can't tell if it worked.

## Interview tip
Say: *"Data prep decides the tune. I standardize everything to the model's own chat template via `apply_chat_template`, mask the prompt so loss is only on the response, dedupe and fix contradictory labels for consistency, drop over-length rows, and hold out 10% for eval. Most failed fine-tunes I've seen were format bugs — wrong template or unmasked prompts — not training-config bugs."* Next: [Unsloth](unsloth.md) and [HF PEFT / TRL](hf-peft-trl.md) to run the training.
