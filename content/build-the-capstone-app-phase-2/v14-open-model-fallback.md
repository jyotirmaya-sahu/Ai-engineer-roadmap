# v14 · Open-Model Fallback

**What you'll build:** HelpDesk can route a narrow, low-risk task to an open model through the Hugging Face Inference API, and can run the same model locally for development or data-residency experiments.

## Why this version

A fallback should preserve a useful minimum service during a provider outage or cost spike. It should not pretend that every model is interchangeable. You will choose one bounded task—ticket category classification—whose output is easy to validate. Chat, refunds, and tool execution stay disabled if the primary provider is unavailable.

## The mechanism

Create a provider interface with one method for the selected task. The primary implementation uses your existing gateway. The fallback implementation uses a pinned model from the Hugging Face Hub. A router switches only after the circuit breaker opens or when an explicit configuration flag selects the fallback.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">classification request</span><span class="darr">→</span><span class="dbox orange">provider router</span><span class="darr">→</span><span class="dbox purple">primary model</span><span class="darr">or</span><span class="dbox blue">pinned open model</span><span class="darr">→</span><span class="dbox green">validated category</span>
  </div>
  <div class="dcap">Fallback is capability-specific and validated; it is not a blind replacement for the whole assistant.</div>
</div>

## Concrete implementation

```python
from transformers import pipeline

LABELS = ["order", "refund", "technical", "account", "other"]
classifier = pipeline(
    task="zero-shot-classification",
    model="MoritzLaurer/mDeBERTa-v3-base-mnli-xnli",
    revision="8adb042d524ecd5c26d3e3ba0e3fbcf7e2d0864c",
)

def classify_locally(text: str) -> dict:
    result = classifier(text, candidate_labels=LABELS, multi_label=False)
    return {"category": result["labels"][0], "confidence": result["scores"][0]}
```

Load this pinned model once during application startup, not inside a request. Inspect the model card, license, supported languages, input length, and resource requirements; revalidate the pinned revision before adopting this curriculum in a later year. Use its tokenizer with explicit truncation and test both English and Arabic examples relevant to Dubai customers.

For hosted testing, implement the same adapter with `huggingface_hub.AsyncInferenceClient` and its `zero_shot_classification` method, a deadline, and mapped application errors. Confirm that the chosen model is available from the selected Inference Provider; a Hub listing alone does not guarantee hosting. A hosted open model is a third-party capability/cost fallback, not a privacy fallback. Only an approved local or in-region deployment may handle data classes that forbid external transfer. Keep both adapters behind the same typed result contract. If confidence is below your evaluated threshold, return `other` and require human triage.

Build a labelled set with at least 100 anonymized tickets. Compare accuracy, macro F1, latency, and cost between primary and fallback implementations. Test the fallback independently every day; an emergency path that has not run for months is not a real fallback.

## How a company uses this

Regulated or high-volume teams often use a model portfolio: a strong hosted model for complex generation and a smaller open model for classification, redaction, or routing. Deployment can be a managed inference endpoint first, then a dedicated GPU only when steady utilization justifies it. Track fallback activation, task volume, accuracy drift, cold starts, and GPU utilization.

## Common mistakes

- Sending all traffic to a weaker fallback without feature restrictions.
- Ignoring the model license or revision.
- Comparing models on anecdotes instead of a labelled test set.
- Assuming local inference is free while ignoring GPU and operations cost.
- Loading a large model inside every web request.

## Interview tip

Say exactly which capability survives degraded mode and which ones shut off. This shows graceful degradation, not checkbox multi-provider support.

## Practice — assignments

1. Define one typed interface for ticket classification providers.
2. Evaluate a hosted open model on anonymized English and Arabic tickets.
3. Run the pinned revision locally and record memory and latency.
4. Add confidence-based human escalation.
5. Trigger fallback through the circuit breaker in a test environment.
6. Disable write tools while degraded mode is active.
7. Add a daily synthetic check for the fallback path.
