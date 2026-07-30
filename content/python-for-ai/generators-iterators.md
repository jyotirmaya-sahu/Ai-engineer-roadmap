# Generators & Iterators

**The one-line idea:** A generator produces values **one at a time, on demand**, instead of building a whole list up front. This is exactly how streaming LLM responses (token-by-token) work under the hood.

## Why this matters for an AI Engineer

When ChatGPT "types" its answer word by word, that's a generator streaming tokens. When you process a 10 GB dataset of documents, you can't load it all into RAM — you stream it with a generator. Lazy, one-at-a-time evaluation is *the* pattern for LLM streaming and big-data pipelines. If you understand generators, streaming stops being magic.

## The iterator protocol (what powers every `for` loop)

An **iterable** is anything you can loop over (`list`, `str`, `dict`). An **iterator** is the thing that actually hands out items one by one and remembers where it left off. Two dunder methods define it:

- `__iter__()` — returns the iterator
- `__next__()` — returns the next item, or raises `StopIteration` when done

```python
nums = [10, 20, 30]
it = iter(nums)        # get an iterator
print(next(it))        # 10
print(next(it))        # 20
print(next(it))        # 30
# next(it)  -> raises StopIteration (that's how a for loop knows to stop)
```

Every `for x in nums:` is secretly calling `iter()` once then `next()` until `StopIteration`. That's the whole protocol.

## Generators — iterators made easy with `yield`

Writing `__iter__`/`__next__` by hand is tedious. A **generator function** does it for you: any function with `yield` (instead of `return`) becomes a generator. Each `yield` hands back one value and *pauses* the function — it resumes from that exact spot on the next request.

```python
def count_up(n):
    i = 0
    while i < n:
        yield i          # pause here, hand out i, resume next time
        i += 1

for x in count_up(3):
    print(x)             # 0, 1, 2
```

Nothing runs until you loop. Calling `count_up(3)` just creates the generator; the body executes lazily as you pull values.

## Why lazy = memory-efficient

A list holds *everything* at once. A generator holds *one value* at a time plus its place in the code.

```python
# List: builds all 10 million ints in RAM (~hundreds of MB)
data = [x * 2 for x in range(10_000_000)]

# Generator: near-zero memory, computes each on demand
data = (x * 2 for x in range(10_000_000))

# Stream a huge file line-by-line — file object is already an iterator
def read_lines(path):
    with open(path) as f:
        for line in f:      # never loads the whole file
            yield line.strip()
```

The generator version processes a 100 GB file the same way it processes a tiny one — one line in memory at a time.

## Streaming LLM tokens (the payoff example)

This is the mental model for `stream=True` on any LLM API. Here's a simulated token stream and how you consume it:

```python
def fake_llm_stream(prompt):
    for token in ["Dubai", " is", " sunny", " today", "."]:
        yield token                    # yield each token as it "arrives"

# Consume it — print each token the instant it's produced
for token in fake_llm_stream("weather?"):
    print(token, end="", flush=True)   # user sees text appear live
# Dubai is sunny today.
```

Real OpenAI streaming looks almost identical — you loop over the response and each iteration yields one chunk. The generator lets the UI show text *as it generates*, instead of waiting for the full answer.

## Handy generator tools

```python
gen = (x for x in range(100))
next(gen, "done")          # pull one; default avoids StopIteration crash
list(gen)                  # drain the rest into a list (careful: uses memory)

from itertools import islice
first5 = list(islice(count_up(1000), 5))   # take just the first 5
```

## Real world: how a company uses this

> **A Dubai customer-support SaaS** streams LLM answers to the chat widget so users see the reply forming word-by-word — that's a generator yielding tokens over the network. Separately, their nightly job re-embeds millions of tickets from a huge CSV export. They read it with a generator (`for row in csv_reader`) so a 20 GB file processes in a container with only 512 MB of RAM. Same primitive — lazy iteration — powers both the flashy UX and the boring-but-critical batch job.

## Common mistakes

- **A generator is single-use.** Once exhausted, looping again yields nothing. Regenerate it if you need a second pass.
- Calling `list()` on a generator built to save memory — that defeats the entire purpose.
- Forgetting the function only runs when iterated; putting important side effects before the first `yield` won't execute until consumed.
- Confusing `return` (ends everything) with `yield` (pause and resume).

## Interview tip

Say: *"A generator is a lazy iterator — `yield` pauses the function and resumes on the next `next()`, so it uses constant memory. It's exactly how LLM token streaming and large-file processing work."* Tying generators to *streaming* is the answer that shows you've built real LLM apps, not just read tutorials.
