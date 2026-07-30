# S3 · IAM

**What it is:** S3 is AWS's near-infinite object storage (where your documents, models, and datasets live), and IAM is the permission system that decides exactly who and what is allowed to touch them.

## Why it matters for an AI Engineer

Every AI app stores things: uploaded PDFs for RAG, model weights, embeddings backups, logs. **S3** is where they go. And every one of those must be *secured* — a misconfigured bucket is the single most common cause of enterprise data leaks, and in Dubai's regulated sectors that's a serious compliance breach. **IAM** is how you grant *least-privilege* access so your Lambda can read one bucket and nothing else. Together they're the storage-and-security backbone of an AWS AI system, and interviewers expect you to speak IAM fluently.

## How it works

**S3** stores **objects** (files) in **buckets** (globally-named containers). It's not a filesystem — it's a flat key-value store where the "path" (`docs/2026/contract.pdf`) is just the key. Properties that matter: unlimited scale, high durability (data is replicated across facilities), cheap, and every object has a URL (private by default). You put/get objects via SDK, and pick a **region** (`me-central-1` for UAE data residency).

**IAM** governs access with a few building blocks:

- **Policy** — a JSON document listing allowed (or denied) **actions** (e.g. `s3:GetObject`) on specific **resources** (a bucket ARN), optionally with conditions.
- **Role** — an identity a *service* assumes (your ECS task or Lambda). The service gets temporary credentials automatically — **no keys stored anywhere**. This is why [Bedrock](bedrock.md) and everything else prefers roles.
- **User** — an identity for a *human*, with long-lived credentials (use sparingly).

The golden rule is **least privilege**: grant the *minimum* actions on the *specific* resources needed, nothing more. `s3:*` on `*` is the classic dangerous mistake.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🤖 ECS task<span class="sub">assumes role</span></span>
    <span class="darr">→<span class="lbl">IAM policy: GetObject on THIS bucket only</span></span>
    <span class="dbox blue">🗄️ S3 bucket<span class="sub">docs/</span></span>
  </div>
  <div class="dcap">The role grants exactly one action on exactly one bucket — least privilege, no stored keys.</div>
</div>

## Concrete example

Using S3 from your app (credentials come from the task's IAM role — no keys in code):

```python
import boto3
s3 = boto3.client("s3", region_name="me-central-1")

s3.upload_file("contract.pdf", "my-docs-bucket", "docs/contract.pdf")
s3.download_file("my-docs-bucket", "docs/contract.pdf", "/tmp/contract.pdf")
```

The least-privilege IAM policy attached to that task's role — read-only, one bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::my-docs-bucket",
      "arn:aws:s3:::my-docs-bucket/*"
    ]
  }]
}
```

This role can list and read `my-docs-bucket` and *nothing else* — no write, no delete, no other bucket. If the container is ever compromised, the blast radius is one bucket, read-only.

## How a company uses this

A Dubai insurance firm stores millions of claim documents in S3 (`me-central-1`, so data stays in the UAE). Buckets have **public access fully blocked** and **encryption at rest** (KMS) on by default. The RAG service's ECS task runs under a role that can only *read* the documents bucket and *write* to a separate `results/` bucket — it physically cannot delete source data. The ingestion [Lambda](lambda.md) has its own narrower role. Access is audited via CloudTrail, so every `GetObject` is logged for compliance reviews. When auditors ask "who can read claims data?", the answer is a short list of named roles — not "everyone with the account password."

## Common mistakes
- **Wildcard policies** — `s3:*` on `Resource: "*"` grants everything; scope to specific actions and ARNs.
- **Public buckets** — leaving "Block Public Access" off leaks data to the internet. Keep it on.
- **Long-lived access keys in code/env** — use roles; they rotate credentials automatically.
- **Treating S3 like a filesystem** — no real folders, no in-place append; it's object put/get by key.
- **Forgetting `ListBucket` on the bucket ARN** — `GetObject` alone can't list; you need both ARNs.

## Interview tip
Say: *"I store documents and models in S3 in me-central-1 for UAE data residency, with public access blocked and KMS encryption on. Access is via IAM *roles* with least privilege — the RAG task can read one bucket and write to another, nothing else — so there are no stored keys and a compromise's blast radius is tiny."* Saying "least privilege" and "roles not keys" is exactly the security literacy employers screen for. Next group: [Azure / AzureML](azure-azureml.md).
