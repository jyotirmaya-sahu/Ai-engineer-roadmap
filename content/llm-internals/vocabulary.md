# Vocabulary

**What it is:** The fixed, finite set of tokens a model knows — every piece of text it can read or write must be built from this list of IDs.

## Why it matters for an AI Engineer

The vocabulary is the model's alphabet. Its size shows up as a real engineering tradeoff: a **bigger vocab** means shorter sequences (cheaper, faster context) but a heavier model (the embedding and output-projection matrices scale with vocab size). It also explains **why the same text costs different amounts on different models** (different tokenizers) and why you must use the *matching* tokenizer to count tokens for a given model. Every logit the model produces is one score per vocabulary entry — so vocab size literally sets the width of the model's output.

## The mechanism

The vocabulary is produced once, during tokenizer training (via BPE/WordPiece), and then frozen. Each entry gets an integer ID:

```
"the"  -> 279
" cat" -> 8415
"!"    -> 0
...
```

Two big matrices are tied to it:
- **Embedding table:** shape `[vocab_size × hidden_size]` — one vector per token, the lookup that turns an ID into a starting vector.
- **Output projection ("unembedding"):** shape `[hidden_size × vocab_size]` — turns the final hidden state into one logit per vocab token.

Both grow linearly with vocab size, which is why you can't just make the vocabulary huge for free.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Text</span>
    <span class="darr">→</span>
    <span class="dbox">Tokenizer</span>
    <span class="darr">→</span>
    <span class="dbox blue wide">Token IDs<span class="sub">from fixed vocab</span></span>
    <span class="darr">→</span>
    <span class="dbox">Embedding lookup</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Transformer</span>
    <span class="darr">→</span>
    <span class="dbox yellow wide">One logit per vocab entry</span>
  </div>
  <div class="dcap">The fixed vocabulary bookends the model: it maps text to IDs on the way in and sets the logit width on the way out.</div>
</div>

## The size tradeoff

- **Small vocab (e.g. 30k, older BERT):** lighter matrices, but text fragments into more tokens → longer sequences → more compute per sentence.
- **Large vocab (e.g. 100k–256k, modern LLMs):** more words are single tokens → shorter sequences → cheaper long context, but bigger embedding/output layers and a larger softmax to compute.

Modern models trend toward larger vocabularies (GPT-4's `cl100k` ≈ 100k, Llama 3 ≈ 128k, some multilingual models ≈ 256k) specifically to tokenize many languages and code more efficiently.

## Unknown tokens

Older word/subword tokenizers had a special `[UNK]` token for anything not in the vocab — a real failure mode, since the model literally couldn't see the input. Modern **byte-level BPE eliminates this**: the base vocabulary includes all 256 byte values, so *any* Unicode input can be spelled out byte by byte. Nothing is ever truly unknown — worst case, a rare character just costs several tokens.

## Concrete example

```python
import tiktoken
enc = tiktoken.get_encoding("cl100k_base")
print(enc.n_vocab)            # ~100277 tokens in GPT-4's vocab
print(enc.encode("café"))     # 'é' may split into multiple byte tokens
print(enc.encode("🚀"))        # emoji -> several byte-level tokens, never UNK
```

The same string tokenized with `gpt2` (50k vocab) vs `cl100k` (100k) yields different IDs *and* often a different token count — proof the vocabulary is model-specific.

## How this shows up in production

- **Use the right tokenizer:** counting tokens with GPT-2's tokenizer for a Llama model gives wrong budgets. Always match tokenizer to model.
- **Multilingual cost:** a model with a small English-centric vocab charges far more tokens for Arabic or Hindi. Choosing a model with a multilingual vocab can cut token bills substantially.
- **Custom/domain vocab:** teams occasionally extend a vocab with domain tokens (e.g. medical, code symbols) to shorten sequences — but it requires retraining embeddings.

## Common misconceptions

- **"All models share one vocabulary."** Each model family has its own tokenizer and vocab; IDs and token counts are not portable.
- **"Modern models have unknown tokens."** Byte-level BPE removed true UNKs. Rare characters are expensive, not unrepresentable.
- **"Bigger vocab is strictly better."** It shortens sequences but bloats the embedding/output layers and the softmax — it's a tradeoff, not a free win.

## Interview tip

Say: *"The vocabulary is the fixed set of tokens with integer IDs, frozen at tokenizer-training time. Its size trades sequence length against model size — bigger vocab means shorter, cheaper sequences but heavier embedding and output matrices. Byte-level BPE means there are effectively no unknown tokens."* Mentioning that vocab size sets the output logit width shows you connect it end-to-end.
