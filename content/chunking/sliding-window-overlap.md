# Sliding Window / Overlap

**The one-line idea:** let each chunk repeat the tail end of the previous chunk, so a fact sitting on a cut line survives whole in at least one chunk.

## Why it matters for an AI Engineer

Chunking (see **Fixed-Size Chunking**) has one fatal flaw: cuts land in the middle of thoughts. A sentence like *"The refund window is 14 days"* can get split so that "The refund window is" ends chunk 3 and "14 days" starts chunk 4 — and now *neither* chunk answers "how long is the refund window?". Overlap is the cheap, universal fix. It costs a little extra storage and embedding money in exchange for far fewer broken answers. In an interview or on the job, "how much overlap?" is a decision you'll defend constantly, because it's the single easiest knob to turn to rescue recall.

## The mechanism / how it works

Instead of chunks that butt up against each other end-to-end, you **slide a window** across the text and let consecutive windows share some text. Two numbers control it:

- **chunk_size** — how big each window is (e.g. 1000 characters).
- **chunk_overlap** — how much the next window backs up before continuing (e.g. 200 characters).

Your **net advance** per chunk = `chunk_size − chunk_overlap`. With 1000/200 you move forward 800 characters each step, so the last 200 characters of every chunk are also the first 200 of the next. Any fact shorter than the overlap window is guaranteed to appear intact in at least one chunk.

<div class="diagram">
  <div class="dstack">
    <span class="dbox orange wide">Chunk 1 ── chars 0 → 1000</span>
    <span class="dbox orange wide">Chunk 2 ── chars 800 → 1800</span>
    <span class="dbox orange wide">Chunk 3 ── chars 1600 → 2600</span>
  </div>
  <div class="dcap">Each chunk backs up 200 chars — the shaded tail of one is the head of the next.</div>
</div>

**How much overlap?** The common rule is **10–20% of chunk size**. Too little and boundary facts still break; too much and you're paying to embed and store the same text many times (50% overlap literally doubles your chunk count and embedding bill). The right amount depends on how long your key facts are: dense legal or financial text with long qualifying clauses wants more overlap than chatty FAQ text.

## Concrete example

Every LangChain splitter takes `chunk_overlap`, so you rarely implement this by hand — but seeing the arithmetic makes it click:

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

text = "A" * 2600  # pretend this is 2,600 characters of document

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)
chunks = splitter.split_text(text)

print(f"{len(chunks)} chunks")           # 3 chunks
# net advance = 1000 - 200 = 800 chars/chunk
# starts at 0, 800, 1600 -> 3 windows cover 2,600 chars
```

Drop `chunk_overlap` to 0 and a fact on the 1000-char boundary is gone. Raise it to 500 and you get more safety but roughly *double* the chunks, doubling embedding cost for marginal gain.

## How a company uses this

A Dubai legal-tech firm indexing contracts sets overlap high (say 25%) on purpose: obligations in contracts read as long conditional clauses — *"In the event that the Lessee fails to remit payment within thirty (30) days, the Lessor may…"* — and a mid-clause cut would strand the condition from its consequence. They trade extra storage for the guarantee that each clause survives whole in some chunk. A consumer FAQ bot, by contrast, keeps overlap at 10% because its facts are short and the corpus is huge, so storage matters more.

## Common mistakes / misconceptions

- **Overlap ≥ chunk_size.** This makes net advance zero or negative and the splitter never progresses (or errors). Overlap must be well under chunk size.
- **Cranking overlap to "be safe."** 50% overlap doubles cost for tiny gain. Match overlap to how long your facts are, not to anxiety.
- **Thinking overlap fixes bad boundaries.** Overlap *hides* bad cuts by duplication; it doesn't produce *meaningful* chunks. For real boundary awareness use **Recursive** or **Semantic Chunking**.
- **Forgetting duplicates at retrieval.** Because the same sentence lives in two chunks, top-k results can be near-duplicates. De-dup or use a re-ranker if it clutters the context.

## Interview tip

Have a number ready: *"I default to 10–20% overlap — e.g. 200 chars on a 1000-char chunk — and I raise it for documents with long clauses like contracts."* Then add the cost caveat: *"Overlap multiplies embedding and storage cost, so I don't go past what my longest atomic fact needs."* Showing you understand the *cost/recall trade-off* (see **Chunk Size vs Recall**) separates you from someone who just copied a tutorial's numbers.
