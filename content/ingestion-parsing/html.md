# Parsing HTML

**What it is:** stripping a web page down to just the *content* text — throwing away navigation bars, ads, cookie banners, scripts, and styling — so your RAG system ingests the article, not the furniture around it.

## Why it matters for an AI Engineer

A huge share of RAG knowledge comes from the web: documentation sites, help centers, product pages, news, company wikis exported as HTML. But raw HTML is 90% noise. If you feed the whole page in, your chunks fill up with "Home | About | Contact | Subscribe to our newsletter | © 2026" and the model wastes context (and your money) on junk. Clean HTML extraction directly improves retrieval quality and cuts token cost. It's also the backbone of any web-scraping ingestion job, which shows up constantly in real AI Engineer work.

## The mechanism — the DOM tree

An HTML page is a **tree** of nested tags: `<html>` contains `<body>`, which contains `<div>`s, which contain `<p>`s and `<a>`s. Parsing means loading that tree into memory so you can walk it and pluck out the nodes you want.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🌐 Raw HTML</span>
    <span class="darr">→</span>
    <span class="dbox">Parse to DOM tree</span>
    <span class="darr">→</span>
    <span class="dbox orange">Select content nodes<span class="sub">drop nav/ads/script</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Clean text</span>
  </div>
  <div class="dcap">HTML → tree → keep the article, discard the chrome.</div>
</div>

Two decisions matter:

1. **What to keep.** Content usually lives inside `<article>`, `<main>`, or a specific `<div class="post-body">`. Everything in `<nav>`, `<header>`, `<footer>`, `<script>`, `<style>`, and `<aside>` is almost always noise.
2. **How to keep structure.** A heading (`<h2>`) and a list (`<ul>`) carry meaning. You often want to *preserve* that structure (as Markdown) rather than flatten everything to one text blob, because headings make great chunk boundaries later.

## Concrete example

`BeautifulSoup` is the standard Python tool. Here we remove noise tags, then pull clean text:

```python
# pip install beautifulsoup4 requests
import requests
from bs4 import BeautifulSoup

html = requests.get("https://example.com/docs/quickstart").text
soup = BeautifulSoup(html, "html.parser")

# 1. Kill the furniture
for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
    tag.decompose()

# 2. Prefer the main content region if it exists
main = soup.find("article") or soup.find("main") or soup.body

# 3. Clean text, one blank line between blocks
text = main.get_text(separator="\n", strip=True)
print(text[:500])
```

If you want to **keep headings and links as Markdown** (better for chunking), pair it with a converter:

```python
# pip install markdownify
from markdownify import markdownify as md
clean_markdown = md(str(main), heading_style="ATX")   # <h2> → "## ..."
```

For pages rendered by JavaScript (content isn't in the raw HTML), `requests` gets you an empty shell — you'd need a headless browser like Playwright to run the JS first, *then* hand the rendered HTML to BeautifulSoup.

## How a company uses this

A SaaS company in Dubai builds a support chatbot over its own help center. A crawler fetches every help article, BeautifulSoup strips the sidebar and "Was this helpful?" widget, `markdownify` preserves the step-by-step headings, and each article becomes clean Markdown tagged with its URL. Because the nav and footer were removed, retrieval returns the actual troubleshooting steps instead of "Contact Sales" links.

## Common mistakes

- **Regex on raw HTML.** Trying to strip tags with regular expressions is famously fragile — nested tags and attributes break it. Use a real parser.
- **Forgetting JavaScript-rendered pages.** `requests` returns the pre-JS HTML; modern sites often ship an empty `<div id="root">`. If you get no text, you need a headless browser.
- **Flattening away structure too early.** Dumping everything to one text blob throws out headings that would have made perfect chunk boundaries.
- **Keeping boilerplate.** Cookie banners and "related articles" leak into embeddings and dilute retrieval. Remove them.

## Interview tip

Mention the distinction between **static and JavaScript-rendered** HTML. Saying "I'd use BeautifulSoup, but if the content is client-rendered I'd render it with a headless browser first" shows you've actually scraped real modern sites and know where the naive approach silently returns nothing.
