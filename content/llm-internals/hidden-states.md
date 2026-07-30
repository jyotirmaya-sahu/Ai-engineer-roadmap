# Hidden States

**What it is:** The stack of internal vectors an LLM builds for every token as it flows up through the layers — the model's evolving "understanding" of each word, before it ever becomes text again.

## Why it matters for an AI Engineer

Hidden states are where meaning actually lives inside the model. You never see them in a normal chat API, but they explain three things you deal with constantly: **embeddings** (used for RAG/semantic search are hidden states pulled out of a model), **why bigger models "understand" more** (wider hidden states = more room to encode nuance), and **why the KV cache eats GPU memory** (the cache stores hidden-state-derived vectors for every token). If someone asks "where do embeddings come from?", the honest answer is: they're hidden states.

## The mechanism

Each token starts as a plain embedding — a lookup vector, e.g. 4096 numbers, that means roughly "this is the word *bank*" with no context. Then it enters the Transformer stack. At **every layer**, self-attention lets the token pull in information from other tokens, and the feed-forward network reshapes it. The output is a new vector for that token — its **hidden state at that layer**.

So a single token has *one hidden state per layer*. A 32-layer model produces 32 hidden states per token as it moves up the stack, each richer than the last.

<div class="diagram">
  <div class="dstack">
    <span class="dbox gray">Embedding: 'bank'<span class="sub">no context</span></span>
    <span class="dbox purple">Layer 1 hidden state</span>
    <span class="dbox purple">Layer 2 hidden state</span>
    <span class="dbox purple">... layers ...</span>
    <span class="dbox green">Final hidden state<span class="sub">'bank' = riverbank</span></span>
    <span class="dbox yellow">🔢 Logits / next token</span>
  </div>
  <div class="dcap">One hidden state per layer: a context-free embedding gets refined layer by layer until 'bank' resolves to riverbank.</div>
</div>

**What they encode, roughly:**
- **Early layers:** surface features — spelling, part of speech, simple word identity.
- **Middle layers:** syntax and relationships — who did what to whom, which noun a pronoun refers to.
- **Late layers:** task-and-meaning-specific information — the model has resolved "bank" to *riverbank* using nearby words like "river", and is lining up what token comes next.

The vector for "bank" in "river bank" ends up in a *different place* in the hidden space than "bank" in "money bank" — same starting embedding, different final hidden state. That contextualization is the whole point.

## Concrete example

With Hugging Face `transformers` you can literally see them:

```python
from transformers import AutoModel, AutoTokenizer
tok = AutoTokenizer.from_pretrained("bert-base-uncased")
model = AutoModel.from_pretrained("bert-base-uncased", output_hidden_states=True)

inputs = tok("river bank", return_tensors="pt")
out = model(**inputs)
print(len(out.hidden_states))       # 13 = embedding layer + 12 transformer layers
print(out.hidden_states[-1].shape)  # [1, 4, 768] -> 4 tokens, 768-dim final states
```

That `[..., 768]` vector per token is a hidden state. Mean-pool them and you have a sentence **embedding** for search.

## How this shows up in production

- **Embeddings for RAG:** Text-embedding models (OpenAI `text-embedding-3`, Cohere, `bge`) are just Transformers whose hidden states you extract and store in a vector DB. Semantic search *is* comparing hidden states.
- **Probing / interpretability:** Teams inspect hidden states to debug why a model refuses or hallucinates, and steering methods nudge hidden states to control behavior.
- **KV cache memory:** At inference the server caches Key/Value projections (derived from hidden states) for every past token — this is the dominant memory cost and caps how many concurrent requests fit on a GPU.

## Common misconceptions

- **"The hidden state is the embedding."** The *input* embedding is context-free. Hidden states are *contextualized* — they change based on surrounding tokens. The final hidden state is what you usually want for search.
- **"There's one hidden state per token."** There's one *per layer* per token. When people say "the" hidden state, they mean the last layer's.
- **"Hidden states are human-readable."** They're not. They're dense numeric vectors; interpretability is an active research effort, not a lookup.

## Interview tip

Say: *"A hidden state is a token's contextualized vector at a given layer. It starts as a context-free embedding and gets progressively refined by attention + FFN at each layer — early layers capture syntax, later layers capture meaning and task signal. Embedding models expose these hidden states so we can do semantic search."* Mentioning that embeddings-for-RAG are literally pooled hidden states shows you connect internals to real systems.
