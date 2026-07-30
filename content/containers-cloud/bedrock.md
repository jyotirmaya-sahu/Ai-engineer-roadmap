# Bedrock

**What it is:** Amazon Bedrock is AWS's managed API for calling frontier LLMs — Anthropic's Claude, Meta's Llama, Amazon's own Nova, and others — through one AWS-native endpoint, with no servers to run.

## Why it matters for an AI Engineer

For Dubai roles this is the LLM entry point that matters. Enterprises here run on AWS, and many can't send data to a third-party like OpenAI for **data-residency and compliance** reasons — the UAE has strict data-protection expectations, and banks/government prefer data staying in-region. Bedrock lets them call Claude while keeping the request inside their own AWS account and (crucially) in the AWS **UAE region**. Knowing Bedrock signals you can build LLM apps the way regulated Dubai companies actually deploy them.

## How it works

Bedrock is a **single API in front of many models**. You pick a `modelId` (e.g. a Claude model, a Llama model), send a prompt, get a completion — billed per token, no infrastructure. Key properties:

- **Auth is IAM, not API keys.** Your container's [IAM](s3-iam.md) role grants `bedrock:InvokeModel`. There's no key to leak — access is the role. This is why enterprises love it.
- **Data stays in your account and region.** Prompts aren't used to train the base models, and if you call the `me-central-1` (UAE) or Bahrain endpoint, the data stays in-region.
- **Two invoke styles:** `InvokeModel` (each model's native JSON) and the newer **Converse API** (one unified request/response shape across all models, so switching from Claude to Llama is a one-line `modelId` change).
- **Guardrails and Knowledge Bases** are built in: Bedrock Guardrails filter unsafe content; Bedrock Knowledge Bases give managed RAG (it chunks, embeds, and retrieves for you).

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🤖 your app<span class="sub">IAM role</span></span>
    <span class="darr">→<span class="lbl">Converse API</span></span>
    <span class="dbox purple">🧠 Bedrock<span class="sub">Claude · Llama · Nova</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ completion<span class="sub">stays in-region</span></span>
  </div>
  <div class="dcap">One IAM-authed endpoint fronts many models; data never leaves your AWS region.</div>
</div>

## Concrete example

Calling Claude via the unified Converse API — note there is **no API key**, boto3 uses the IAM role:

```python
import boto3

client = boto3.client("bedrock-runtime", region_name="me-central-1")  # UAE region

resp = client.converse(
    modelId="anthropic.claude-3-5-sonnet-20241022-v2:0",
    messages=[{"role": "user", "content": [{"text": "Summarize UAE VAT in one sentence."}]}],
    inferenceConfig={"maxTokens": 200, "temperature": 0.2},
)

print(resp["output"]["message"]["content"][0]["text"])
print(resp["usage"])   # inputTokens / outputTokens for cost tracking
```

To switch models you change only `modelId` to e.g. `meta.llama3-...` — the request shape stays the same. Costs are per-token (input and output priced separately), and `resp["usage"]` gives you the exact counts to log for budgeting.

## How a company uses this

A Dubai bank builds its internal document-Q&A assistant entirely on Bedrock: Claude via the Converse API for generation, **Bedrock Guardrails** to block PII leakage and off-topic answers, and a **Bedrock Knowledge Base** over policy PDFs in [S3](s3-iam.md) for retrieval. Because everything runs inside their AWS account in `me-central-1`, customer data never leaves the UAE — satisfying the regulator without the bank standing up its own GPU fleet. Access is governed by IAM: only the assistant's ECS task role can invoke the model, and CloudWatch logs every call for audit. At ~thousands of queries a day, per-token pricing stays predictable and there are no idle-GPU costs.

## Common mistakes
- **Not requesting model access first** — in the Bedrock console you must enable each model for your account before `InvokeModel` works.
- **Wrong region** — models differ by region; a `modelId` available in `us-east-1` may not be in `me-central-1`. Check availability.
- **Reaching for API keys** — Bedrock is IAM-only; if you're hunting for a key, you're doing it wrong.
- **Ignoring `usage` tokens** — you can't control cost you don't measure.

## Interview tip
Say: *"For Dubai enterprises I'd default to Bedrock over a direct OpenAI call: it's IAM-authed so there's no key to leak, data stays in the UAE region for compliance, and the Converse API lets me swap Claude for Llama with a one-line change. I'd add Bedrock Guardrails and log token usage for cost control."* That ties the tech directly to why regulated employers choose it. Next: [ECS / App Runner](ecs-app-runner.md).
