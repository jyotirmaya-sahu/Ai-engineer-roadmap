# GCP

**What it is:** Google Cloud Platform is Google's cloud, most relevant to AI Engineers through **Vertex AI** — its managed platform for calling Google's Gemini models and deploying ML — and its strong data/analytics stack (BigQuery).

## Why it matters for an AI Engineer

GCP is the #3 cloud in Dubai, behind AWS and Azure, but it shows up in specific places: teams that want **Gemini** models, data-heavy shops that live in **BigQuery**, and startups on Google's stack. You won't lead with GCP for most Dubai roles, but you should recognize it, know how it maps to AWS, and be able to call Gemini via Vertex AI. Treat it as breadth — enough to be useful on a Google-stack team, not your primary skill.

## How it works

The AI-relevant pieces:

- **Vertex AI** — the managed hub. It serves **Gemini** models (and others via Model Garden), provides managed **Vector Search** for RAG, and hosts custom-model endpoints. Auth is via a **service account** (GCP's role equivalent), so your app uses attached credentials, not a raw key.
- **Gemini API** — Google's frontier models. Note there are two front doors: **Vertex AI** (enterprise, IAM-governed, region-controlled — what companies use for compliance) and **Google AI Studio** (a simpler API-key path for prototyping). For regulated Dubai work, Vertex is the enterprise route.
- **BigQuery** — a serverless data warehouse that queries terabytes of data with SQL in seconds; often the *source* data for an AI pipeline.

Map GCP to what you know:

| GCP | AWS equivalent | Role |
|---|---|---|
| Vertex AI (Gemini) | [Bedrock](bedrock.md) | managed LLM API |
| Cloud Storage (GCS) | [S3](s3-iam.md) | object storage |
| Cloud Run | [App Runner](ecs-app-runner.md) | run a container, get a URL |
| Cloud Functions | [Lambda](lambda.md) | serverless |
| Service accounts / IAM | IAM | identity & access |

**Cloud Run** deserves a note: it's a beloved way to deploy a container — push an image, get an auto-scaling HTTPS URL that scales to zero — very close to AWS App Runner, and a genuinely nice deploy target.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🤖 your app<span class="sub">service account</span></span>
    <span class="darr">→<span class="lbl">Vertex AI</span></span>
    <span class="dbox purple">🧠 Gemini</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ completion<span class="sub">in-region</span></span>
  </div>
  <div class="dcap">Vertex AI is GCP's Bedrock — call Gemini through it, authed by a service account, not a key.</div>
</div>

## Concrete example

Calling Gemini through Vertex AI (credentials come from the service account, no API key in code):

```python
from google import genai

# Vertex mode: uses the environment's service-account credentials
client = genai.Client(vertexai=True, project="my-project", location="me-central2")

resp = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Summarize the UAE golden visa in one sentence.",
)
print(resp.text)
```

Deploying a container to **Cloud Run** is a one-liner once your image is in Artifact Registry:

```bash
gcloud run deploy ai-service \
  --image me-central2-docker.pkg.dev/my-project/repo/my-ai-service:v1 \
  --region me-central2 --port 8000 --allow-unauthenticated
```

That returns an HTTPS URL with auto-scaling to zero — the same shape as App Runner, reusing all your Docker knowledge.

## How a company uses this

A Dubai analytics startup already stores its event data in **BigQuery**, so building on GCP is natural: a nightly job pulls features from BigQuery, a **Cloud Run** service hosts the RAG API, **Vertex AI** serves Gemini for generation and hosts **Vector Search** for retrieval, and everything is governed by service-account IAM. Because their data gravity is in BigQuery, keeping the AI layer on the same cloud avoids cross-cloud egress costs and latency. For a team whose center of gravity is Google's data stack, this is simpler than bolting AWS onto it — the cloud choice follows where the data already lives.

## Common mistakes
- **Confusing AI Studio and Vertex** — the API-key AI Studio path is for prototyping; enterprises use Vertex for IAM/region control.
- **Forgetting the `location`/region** — Gemini/Vertex availability is region-specific; set it explicitly.
- **Leaking service-account key files** — prefer attached credentials (Workload Identity) over downloaded JSON keys.
- **Leading with GCP for Dubai roles** — it's breadth here, not the headline; AWS first.

## Interview tip
Say: *"GCP isn't my lead for Dubai, but I can use it: Vertex AI is the Bedrock equivalent for calling Gemini, Cloud Run is a great scale-to-zero container deploy like App Runner, GCS maps to S3, and it shines when the data already lives in BigQuery. I'd pick it when a team's data gravity is on Google."* Framing cloud choice around *data gravity* signals architectural maturity. Next: [MS Fabric](ms-fabric.md).
