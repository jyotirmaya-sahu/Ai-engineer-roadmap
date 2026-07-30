# Sentence / Token-Based Chunking

**The one-line idea:** measure and cut chunks by the units the model actually cares about — whole **sentences** (for coherence) or **tokens** (for exact size limits) — instead of raw characters.

## Why it matters for an AI Engineer

Character counts are a convenient lie. Embedding models and LLMs don't read characters — they read **tokens**. An embedding model has a hard token limit (e.g. OpenAI's `text-embedding-3-small` caps at 8,191 tokens), and your generation prompt has a token budget you pay for. If you chunk by characters and guess, you can silently overflow the embedder (it truncates and you lose text) or waste budget. Chunking by *tokens* makes the limit exact; chunking by *sentences* keeps each chunk grammatically whole. Both are the "measure in the right unit" fix, and knowing why tokens ≠ characters is table-stakes for the job.

## The mechanism / how it works

**Token-based chunking.** A tokenizer (e.g. OpenAI's `tiktoken`, or a HuggingFace model's tokenizer) turns text into tokens — sub-word pieces. You then cut every N *tokens*. Now `chunk_size=256` means *exactly* 256 tokens, so you can guarantee you never exceed the embedder's window and you know precisely how much prompt budget each chunk consumes. Rough English rule: **1 token ≈ 4 characters ≈ ¾ of a word**, so 256 tokens ≈ 1000 characters ≈ 190 words — but "rough" is why you count real tokens for anything that must fit exactly.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">"Refunds within 14 days."</span>
    <span class="darr">→<span class="lbl">tokenizer</span></span>
    <span class="dbox purple">🔢 [Ref][unds][ within][ 14][ days][.]</span>
    <span class="darr">→</span>
    <span class="dbox green">count = 6 tokens</span>
  </div>
  <div class="dcap">The model sees tokens, not characters — so size chunks in tokens.</div>
</div>

**Sentence-based chunking.** Instead of counting length, split on sentence boundaries (using a sentence tokenizer like NLTK/spaCy, or a regex), then **pack** consecutive whole sentences into a chunk until adding one more would exceed your size budget. Every chunk starts and ends on a clean full stop — no mid-sentence cuts ever. It's often combined: pack *sentences* until you hit a *token* limit — the best of both.

## Concrete example

Token-based, using the tokenizer directly so the limit is exact:

```python
# pip install langchain-text-splitters tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Build a splitter whose chunk_size is measured in TOKENS, not chars:
splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    encoding_name="cl100k_base",  # tokenizer used by OpenAI embeddings
    chunk_size=256,               # 256 TOKENS per chunk
    chunk_overlap=32,             # 32 TOKENS overlap
)
chunks = splitter.split_text(open("faq.txt").read())
print(f"{len(chunks)} chunks, each ≤ 256 tokens")
```

Count tokens yourself to build intuition:

```python
import tiktoken
enc = tiktoken.get_encoding("cl100k_base")
print(len(enc.encode("The refund window is 14 days.")))  # -> 8 tokens
```

For **sentence** packing, LangChain's `SentenceTransformersTokenTextSplitter` (or NLTK/spaCy splitters) keeps sentences intact while respecting a token budget.

## How a company uses this

A Dubai company running a **local open-source embedding model** (to keep customer data on-prem for regulatory reasons) must chunk by that model's own tokenizer, because its window might be only 512 tokens — much smaller than OpenAI's. They token-chunk at, say, 480 tokens with 48 overlap so nothing ever truncates. A multilingual Arabic/English support bot leans on sentence packing because Arabic tokenizes very differently from English, and counting *sentences* keeps chunks coherent across both languages where a fixed character count would behave inconsistently.

## Common mistakes / misconceptions

- **"Characters ≈ tokens, close enough."** For Arabic, code, emoji, or long words, the ratio breaks badly — one emoji can be several tokens. Count real tokens when a limit is hard.
- **Using the wrong tokenizer.** `cl100k_base` is OpenAI's; a HuggingFace model uses its *own* tokenizer. Token counts differ. Match the tokenizer to the model you'll embed with.
- **Sentence splitting with naive `.split(".")`.** "Dr." and "3.5" break it. Use a real sentence tokenizer.
- **Forgetting overlap is in the same unit.** If chunk_size is tokens, overlap is tokens too — don't mix units.

## Interview tip

Drop the key fact early: *"I size chunks in tokens, not characters, because that's what the embedding model's window is measured in — roughly 1 token ≈ 4 English characters, but I count real tokens with the model's own tokenizer so I never overflow and silently truncate."* Then mention sentence packing for coherence. Showing you know *tokens are the true unit* is a quick, reliable competence signal.
