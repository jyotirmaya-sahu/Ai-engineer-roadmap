# MS Fabric

**What it is:** Microsoft Fabric is a single, unified data-and-analytics platform on Azure that bundles data engineering, warehousing, and BI into one product — with a shared storage layer called **OneLake** — so an organization's data lives in one place instead of a dozen disconnected tools.

## Why it matters for an AI Engineer

Fabric isn't an LLM tool — it's a *data* platform — but it appears in Dubai JDs because data-heavy enterprises already on Microsoft (banks, telcos, government) are consolidating onto it, and AI features increasingly *feed off* it. As an AI Engineer you care about Fabric as the **source of clean, governed data** for your RAG and analytics pipelines, and because its built-in **Copilot** and Power BI Q&A features are literally LLM applications over enterprise data. You need to recognize it and know where it plugs into an AI system — not operate it deeply.

## How it works

Fabric's organizing idea is **OneLake**: one logical data lake for the whole tenant, storing everything in the open **Delta/Parquet** format. Instead of copying data between a warehouse, a lake, and a BI tool, every Fabric workload reads and writes the *same* OneLake copy. The key mechanism is **shortcuts** — a workload can reference data sitting elsewhere (even in [S3](s3-iam.md) or [GCS](gcp.md)) *without physically moving it*, so there's "one copy of the truth."

On top of OneLake sit unified **workloads**: Data Engineering (Spark notebooks), Data Warehouse (SQL), Data Factory (pipelines/ETL), Real-Time Intelligence, and **Power BI** for dashboards. All share the same storage and the same **governance** (via Microsoft Purview) and identity (**Entra ID**).

For AI specifically: **Copilot in Fabric** lets analysts ask questions in natural language and get SQL, code, or charts — an LLM grounded on OneLake data. And OneLake is a natural, governed source you'd pull from to build a RAG index over structured enterprise data.

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">🗄️ OneLake<span class="sub">one copy · Delta/Parquet</span></span>
    <span class="darr">↓<span class="lbl">shared by every workload</span></span>
    <span class="dbox orange">Data Eng · Warehouse · Pipelines · Power BI</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 Copilot / your RAG index<span class="sub">grounded on OneLake</span></span>
  </div>
  <div class="dcap">One governed lake underneath; analytics, BI, and AI all read the same single copy of the data.</div>
</div>

## Concrete example

You rarely write low-level code *for* Fabric as an AI engineer — you consume it. A common pattern is reading a governed Delta table out of OneLake to build a retrieval index:

```python
# In a Fabric Spark notebook: read a governed table from OneLake
df = spark.read.format("delta").load(
    "abfss://workspace@onelake.dfs.fabric.microsoft.com/Sales.Lakehouse/Tables/contracts"
)

# Turn rows into text records to embed for a RAG index
records = [f"{r.title}: {r.summary}" for r in df.select("title", "summary").collect()]
# -> embed `records` (Azure OpenAI) and load into your vector store
```

The point: OneLake is the *trusted, governed* source. Because it's standard Delta/Parquet, the same data is reachable from Spark, plain SQL, or an external engine — no bespoke export step, and lineage/permissions are already enforced by Fabric.

## How a company uses this

A Dubai telco consolidates billing, network, and CRM data into **OneLake** on Fabric, governed centrally through Purview and Entra ID. Business analysts use **Power BI + Copilot** to ask "why did churn rise in Q2?" in plain English and get charts — an LLM experience over their own governed data. Separately, the AI team builds a customer-support assistant by pulling clean, permissioned records from OneLake to feed a [Bedrock](bedrock.md)- or Azure-OpenAI-backed RAG index — reusing Fabric's data governance instead of re-inventing access control. Fabric is the *data foundation*; the AI apps sit on top of it. For the AI Engineer, it means the hardest part — trustworthy, governed source data — is already solved.

## Common mistakes
- **Thinking Fabric is an LLM/serving platform** — it's a data+analytics platform; the AI lives on top of it.
- **Copying data out of OneLake unnecessarily** — use shortcuts; the whole design is "one copy."
- **Ignoring governance** — its value is Purview/Entra lineage and permissions, not just storage.
- **Over-studying it for a pure AI-engineer role** — recognize it and know the integration point; go deep only if the JD is data-platform-heavy.

## Interview tip
Say: *"Microsoft Fabric is a unified data platform built on OneLake — one governed copy of the org's data in Delta format, shared by warehousing, BI, and AI. As an AI engineer I treat it as the trusted source for my RAG and analytics pipelines, and its Copilot/Power BI Q&A are LLM apps over that data. I recognize where it plugs in rather than operating it end to end."* That correctly places Fabric as the data foundation under your AI work — which is exactly how enterprises use it.

---

*This completes the Containers & Cloud node. Return to the [overview](../containers-cloud.md) or move on to Inference & Serving.*
