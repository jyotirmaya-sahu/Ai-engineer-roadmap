# pytest

**The one-line idea:** pytest is the standard Python testing tool. You write plain functions named `test_*` with an `assert`, run `pytest`, and it tells you what broke — so you change code without fear of silently breaking something else.

## Why this matters for an AI Engineer

LLM apps have lots of *deterministic* glue that absolutely must be correct: the function that parses the LLM's JSON, the chunker that splits documents, the retriever's scoring, the prompt builder. A bug there corrupts everything downstream. Tests catch it instantly. You can't reliably test the LLM's *creativity*, but you can and must test the plumbing around it — and interviewers expect you to know how. Untested parsing code is a production incident waiting to happen.

## Your first test

pytest tests are just functions starting with `test_`, using Python's built-in `assert`.

```python
# code under test — a parser for an LLM's messy output
def parse_score(text: str) -> float:
    return float(text.strip().rstrip("%")) / 100

# test_parsing.py
def test_parse_plain():
    assert parse_score("85") == 0.85

def test_parse_with_percent_and_spaces():
    assert parse_score("  85% ") == 0.85
```

Run it:

```bash
pytest                    # finds & runs every test_*.py
pytest -v                 # verbose: shows each test name + pass/fail
pytest test_parsing.py    # just one file
```

When an `assert` fails, pytest shows the exact values — `assert 0.9 == 0.85` — so you see *why* immediately. No `unittest` boilerplate, no classes required.

## Testing that errors happen (pytest.raises)

Good code raises errors on bad input — and you should test that it does:

```python
import pytest

def test_bad_input_raises():
    with pytest.raises(ValueError):
        parse_score("not a number")     # test passes only if this raises ValueError
```

## Parametrize — one test, many cases

Instead of copy-pasting a test for each input, `@pytest.mark.parametrize` runs the same test across a table of inputs. Perfect for parsers with many edge cases.

```python
import pytest

@pytest.mark.parametrize("raw, expected", [
    ("85",     0.85),
    ("85%",    0.85),
    ("  100 ", 1.0),
    ("0",      0.0),
])
def test_parse_score(raw, expected):
    assert parse_score(raw) == expected
```

That's **four** separate tests from one function — each shows up individually in the output, so you know exactly which case failed. This is how you cover the messy variety of real LLM outputs cheaply.

## Fixtures — reusable setup

A **fixture** provides shared setup (test data, a client, a temp DB) to any test that asks for it by name. It keeps tests DRY and clean.

```python
import pytest

@pytest.fixture
def sample_chunks():
    return [
        {"text": "Golden Visa lasts 10 years", "score": 0.9},
        {"text": "Refunds take 14 days", "score": 0.4},
    ]

def test_filter_high_score(sample_chunks):        # just name the fixture as an arg
    good = [c for c in sample_chunks if c["score"] > 0.5]
    assert len(good) == 1
```

pytest sees the parameter name, runs the fixture, and injects its return value. Multiple tests reuse `sample_chunks` without repeating the data.

## Testing LLM code: mock the model

You don't call the real LLM in tests — it's slow, costs money, and gives different answers each run (non-deterministic). Instead you **mock** it: replace the API call with a fake that returns canned output, then test *your* logic around it.

```python
def build_prompt(question, chunks):
    context = "\n".join(c["text"] for c in chunks)
    return f"Answer from context.\n{context}\n\nQ: {question}"

def test_prompt_includes_context(sample_chunks):
    prompt = build_prompt("How long is the visa?", sample_chunks)
    assert "Golden Visa lasts 10 years" in prompt      # deterministic, fast, free
    assert "Q: How long is the visa?" in prompt
```

Here we test the *prompt builder* — pure logic, no API needed. For code that truly calls the LLM, use `unittest.mock` (or `monkeypatch`) to swap the client with a stub returning a fixed response, then assert your parsing/handling is correct. **Test the deterministic plumbing; mock the model.**

## Real world: how a company uses this

> **A Dubai fintech's** RAG pipeline has a parametrized test suite over its JSON parser: dozens of real (and malformed) LLM outputs the model has produced in the past, each asserting the parser extracts the right fields or raises cleanly. When they upgrade the model or tweak a prompt, `pytest` runs in CI and instantly flags if any past-known output now breaks parsing. The actual LLM call is mocked, so the suite runs in seconds on every commit, for free — catching a broken parser *before* it hits customers instead of after an angry support ticket.

## Common mistakes

- Trying to assert on the LLM's *exact wording* — it's non-deterministic; test structure/plumbing, not creativity.
- Calling the real API in unit tests — slow, costly, flaky. Mock it.
- One giant test asserting ten things — when it fails you can't tell which part. Prefer small, focused tests (or parametrize).
- Comparing floats with `==` when rounding is involved — use `pytest.approx(0.85)` for computed floats.
- Not naming tests `test_*` (in files `test_*.py`) — pytest won't discover them.

## Interview tip

Say: *"I test the deterministic plumbing around the LLM — parsers, chunkers, prompt builders — with pytest, using `parametrize` to cover many edge cases and fixtures for shared setup. I mock the model call because it's non-deterministic and costs money, so tests stay fast and run in CI on every commit."* The "test the plumbing, mock the model" framing is the exact instinct that separates engineers who've shipped LLM apps from those who haven't.
