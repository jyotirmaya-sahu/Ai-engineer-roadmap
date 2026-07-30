# HF PEFT / TRL

**The one-line idea:** the standard Hugging Face fine-tuning stack — **PEFT** provides the LoRA/QLoRA machinery, **TRL** provides the training loops (SFT, DPO, reward modeling) — and together they're the industry-default way teams fine-tune LLMs.

## Why it matters for an AI Engineer

This is the stack you'll actually see on the job. [Unsloth](unsloth.md) is great for fast single-GPU runs, but **PEFT + TRL** is the vendor-neutral, well-documented, multi-GPU-capable standard that production teams build on. Knowing it means you can read almost any open fine-tuning repo, plug into `transformers`, scale across GPUs with Accelerate/DeepSpeed, and move fluidly between supervised fine-tuning and preference tuning ([RLHF / DPO](rlhf-dpo.md)). "I used PEFT and TRL" is the phrase that signals you've done real, reproducible fine-tuning.

## The mechanism / how it works

Two complementary libraries, both from Hugging Face, both sitting on top of `transformers`:

- **PEFT (Parameter-Efficient Fine-Tuning)** — the *adapter* toolkit. It wraps a base model with LoRA/QLoRA/other adapters (`LoraConfig`, `get_peft_model`), tracks which parameters train, and handles saving/loading/merging the tiny adapter files. It answers "*what* gets trained."
- **TRL (Transformer Reinforcement Learning)** — the *training-loop* toolkit. It provides high-level trainers that answer "*how* to train":
  - **`SFTTrainer`** — supervised fine-tuning on instruction/chat data (the everyday case). Handles chat-template formatting, prompt-masking, packing.
  - **`DPOTrainer`** — preference tuning on `{chosen, rejected}` pairs.
  - **`RewardTrainer` / `PPOTrainer`** — reward modeling and RLHF.

The typical flow: load model (optionally 4-bit via `BitsAndBytesConfig` for QLoRA) → wrap with PEFT `LoraConfig` → hand it to TRL's `SFTTrainer` with your dataset and `TrainingArguments` → `.train()`. **Accelerate** underneath handles device placement and multi-GPU; **DeepSpeed** plugs in for sharding across many GPUs.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 transformers: base model</span>
    <span class="darr">↓<span class="lbl">BitsAndBytes → 4-bit (QLoRA)</span></span>
    <span class="dbox orange">PEFT: wrap with LoRA adapters</span>
    <span class="darr">↓<span class="lbl">what trains</span></span>
    <span class="dbox blue">TRL: SFTTrainer / DPOTrainer</span>
    <span class="darr">↓<span class="lbl">how it trains · Accelerate multi-GPU</span></span>
    <span class="dbox green">✅ trained adapter</span>
  </div>
  <div class="dcap">transformers holds the model, PEFT decides what trains, TRL runs the loop.</div>
</div>

## Concrete example

```python
# pip install transformers peft trl bitsandbytes accelerate datasets
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset
import torch

name = "meta-llama/Llama-3.1-8B-Instruct"
bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                         bnb_4bit_compute_dtype=torch.bfloat16)
model = AutoModelForCausalLM.from_pretrained(name, quantization_config=bnb, device_map="auto")
tok = AutoTokenizer.from_pretrained(name)

peft_cfg = LoraConfig(r=16, lora_alpha=32, task_type="CAUSAL_LM",
                      target_modules=["q_proj","v_proj"])

ds = load_dataset("json", data_files="train.jsonl")["train"]  # rows have "messages"

trainer = SFTTrainer(
    model=model, peft_config=peft_cfg, train_dataset=ds,
    args=SFTConfig(output_dir="out", num_train_epochs=3,
                   per_device_train_batch_size=2, learning_rate=2e-4),
)
trainer.train()
trainer.save_model("out")   # saves just the LoRA adapter
```

TRL applies the chat template and prompt-masking for chat-format data automatically — but feed it the *right* dataset (see [Data prep & formatting](data-prep-formatting.md)).

## How a company uses this

A Dubai enterprise standardized *all* fine-tuning on **PEFT + TRL** precisely because it's the reproducible, auditable default — one codebase runs QLoRA SFT for tone tuning today and swaps `SFTTrainer` for `DPOTrainer` for preference alignment next quarter, with the same data pipeline and the same Accelerate config scaling from one GPU to four via DeepSpeed. When they hired, they screened for this stack because a new engineer could read and extend the training repo on day one. Vendor-neutral and boring, in the best way.

## Common mistakes
- **Wrong `target_modules`** for the architecture — check the model's layer names.
- **Forgetting `SFTConfig`/`TrainingArguments` basics** (learning rate, epochs) and blaming the tune when defaults overfit.
- **Mixing up PEFT vs TRL roles** in an interview — PEFT = adapters (what trains), TRL = loops (how to train).

## Interview tip
Say: *"PEFT gives me the LoRA/QLoRA adapters — what trains — and TRL gives me the training loops: SFTTrainer for supervised tuning, DPOTrainer for preferences. It sits on transformers with Accelerate for multi-GPU, so it's the reproducible production standard. I reach for Unsloth when I want max speed on a single GPU, but PEFT+TRL is my default team stack."* Next: [Train & evaluate](train-evaluate.md).
