# Cleaning & Normalization

**What it is:** the polishing step *after* extraction — fixing the messy artifacts parsing leaves behind (weird whitespace, broken hyphenated words, repeated headers, odd Unicode) so your text is clean, consistent, and ready to chunk and embed.

## Why it matters for an AI Engineer

Extraction gets the words out; cleaning makes them *usable*. Raw extracted text is full of noise: a word split across a line break as "inter-\nnational", three blank lines where there should be one, "Page 12 of 300" on every page, smart-quotes and non-breaking spaces that confuse tokenizers, HTML entities like `&amp;`. Every bit of that noise pollutes your embeddings (junk gets vectorized), inflates token cost, and hurts retrieval. Cleaning is cheap to do and expensive to skip — it's one of the highest return-on-effort steps in the whole ingestion pipeline, and it's exactly the kind of detail that separates a robust pipeline from a flaky one.

## The mechanism — the common cleanups

Think of it as a small sequence of transforms applied to extracted text:

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🧹 Raw extracted text</span>
    <span class="darr">→</span>
    <span class="dbox">Fix whitespace</span>
    <span class="darr">→</span>
    <span class="dbox">De-hyphenate</span>
    <span class="darr">→</span>
    <span class="dbox">Strip boilerplate</span>
    <span class="darr">→</span>
    <span class="dbox">Normalize Unicode</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Clean text</span>
  </div>
  <div class="dcap">A short, ordered pipeline of small fixes — each one removes noise that would otherwise be embedded.</div>
</div>

The staples:
- **Whitespace normalization** — collapse runs of spaces/newlines, trim lines. PDFs love to emit ragged spacing.
- **De-hyphenation** — join words broken across line ends: `"inter-\nnational"` → `"international"`. Otherwise you get two broken tokens.
- **Boilerplate removal** — drop repeated headers/footers, page numbers, "Confidential" stamps. If a line appears on nearly every page, it's boilerplate.
- **Unicode normalization** — standardize smart quotes `“ ”` → `" "`, non-breaking spaces → normal spaces, ligatures `ﬁ` → `fi`, and apply Unicode NFKC so equivalent characters look identical to your tokenizer and embedder.
- **Encoding/entity fixes** — decode HTML entities (`&amp;` → `&`), fix mojibake (garbled encoding), ensure UTF-8. Vital for mixed Arabic/English UAE content.

**Careful:** cleaning should be *conservative*. Removing all punctuation or lowercasing everything (old NLP habits) is a mistake for modern LLM pipelines — the model *wants* natural text with casing and punctuation. Clean the noise, keep the language.

## Concrete example

A small, dependency-light cleaner covering the common cases:

```python
import re
import unicodedata

def clean(text: str) -> str:
    # 1. Normalize Unicode (smart quotes, ligatures, NBSP → canonical forms)
    text = unicodedata.normalize("NFKC", text)
    text = text.replace(" ", " ").replace("​", "")  # NBSP, zero-width

    # 2. De-hyphenate words broken across line breaks
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)

    # 3. Collapse whitespace: many spaces → one, many blank lines → one
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()

raw = "The inter-\nnational   team’s   report\n\n\n\nPage 3 of 40"
print(clean(raw))
# The international team's report\n\nPage 3 of 40
```

Boilerplate removal is best done across pages — find lines that repeat on most pages and drop them:

```python
from collections import Counter

def strip_boilerplate(pages: list[str]) -> list[str]:
    line_counts = Counter(l.strip() for p in pages for l in p.splitlines() if l.strip())
    threshold = 0.6 * len(pages)                      # appears on >60% of pages
    boiler = {l for l, c in line_counts.items() if c >= threshold}
    return ["\n".join(l for l in p.splitlines() if l.strip() not in boiler) for p in pages]
```

## How a company uses this

A Dubai insurer ingests hundreds of scanned + digital policy PDFs. Their cleaning stage de-hyphenates broken words from column wraps, strips the repeated "Policy Terms — Confidential" footer that appeared on every page, and NFKC-normalizes mixed Arabic/English punctuation. The result: chunks that read like real sentences, embeddings free of boilerplate, and noticeably better retrieval — all from one cheap post-processing pass.

## Common mistakes

- **Over-cleaning.** Lowercasing, stripping punctuation, removing stopwords — outdated for LLMs and actively harmful. Keep natural text.
- **Skipping de-hyphenation.** "environ- ment" becomes two broken tokens and hurts both embedding and search.
- **Leaving boilerplate in.** Repeated headers/footers get embedded and pollute retrieval; strip them.
- **Ignoring Unicode/encoding.** Mojibake and smart-quote mismatches cause silent failures, especially with Arabic. Normalize to UTF-8 + NFKC.
- **Cleaning away structure you needed.** Don't collapse the newlines that marked section boundaries before you've used them for chunking.

## Interview tip

Frame cleaning as **"conservative noise removal, not old-school NLP normalization"**: *"I fix whitespace, de-hyphenation, boilerplate, and Unicode — but I keep casing and punctuation because the LLM wants natural text."* Explicitly rejecting lowercasing/stopword-removal shows you understand that LLM pipelines are different from classic bag-of-words NLP, a distinction that impresses interviewers.
