# Parsing CSV / Tables

**What it is:** turning tabular data — spreadsheets, CSV exports, database dumps — into text an LLM can actually reason over, which means deciding how to *serialize rows and columns* so meaning survives.

## Why it matters for an AI Engineer

Tables are where the numbers live: prices, KPIs, inventory, transactions, employee records. Businesses run on them. But LLMs read *sequences of text*, not grids. A table is a 2D structure; the model sees a 1D stream. If you flatten a table carelessly — dump raw comma-separated values into the prompt — the model loses track of which number belongs to which column, and it hallucinates. Serializing tables well is a distinct, high-value skill, and it's the bridge between the "structured data" world and the "RAG over documents" world.

## The mechanism — why a grid is hard for an LLM

Consider this table:

| Region | Q1 Revenue | Q2 Revenue |
|--------|-----------|-----------|
| Dubai  | 1.2M      | 1.5M      |
| Abu Dhabi | 0.9M   | 1.1M      |

If you strip it to `Dubai 1.2M 1.5M Abu Dhabi 0.9M 1.1M`, the model no longer knows that `1.5M` is *Q2 in Dubai*. The column headers were the meaning, and you deleted them.

The fix is to **serialize each row so headers travel with values**:

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ Table (grid)</span>
    <span class="darr">→</span>
    <span class="dbox orange">Serialize per row<span class="sub">keep header+value pairs</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ "Region: Dubai. Q2 Revenue: 1.5M."</span>
  </div>
  <div class="dcap">Keep each value glued to its column name, or the numbers lose their meaning.</div>
</div>

Good serialization strategies:
- **Row-as-sentence:** `"Region: Dubai. Q1 Revenue: 1.2M. Q2 Revenue: 1.5M."` — self-contained, great for RAG chunks (one row = one chunk).
- **Markdown table:** keep it as a small pipe-table in the prompt — LLMs read Markdown tables well when the table is small.
- **Structured query path:** for big tables, *don't* stuff them into a prompt at all — load into a database and let the LLM write SQL (text-to-SQL). RAG-stuffing a million-row table is the wrong tool.

## Concrete example

`pandas` is the workhorse. Read a CSV, then serialize each row into a self-contained sentence for chunking:

```python
# pip install pandas
import pandas as pd

df = pd.read_csv("sales.csv")

chunks = []
for _, row in df.iterrows():
    # each value stays glued to its column name
    sentence = ". ".join(f"{col}: {val}" for col, val in row.items())
    chunks.append(sentence)

print(chunks[0])
# -> "Region: Dubai. Q1 Revenue: 1.2M. Q2 Revenue: 1.5M"
```

For a small table you want the model to see whole, Markdown works well:

```python
print(df.head(20).to_markdown(index=False))
```

And for a big table, prefer letting the model query it instead of embedding it:

```python
import sqlite3
con = sqlite3.connect(":memory:")
df.to_sql("sales", con, index=False)
# now an LLM can generate: SELECT Region, "Q2 Revenue" FROM sales WHERE ...
```

## How a company uses this

A Dubai logistics firm has a shipments CSV updated hourly. For their ops assistant, small lookup tables (service tiers, zones) are serialized row-as-sentence and embedded for RAG. But the giant shipments table isn't embedded at all — it's loaded into a database, and the assistant answers "how many parcels to Sharjah yesterday?" by generating SQL. Choosing *per table* between RAG and text-to-SQL is the whole design.

## Common mistakes

- **Dropping headers.** The single most common table-parsing bug — values without their column names are meaningless to the model.
- **Embedding a huge table.** Ten thousand rows of numbers make terrible embeddings and blow your context. Big tables → query them, don't retrieve them.
- **Ignoring CSV edge cases.** Commas inside quoted fields, missing values, mixed encodings (UAE data often has Arabic in UTF-8). Use a real parser like pandas, never a naive `line.split(",")`.
- **Losing the table's caption/context.** "Table 3: 2025 revenue" tells the model what the numbers *are*. Attach it as metadata.

## Interview tip

The strong answer is knowing **when NOT to use RAG**: *"For small reference tables I serialize each row and embed it, but for large or numeric-heavy tables I'd use text-to-SQL — embedding a million rows gives poor retrieval and math errors."* Recognizing that tables sometimes call for querying instead of retrieval sets you apart from candidates who apply RAG to everything.
