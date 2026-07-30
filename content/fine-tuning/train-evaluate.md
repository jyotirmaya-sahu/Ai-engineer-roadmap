# Train & Evaluate

**The one-line idea:** run the training loop watching the loss curves, then *prove* the tuned model is actually better on a held-out set — because a fine-tune that isn't evaluated is a fine-tune you can't trust.

## Why it matters for an AI Engineer

Training is the easy part; *knowing whether it worked* is the job. A fine-tune can look perfect — smooth loss, no errors — while being worse than the base model at the real task or having quietly forgotten general skills. Without evaluation you'd ship a regression. Interviewers push hard here: "how did you know your fine-tune improved things?" A candidate who says "loss went down" is junior; one who talks about held-out metrics, base-vs-tuned comparison, and overfitting signals is senior.

## The mechanism / how it works

**Training — read the two loss curves.**
- **Training loss** should fall steadily. If it plateaus high, the learning rate may be too low or the task too hard.
- **Validation loss** (on your held-out ~10%) is the one that matters. The classic pattern:
  - both falling → learning well.
  - train loss falling but **val loss rising → overfitting**: stop, the model is memorizing not generalizing.
- Key knobs: **epochs** (1–3 is typical for PEFT; more risks overfit), **learning rate** (~1e-4 to 2e-4 for LoRA), **batch size**. Use early stopping on val loss.

**Evaluate — loss isn't the goal, task performance is.** Low loss ≠ good outputs. You need real metrics:
1. **Task metric on a held-out set** — accuracy/F1 for classification, exact-match or field-accuracy for extraction, an **LLM-as-judge** score or human rating for open-ended generation.
2. **Base vs tuned, same eval set** — the only number that proves the tune earned its keep is *tuned minus base*.
3. **Regression check for forgetting** — run a few general-ability prompts to confirm the model didn't lose broad skill while gaining the narrow one (**catastrophic forgetting**).

<div class="diagram">
  <div class="flow v">
    <span class="dbox orange">🏋️ Train — watch train & val loss</span>
    <span class="darr">↓<span class="lbl">val loss rising? → stop (overfit)</span></span>
    <span class="dbox blue">📊 Score tuned model on held-out set</span>
    <span class="darr">↓<span class="lbl">compare</span></span>
    <span class="dbox purple">📊 Score BASE model, same set</span>
    <span class="darr">↓<span class="lbl">tuned − base &gt; 0 AND no forgetting?</span></span>
    <span class="dbox green">✅ Ship it</span>
  </div>
  <div class="dcap">The gate isn't "loss went down" — it's "beats the base on the real metric without forgetting general ability."</div>
</div>

## Concrete example

```python
from trl import SFTTrainer, SFTConfig

trainer = SFTTrainer(
    model=model, peft_config=peft_cfg,
    train_dataset=ds["train"], eval_dataset=ds["test"],   # the 10% held-out split
    args=SFTConfig(output_dir="out", num_train_epochs=3, learning_rate=2e-4,
                   eval_strategy="steps", eval_steps=50,   # watch val loss during training
                   load_best_model_at_end=True),           # early-stopping-style pick
)
trainer.train()

# Then a REAL task eval — don't stop at loss:
import evaluate
f1 = evaluate.load("f1")
def score(m):
    preds = [generate(m, ex["input"]) for ex in test_examples]
    return f1.compute(predictions=preds, references=labels)["f1"]

print("base:", score(base_model), "tuned:", score(trainer.model))  # tuned must win
```

## How a company uses this

A Dubai bank's team fine-tuned a model to classify transactions into 30 categories. The loss curve looked great, so they nearly shipped — until the held-out eval showed **89% tuned vs 91% base**: the fine-tune had *overfit* their 400-row set and gotten *worse*. They caught it only because they ran the base-vs-tuned comparison. Fix: more data + fewer epochs + early stopping on val loss. The second tune hit 95%, beating the base cleanly. The eval gate — not the training run — is what turned a silent regression into a real improvement. In production they keep a frozen eval set and re-run it on every retrain.

## Common mistakes
- **Judging by training loss alone** — it always goes down; it says nothing about generalization or real outputs.
- **No base-vs-tuned comparison** — you can't claim improvement without the baseline.
- **Too many epochs** → memorized train set, worse real performance.
- **Ignoring catastrophic forgetting** — the model aces the new task but breaks general ability.

## Interview tip
Say: *"I watch training vs validation loss during the run — diverging val loss means overfitting, so I early-stop. But the real gate is a task metric on a frozen held-out set, compared *base vs tuned* on the same data, plus a quick general-ability check for catastrophic forgetting. 'Loss went down' isn't evidence a fine-tune worked; beating the base on the real metric is."* Related: [Data prep & formatting](data-prep-formatting.md), [Data-volume thresholds](data-volume-thresholds.md).
