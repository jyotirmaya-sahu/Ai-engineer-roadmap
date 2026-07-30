# pgvector

**What it is:** **pgvector** — an extension that adds a `vector` column type and similarity search **to PostgreSQL**, the database you (or your company) probably already run. It turns your normal SQL database into a vector database.

## Why it matters for an AI Engineer

The most underrated answer to "which vector DB?" is: **"the Postgres we already have."** With pgvector you store embeddings *right next to* your real business data — users, orders, documents — and search them with plain SQL. No new service, no data syncing, no extra bill, and you get transactions, joins, backups, and access control for free. Enterprises and cautious teams (banks in Dubai, for instance) love this because it means **no new vendor to approve**. Naming pgvector in an interview signals pragmatism over hype.

## The mechanism — how it works

You `CREATE EXTENSION vector`, add a `vector(dim)` column, insert embeddings as rows, and query with special **distance operators**:

| Operator | Distance | Use for |
|---|---|---|
| `<=>` | **cosine** | normalized text embeddings (most RAG) |
| `<#>` | negative inner product (dot) | when you want max dot |
| `<->` | Euclidean (L2) | geometric distance |

<div class="diagram">
  <div class="flow">
    <span class="dbox blue wide">🗄️ Postgres table<span class="sub">id, text, metadata, embedding vector(1536)</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">ORDER BY embedding &lt;=&gt; query</span>
    <span class="darr">→</span>
    <span class="dbox green">LIMIT k rows</span>
  </div>
  <div class="dcap">Vector search is just an ORDER BY on a distance operator — alongside normal WHERE clauses and JOINs.</div>
</div>

The huge win: your **metadata filter is just a SQL `WHERE`**, and you can `JOIN` to other tables — no separate metadata system. For speed at scale, build an **HNSW index** (`USING hnsw`) so search is approximate-but-fast instead of scanning every row ([see indexes](flat-ivf-hnsw.md)). Match the index's operator class (`vector_cosine_ops`) to the operator you query with.

## Concrete example

```python
import psycopg, numpy as np
from pgvector.psycopg import register_vector
from openai import OpenAI
oai = OpenAI()

def embed(t):
    v = np.array(oai.embeddings.create(model="text-embedding-3-small", input=t).data[0].embedding)
    return v / np.linalg.norm(v)          # normalize → cosine behaves well

conn = psycopg.connect("postgresql://localhost/app")
conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
register_vector(conn)
conn.execute("""CREATE TABLE IF NOT EXISTS docs
                (id serial PRIMARY KEY, text text, topic text, embedding vector(1536))""")
conn.execute("CREATE INDEX IF NOT EXISTS docs_hnsw ON docs "
             "USING hnsw (embedding vector_cosine_ops)")     # fast ANN index

for txt, topic in [("Golden Visa lasts 10 years.", "visa"), ("Refunds take 14 days.", "refund")]:
    conn.execute("INSERT INTO docs (text, topic, embedding) VALUES (%s,%s,%s)",
                 (txt, topic, embed(txt)))
conn.commit()

q = embed("How long is the Golden Visa valid?")
row = conn.execute(
    "SELECT text FROM docs WHERE topic = %s ORDER BY embedding <=> %s LIMIT 1",
    ("visa", q),
).fetchone()
print(row[0])   # → "Golden Visa lasts 10 years."
```

Vector search (`<=>`) and a metadata filter (`WHERE topic=...`) live in **one SQL statement** — that's the pgvector superpower.

## How a company usage

A Dubai bank already runs PostgreSQL for accounts and stringent data-governance rules forbid new external services. They add pgvector to the *same* database: customer-support documents get an `embedding` column, and the RAG bot searches them with SQL that also `JOIN`s customer entitlements so a user only ever retrieves documents they're allowed to see. Vector search inherits the bank's existing backups, encryption, and audit — zero new vendor risk.

## Common mistakes / misconceptions

- **Index/operator mismatch** — an HNSW index built with `vector_cosine_ops` only accelerates `<=>` queries; use `<->` and it won't help.
- **No index on a big table** — queries scan every row and crawl; add HNSW past a few thousand rows.
- **Wrong `vector(dim)`** — must equal the embedder's dimension.
- **Forgetting `register_vector`** in psycopg, so vectors don't serialize right.
- **Assuming Postgres can't scale for this** — pgvector handles millions of vectors comfortably; you're not "settling."

## Interview tip

Lead with pragmatism: *"If the team already runs Postgres, I'd start with pgvector — embeddings beside the business data, metadata filters and JOINs in plain SQL, HNSW index for speed, and no new vendor to onboard. I'd only add a dedicated vector DB if scale or features demanded it."* That answer reads as senior. Compare [Pinecone](pinecone.md) and [Chroma](chroma.md).
