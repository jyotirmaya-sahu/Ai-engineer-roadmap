# v11 · Embeddings-Powered Similar Tickets

**What you'll build:** while an agent views a new ticket, HelpDesk finds semantically similar solved tickets and shows their resolution summaries—without requiring identical keywords.

## Why this version

Support teams repeatedly solve variations of the same problem. Keyword search misses “parcel marked delivered but absent” when the old ticket says “shipment never arrived.” Embeddings turn meaning into vectors, so related wording can be compared. This is a small, observable use of the Embeddings API before the full RAG phase.

## The mechanism

When a ticket is resolved, combine its category, sanitized customer description, and resolution summary into one text. Send that text to an embedding model and store the returned vector beside the ticket. When a new ticket arrives, embed its description, compare it with stored vectors, filter by tenant and permissions, and return the closest few results.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">new ticket text</span><span class="darr">→</span><span class="dbox purple">embedding model</span><span class="darr">→</span><span class="dbox orange">query vector</span><span class="darr">→</span><span class="dbox blue">pgvector search</span><span class="darr">→</span><span class="dbox green">similar solved cases</span>
  </div>
  <div class="dcap">Similarity proposes useful precedents; it does not automatically copy their resolution.</div>
</div>

## Concrete implementation

```python
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def embed_ticket(text: str) -> list[float]:
    clean = redact_pii(text.strip())
    if not clean:
        raise ValueError("Cannot embed empty ticket text")
    clean = truncate_to_tokens(clean, model="text-embedding-3-small", limit=8_000)
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=clean,
        encoding_format="float",
    )
    return response.data[0].embedding

async def similar_tickets(tenant: TenantContext, description: str):
    vector = await embed_ticket(description)
    return await db.fetch_all("""
        select id, category, resolution_summary,
               1 - (embedding <=> :vector) as similarity
        from tickets
        where organization_id = :org and status = 'resolved'
          and embedding_version = :version
          and 1 - (embedding <=> :vector) >= :minimum_similarity
        order by embedding <=> :vector
        limit 5
    """, {"vector": vector, "org": tenant.organization_id,
           "version": EMBEDDING_VERSION,
           "minimum_similarity": evaluated_threshold})
```

Enable pgvector and add a `vector(1536)` column when using the model's default dimensions, plus `embedding_version`, `embedding_input_hash`, and an HNSW cosine index. Register pgvector with the database driver so a Python vector binds correctly. Derive the organization from `TenantContext`, apply role/team visibility before ranking, and use Row Level Security as defense in depth. Record the model, dimensions, redaction version, and input-template version. Edits and deletion mark/remove the vector; a model change uses backfill, dual-read evaluation, then cutover. Truncate by tokens—not characters—and never embed secrets, payment data, or raw identity documents.

Create a small evaluation set: 30 new tickets with human-labelled related cases. Measure recall@5—how often at least one useful case appears in the first five results. Tune the text composition and similarity threshold from that evidence. A low score should show “No strong matches,” not an irrelevant confident suggestion.

## How a company uses this

At 100,000 solved tickets, exact comparison against every vector becomes slow. PostgreSQL with pgvector and an HNSW index is sufficient for this capstone and many real teams. Filter by organization, language, category, and access policy before ranking. Monitor search latency, empty-result rate, agent clicks, accepted suggestions, and cases where an old resolution caused harm.

## Common mistakes

- Comparing vectors produced by different models or dimensions.
- Using similarity as authorization and leaking another tenant's ticket.
- Embedding an entire noisy conversation instead of a clean problem/resolution summary.
- Picking a threshold without labelled examples.
- Automatically applying an old resolution to a new customer.

## Interview tip

Say that embeddings generate candidates, while business filters and human judgment decide whether a precedent is safe. Mention tenant filtering before vector ranking and an offline recall@k evaluation.

## Practice — assignments

1. Embed newly resolved tickets and store their model version.
2. Show five similar tickets for a new description.
3. Prevent results from crossing organization boundaries.
4. Build a labelled 30-query evaluation set and calculate recall@5.
5. Add a minimum similarity threshold and empty state.
6. Re-embed records after changing the input template.
7. Track when an agent opens or accepts a suggested resolution.
