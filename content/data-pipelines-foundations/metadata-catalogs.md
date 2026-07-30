# Metadata Catalogs

**The one-line idea:** a searchable inventory of all your data — what tables/datasets/documents exist, where they live, what each column means, who owns it, how fresh it is, and where it came from — so people and pipelines can *discover* data, *trust* it, and *govern* it instead of guessing.

## Why it matters for an AI Engineer

As soon as a company has more than a handful of datasets, nobody knows what exists or which copy is authoritative. An AI Engineer building a RAG corpus or a feature pipeline needs to answer: *which table has the real customer data? is this dataset allowed to feed a model? how fresh is it? if I embed it, what's the source for citations?* A metadata catalog answers all of that. It's also the backbone of **governance** — proving to a Dubai auditor exactly what data your model can see and where it came from — and of **lineage**, so when a number looks wrong you can trace it back through the pipeline. Interviewers raise catalogs under governance and "how do you manage data at scale."

## The mechanism / how it works

A catalog stores **metadata** — data *about* data — in four broad kinds:

1. **Technical** — schemas, column types, table sizes, partitions, physical location.
2. **Business** — plain-language descriptions, a glossary ("what does `mrr` mean?"), tags, owners.
3. **Operational** — freshness (last updated), row counts over time, quality-check results, pipeline that produces it.
4. **Lineage** — the graph of *where data came from and where it flows*: this table is built from those two, feeds this dashboard and that vector store.

It's populated mostly by **automated crawlers/harvesters** that connect to your databases, warehouses, and pipelines and pull schemas + lineage automatically, plus human-added descriptions and ownership. On top sits **search** (find datasets by name/tag/column), a **glossary**, and **access/classification** metadata (this column is PII → restrict it, tying into [PII detection & redaction](./pii-detection-redaction.md)). Tools: **DataHub** and **OpenMetadata** (open source), Amundsen, or cloud catalogs (AWS Glue Data Catalog, Unity Catalog).

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox blue">🗄️ Warehouse</span>
      <span class="dbox blue">🗄️ Databases</span>
      <span class="dbox purple">⚙️ Pipelines</span>
    </div>
    <span class="darr">↓<span class="lbl">crawlers harvest schema + lineage</span></span>
    <span class="dbox orange">📇 Catalog<span class="sub">technical · business · operational · lineage</span></span>
    <span class="darr">↓<span class="lbl">search · glossary · governance</span></span>
    <span class="dbox green">✅ Discover · trust · govern data</span>
  </div>
  <div class="dcap">A catalog inventories every dataset with its meaning, freshness, owner, and lineage — the map of your data estate.</div>
</div>

## Concrete example

Datasets and lineage are usually described declaratively, then emitted to the catalog. A minimal DataHub-style dataset record with lineage:

```python
# Conceptual: register a dataset + its upstream lineage in the catalog
dataset = {
    "urn": "urn:li:dataset:(warehouse,analytics.customer_360,PROD)",
    "description": "One row per customer: profile + 30d spend features",
    "owner": "data-platform@bank.ae",
    "tags": ["customer", "features", "contains-pii"],
    "columns": [
        {"name": "customer_id", "type": "int", "desc": "primary key"},
        {"name": "emirates_id", "type": "string", "desc": "PII — restricted"},
        {"name": "avg_order_30d", "type": "float", "desc": "rolling 30-day avg order value"},
    ],
    "upstream": [   # lineage: what this table is built from
        "urn:li:dataset:(warehouse,raw.customers,PROD)",
        "urn:li:dataset:(warehouse,raw.orders,PROD)",
    ],
    "freshness": {"updates": "daily 02:00", "last_run": "2026-07-30T02:14Z"},
}
emit_to_catalog(dataset)   # crawlers usually populate most of this automatically
```

Now a colleague can search "customer features", see it's PII-tagged, know it refreshes daily at 2am, see it's built from `raw.customers` + `raw.orders`, and know who to ask.

## How a company uses this

A Dubai bank running dozens of AI and analytics pipelines uses OpenMetadata as the single source of truth for its data estate. When they build a new RAG assistant, engineers *start* in the catalog: search for candidate source datasets, check the `contains-pii` classification (which drives automatic redaction before embedding), confirm freshness meets the use case, and read the lineage to know which upstream feeds could break it. The catalog's highest-value moment is audit: when a regulator asks "what customer data can this model access, and where did it originate?", they answer from lineage in minutes instead of a multi-week manual trace. The governance payoff is concrete — PII columns flagged in the catalog are automatically excluded from any dataset that feeds a model, so classification happens *once* and enforces everywhere. It also kills duplicated work: teams stop rebuilding datasets that already exist because they can now *find* them.

## Common mistakes / misconceptions

- **Treating it as documentation nobody reads.** A catalog only works if it's auto-populated by crawlers and wired into workflows (discovery, PII enforcement, CI checks) — a manual wiki rots instantly.
- **Ignoring lineage.** Without lineage you can't do impact analysis ("what breaks if I change this column?") or trace a bad number to its source. Lineage is the highest-value feature.
- **No ownership.** Datasets with no owner become untrusted orphans nobody will fix. Ownership is metadata too.
- **Cataloging only tables, not AI assets.** Modern estates should catalog vector-store collections, feature-store features, and model-training datasets too — not just warehouse tables.

## Interview tip

Say: *"At scale I put a data catalog like DataHub or OpenMetadata over the estate — auto-crawled schemas, business descriptions, freshness, ownership, and especially lineage. For AI work it's where I discover trustworthy source data, and it drives governance: PII columns flagged once in the catalog are automatically excluded from anything that feeds a model, and lineage lets me answer an auditor's 'what data can this model see and where did it come from' in minutes."* Emphasizing lineage and PII-driven governance ties the catalog back to real AI-engineering and compliance work rather than treating it as a wiki.
