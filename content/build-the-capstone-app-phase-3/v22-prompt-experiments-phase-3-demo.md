# v22 · Prompt Experiments & Phase 3 Demo

**What you'll build:** an evaluation and rollout system that proves a new prompt/context configuration is better before it reaches every customer, plus a portfolio demo showing the full Phase 3 control layer.

## Why this version

Prompt changes are code changes with probabilistic effects. A clearer instruction may improve English delivery questions while hurting mixed Arabic/English refunds. Manual spot checks rarely catch this. Phase 3 is complete only when behavior changes are tested on representative data and released gradually.

## The mechanism

Create a versioned evaluation dataset containing anonymized inputs, expected structured fields, allowed source IDs, safety expectations, and subgroup labels such as language and category. Freeze a baseline configuration and run every candidate against the same set.

```python
class EvalCase(BaseModel):
    id: str
    input: str
    expected_category: str
    required_citations: set[str]
    must_escalate: bool
    language: str

class RunRecord(BaseModel):
    case_id: str
    release_bundle_id: UUID
    dataset_version: str
    grader_version: str
    deployment_sha: str
    exposure_id: UUID
    subgroup: dict[str, str]
    output: dict
    latency_ms: int
    input_tokens: int
    output_tokens: int
    cost_usd: float
```

Use deterministic graders for schema validity, category, citation IDs, escalation, and forbidden tool calls. Human review scores tone and usefulness on a blinded sample. An LLM judge may assist but must be calibrated against human decisions and never be the only safety gate.

<div class="diagram">
  <div class="flow"><span class="dbox gray">candidate prompt + context policy</span><span class="darr">→</span><span class="dbox blue">frozen eval set</span><span class="darr">→</span><span class="dbox orange">quality · safety · cost · latency</span><span class="darr">→</span><span class="dbox purple">5% canary</span><span class="darr">→</span><span class="dbox green">promote or rollback</span></div>
  <div class="dcap">Offline gates catch known regressions; a canary catches real-world behavior before full rollout.</div>
</div>

The immutable release bundle—not an individual prompt—is the experiment unit. Assign the user to a sticky cohort, then pin its selected bundle when a new conversation begins. Never switch an active conversation midstream. Rollback changes only the default bundle for new conversations and retains exposure records for analysis.

Set release thresholds before seeing results: no citation or authorization regression, urgent recall at least 95%, schema validity above 99%, cost increase below 10% unless quality gain is approved, and no subgroup drop greater than an agreed margin. For a low-traffic portfolio app, use offline and simulated/shadow traffic first; run a live canary only after a predeclared minimum sample size and time/volume exit rule can produce evidence. Compare task completion, escalation, correction, latency, and cost, and stop automatically on a safety regression.

## The Phase 3 demo

Show a long mixed-language customer conversation. HelpDesk loads an approved language preference, uses a versioned prompt, cites a policy source, ignores an injection hidden in uploaded text, compacts old turns, and preserves the unresolved issue. Open the trace to show prompt version, context sources and token allocation—but not private content. Then compare baseline and candidate evaluation reports and demonstrate rollback.

Update the README with the prompt registry, workflow diagram, memory policy, context-budget table, eval methodology, subgroup results, and known limitations. Tag the repository `v22`.

## How a company uses this

Product, support, safety, and engineering agree on the release scorecard. Online experiments use outcome metrics rather than model preference alone. Dataset failures become regression cases. Evaluation data is access-controlled and reviewed for personal information before storage.

## Common mistakes

- Changing the dataset while comparing candidate and baseline.
- Optimizing only an aggregate score and hiding subgroup failures.
- Using an uncalibrated LLM judge as ground truth.
- Randomizing per request so one conversation changes behavior midway.
- Shipping without a fast rollback path.

## Interview tip

Present one prompt change with its baseline, candidate, release thresholds, canary result, and rollback rule. That is far more credible than claiming extensive prompt engineering.

## Practice — assignments

1. Build a representative anonymized evaluation dataset.
2. Add deterministic quality and safety graders.
3. Compare baseline and candidate by language and category.
4. Define release thresholds before reading candidate results.
5. Run a sticky 5% canary with automatic safety rollback.
6. Produce the Phase 3 demo and evaluation report.
7. Tag `v22` and rehearse a five-minute engineering walkthrough.
