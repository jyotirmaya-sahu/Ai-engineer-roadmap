# Azure / AzureML

**What it is:** Azure is Microsoft's cloud, and Azure Machine Learning (AzureML) is its managed ML platform — most relevant to AI Engineers through **Azure OpenAI Service**, which serves GPT models inside Microsoft's compliance-grade cloud.

## Why it matters for an AI Engineer

AWS dominates Dubai, but Microsoft is the strong #2 — plenty of Dubai enterprises, especially those already on Microsoft 365, Teams, and Dynamics, standardize on Azure. If a bank or government body is a "Microsoft shop," their AI runs on **Azure OpenAI**, not the direct OpenAI API, for the same data-residency and compliance reasons Dubai firms choose Bedrock on AWS. You don't need Azure mastery for most roles, but you must be able to recognize it, map its services to their AWS equivalents, and speak to it in an interview.

## How it works

The service you'll actually touch is **Azure OpenAI Service**: OpenAI's models (GPT-4o and successors, embeddings) served from *your* Azure resource, in *your* region, under Microsoft's enterprise agreements. Data isn't used to train models and stays in-region — the compliance story that gets it into regulated environments.

The mechanics differ from calling OpenAI directly in one key way: you don't just pick a model name, you create a **deployment** — a named instance of a model inside your Azure resource — and call *that*. Auth is via an Azure API key or, better, **Microsoft Entra ID** (Azure's identity system, the equivalent of AWS IAM roles).

Map Azure to what you already know:

| Azure | AWS equivalent | Role |
|---|---|---|
| Azure OpenAI | [Bedrock](bedrock.md) | managed LLM API |
| Blob Storage | [S3](s3-iam.md) | object storage |
| Container Apps / AKS | [ECS](ecs-app-runner.md) | run containers |
| Azure Functions | [Lambda](lambda.md) | serverless |
| Entra ID | IAM | identity & access |

**AzureML** itself is the broader platform — training pipelines, model registry, managed endpoints for deploying models — used more by classic ML/data-science teams than by LLM-app engineers.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🤖 your app<span class="sub">Entra ID</span></span>
    <span class="darr">→<span class="lbl">call the deployment</span></span>
    <span class="dbox purple">🧠 Azure OpenAI<span class="sub">GPT-4o deployment</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ completion<span class="sub">in-region</span></span>
  </div>
  <div class="dcap">You call a named model *deployment* inside your Azure resource, not a global model endpoint.</div>
</div>

## Concrete example

Calling a GPT-4o deployment on Azure OpenAI — note you target your *deployment name*, not `gpt-4o` directly:

```python
from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint="https://my-resource.openai.azure.com/",
    api_key="...",                 # or use Entra ID token auth
    api_version="2024-10-21",
)

resp = client.chat.completions.create(
    model="gpt4o-prod",            # your DEPLOYMENT name, not the model name
    messages=[{"role": "user", "content": "One-line summary of UAE Corporate Tax."}],
)
print(resp.choices[0].message.content)
```

The same `openai` SDK works — you just swap in `AzureOpenAI`, point at your resource endpoint, and reference the deployment. That portability is deliberate: teams can move between OpenAI and Azure OpenAI with minimal code change.

## How a company uses this

A Dubai professional-services firm runs everything on Microsoft 365 and Teams, so its internal "policy assistant" is built on **Azure OpenAI** in the UAE North region: a GPT-4o deployment for answers, **Blob Storage** for documents, **Container Apps** running the FastAPI backend, and **Entra ID** controlling access — the exact same architecture shape as an AWS build, just with Microsoft services. Because staff already log in with Entra ID, the assistant reuses that identity for auth and per-user access control, and IT governs it through the same admin console they already use for email and Teams. Choosing Azure here was about fitting the existing Microsoft estate, not model quality.

## Common mistakes
- **Passing the model name instead of the deployment name** — Azure OpenAI calls target a *deployment*; using `gpt-4o` fails.
- **Assuming OpenAI regions/models = Azure ones** — model and region availability differ; check your resource.
- **Ignoring `api_version`** — Azure OpenAI is versioned by date; an old value can break calls.
- **Over-investing in Azure for Dubai** — lead with AWS; keep Azure as "I can map and use it."

## Interview tip
Say: *"AWS is my default for Dubai, but I can work in Azure — for Microsoft-shop clients I'd use Azure OpenAI, where you call a named model deployment via the same openai SDK, with Blob Storage as S3, Container Apps as ECS, and Entra ID as IAM. It's the same architecture, mapped to Microsoft services."* Fluent AWS-to-Azure mapping shows breadth without pretending Azure is your focus. Next: [GCP](gcp.md).
