# BPE / WordPiece

**What it is:** The two dominant *subword* tokenization algorithms — they split text into chunks bigger than characters but often smaller than words, so a fixed vocabulary can represent any text.

## Why it matters for an AI Engineer

Tokenization is where your text becomes numbers, and it silently governs **cost** (you pay per token, not per word), **context limits** (budgets are in tokens), and **weird failures** (why models miscount letters, mangle rare words, or handle code oddly). Knowing that "tokens ≠ words" and *why* the split happens the way it does lets you estimate cost, debug truncation, and explain why non-English text is more expensive.

## Why not just words or characters?

- **Whole words:** you'd need a vocabulary of millions to cover every word, misspelling, and language — and any unseen word ("ChatGPT-ification") becomes an unknown token the model can't represent. Too rigid.
- **Single characters:** vocabulary is tiny and nothing is ever unknown, but sequences become extremely long (one token per letter) — slow, expensive, and the model has to relearn that "c-a-t" spells a concept.

**Subwords** are the sweet spot: common words stay whole (`" the"` = 1 token), rare words break into reusable pieces (`" tokenization"` → `" token" + "ization"`), and *nothing* is ever truly unknown because you can always fall back to smaller pieces or bytes.

## How BPE works (Byte-Pair Encoding)

BPE builds its vocabulary by **merging the most frequent adjacent pairs**, bottom-up:

1. Start with individual characters (or raw bytes) as the base vocabulary.
2. Scan the training corpus, count every adjacent pair of symbols.
3. Merge the most frequent pair into a new single symbol. Record the merge.
4. Repeat thousands of times until you hit the target vocab size.

At inference, the tokenizer replays those learned merges on your text in order. Common sequences got merged early, so they're single tokens; rare ones stay split.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">'l','o','w','e','r'</span>
    <span class="darr">↓<span class="lbl">merge 'e'+'r' → 'er'</span></span>
    <span class="dbox">'l','o','w','er'</span>
    <span class="darr">↓<span class="lbl">merge 'o'+'w' → 'ow'</span></span>
    <span class="dbox">'l','ow','er'</span>
    <span class="darr">↓</span>
    <span class="dbox purple">... repeat to target vocab size ...</span>
  </div>
  <div class="dcap">BPE builds its vocabulary bottom-up by repeatedly merging the most frequent adjacent pair.</div>
</div>

Modern LLMs (GPT, Llama, Claude) use **byte-level BPE**: they start from raw bytes, so *any* Unicode — emoji, code, any language — is always representable, no true "unknown" token needed.

## How WordPiece differs

WordPiece (used by BERT) is very similar but chooses merges by **likelihood** rather than raw frequency: it merges the pair that most increases the probability of the training data, not simply the most common one. It also marks word-continuation pieces with `##` (e.g. `playing` → `play`, `##ing`). Practically: BPE = "merge what's frequent," WordPiece = "merge what's statistically most useful." Both produce subword vocabularies.

## Concrete example

```python
import tiktoken
enc = tiktoken.get_encoding("cl100k_base")   # GPT-4 family
print(enc.encode(" tokenization"))   # [4037, 2065] -> 2 tokens
print(enc.encode(" the"))            # [279] -> 1 token
print([enc.decode([t]) for t in enc.encode("unbelievable")])
# -> ['un', 'belie', 'vable']  rare-ish word splits into pieces
```

Notice the leading space is *part of* the token — `" the"` and `"the"` are different tokens. That's a real gotcha when hand-building prompts.

## How this shows up in production

- **Cost estimation:** English averages ~0.75 words/token, so ~1.3 tokens per word. Count tokens with `tiktoken` before sending to predict spend and check context fit.
- **Non-English tax:** Languages like Hindi, Arabic, or Thai fragment into many more subword/byte tokens than English, so the *same meaning* costs 2–4x more tokens — a real budgeting issue for a Dubai/multilingual product.
- **Code and JSON:** Whitespace, brackets, and long identifiers tokenize inefficiently, inflating token counts in coding tools.

## Common misconceptions

- **"One token = one word."** Common words are one token, but rare words, spaces, and punctuation change that. Tokens ≈ 0.75 words on average, not exactly one.
- **"BPE understands meaning."** It's pure statistics over character sequences — no semantics. `" token"` and `"ization"` are frequency artifacts, not morphemes the algorithm "knows."
- **"The model sees letters."** It sees token IDs. That's why it struggles to count the r's in "strawberry" — the word may be a single opaque token.

## Interview tip

Say: *"LLMs use subword tokenization — usually byte-level BPE — which merges frequent character pairs to build a fixed vocabulary. It's a middle ground: common words are one token, rare words split into reusable pieces, and byte-level fallback means nothing is ever out-of-vocabulary."* If asked about WordPiece: *"same idea, but merges are chosen by likelihood rather than raw frequency, and it's what BERT uses."*
