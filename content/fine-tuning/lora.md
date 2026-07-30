# LoRA

**The one-line idea:** instead of retraining a model's billions of weights, LoRA freezes them all and trains two tiny extra matrices per layer — learning the *change* to the weights, not the weights themselves.

## Why it matters for an AI Engineer

LoRA (Low-Rank Adaptation) is the technique that made fine-tuning affordable for normal teams. Full fine-tuning of a 7B model means updating 7 billion numbers — you need enterprise GPUs and hours. LoRA trains **<1%** of that, so a fine-tune fits on a single rented GPU, finishes in minutes to an hour, and produces a tiny (~10–200 MB) adapter file you can swap in and out. If you fine-tune anything in this job, you'll fine-tune with LoRA (usually its memory-saving cousin, [QLoRA](qlora.md)). It's the default, and interviewers expect you to explain *why it works*.

## The mechanism / how it works

Fine-tuning changes a weight matrix `W` by some amount `ΔW`, giving a new matrix `W + ΔW`. Full fine-tuning learns the whole `ΔW` — same size as `W`, huge.

LoRA's insight: that *change* `ΔW` is **low-rank** — it doesn't need the full dimensionality to capture the adaptation. So instead of learning a big `d×d` matrix, LoRA learns two skinny matrices, **A** (`d×r`) and **B** (`r×d`), where the **rank `r` is tiny** (say 8 or 16). Their product `B·A` has the same shape as `ΔW` but is defined by far fewer numbers.

- The original weights `W` stay **frozen** (never updated).
- Only `A` and `B` train. During the forward pass the layer computes `W·x + (B·A)·x` — original output plus a small learned correction.
- Numbers: a `4096×4096` matrix = ~16.8M params. With `r=8`, `A`+`B` = `4096×8 + 8×4096` ≈ 65k params — **~0.4%** of the original. Do this across all attention layers and you train ~0.1–1% of the model.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">x</span>
    <span class="darr">→</span>
    <span class="dbox purple">🔒 W (frozen)</span>
    <span class="darr">→</span>
    <span class="dbox green">＋</span>
    <span class="darr">→</span>
    <span class="dbox gray">output</span>
  </div>
  <div class="flow">
    <span class="dbox gray">x</span>
    <span class="darr">→</span>
    <span class="dbox orange">A (d×r)</span>
    <span class="darr">→</span>
    <span class="dbox orange">B (r×d)</span>
    <span class="darr">→<span class="lbl">small correction</span></span>
    <span class="dbox green">＋</span>
  </div>
  <div class="dcap">Frozen W plus a low-rank learned detour (B·A). Only A and B train.</div>
</div>

Two knobs: **`r`** (rank — capacity of the adapter; 8–64 typical, higher = more expressive but bigger) and **`alpha`** (a scaling factor for how strongly the adapter's output is added; a common rule is `alpha = 2×r`). After training you can either keep the adapter separate (swap per task) or **merge** `B·A` back into `W` for zero extra inference cost.

## Concrete example

```python
# pip install peft transformers
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B")

config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "v_proj"],  # attach LoRA to attention layers
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, config)
model.print_trainable_parameters()
# -> trainable params: ~6.8M || all params: ~8B || trainable%: 0.08%
```

That `0.08%` is the whole point — you train a rounding error's worth of parameters and get a specialized model.

## How a company uses this

A Dubai media company maintains one base open model and **five LoRA adapters** — Arabic headline style, English press-release style, social-caption style, and two client-specific voices. Each adapter is ~50 MB. At serve time they load the base once and hot-swap the ~50 MB adapter per request, so five specialized "models" cost the memory of one plus a handful of megabytes. Training each adapter took ~30 minutes on a single A100 (~$1 of compute). Full fine-tuning five separate 8B models would have meant five 16 GB checkpoints and 5× the GPU bill.

## Common mistakes
- **Rank too high "to be safe."** Large `r` overfits small datasets and bloats the adapter — start at 8–16.
- **Targeting too few modules.** Attention `q/v` is the classic default; adding `k`, `o`, and MLP projections helps on harder tasks.
- **Forgetting to merge (or forgetting *not* to).** Merge for a single fixed task and lowest latency; keep separate if you swap tasks.

## Interview tip
Say: *"LoRA freezes the base weights and learns a low-rank update — two small matrices B·A per layer — so I train under 1% of the parameters. That means single-GPU fine-tunes, tiny swappable adapter files, and no catastrophic forgetting of the base. `r` and `alpha` are the main knobs; I start at r=16."* Next: [QLoRA](qlora.md), which runs LoRA on a quantized base to save even more memory.
