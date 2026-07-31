# SDK Setup & Call Pattern

**What it is:** the ground-floor chapter for talking to an LLM in code. Not "here's a snippet to copy" — instead we build the **mental model of how the entire OpenAI API is shaped**, one piece at a time, so that every call you ever write reads like a sentence you understand.

## Why this chapter exists

When you learned programming you didn't start with `print()` — you learned *what a variable is*, then *types*, then *functions*. Same here. If you jump straight to `client.chat.completions.create(...)` you're pattern-matching a magic incantation. Learn the **grammar** first and the whole API — all of it, including endpoints you've never seen — becomes readable. That's the difference between "I pasted this" and "I know what every dot means."

## The one sentence the whole API is built on

Every single call, without exception, is this shape:

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">client<span class="sub">the connection</span></span>
    <span class="darr">.</span>
    <span class="dbox blue">family<span class="sub">the noun (what area)</span></span>
    <span class="darr">.</span>
    <span class="dbox orange">verb<span class="sub">the action</span></span>
    <span class="darr">(</span>
    <span class="dbox purple">arguments<span class="sub">what you want</span></span>
    <span class="darr">) →</span>
    <span class="dbox green">response<span class="sub">a structured object</span></span>
  </div>
  <div class="dcap">client . family . verb( arguments ) → response. Learn these 5 words and you know the API.</div>
</div>

Read it like English: *"On my **connection**, in the **chat** area, **create** a reply with these **messages**, and give me back a **response object**."* The rest of this article teaches those five words in order. Nothing else to memorise.

---

## Word 1 — the client (your connection)

Before any request, you need an authenticated connection. Two setup steps, once:

```bash
pip install openai
export OPENAI_API_KEY="sk-..."      # from platform.openai.com, treat like a password
```

```python
from openai import OpenAI
client = OpenAI()                   # reads OPENAI_API_KEY from the environment
```

`OpenAI()` builds the **client** — one object holding your API key, the server URL, timeouts, and retry rules. Think of it as *the phone line to OpenAI, already logged in.* You build it **once** and reuse it for every call for the rest of your program.

- The key is your **password and your bill** — never hard-code it in source, never commit it. The SDK auto-reads the `OPENAI_API_KEY` env var so it never appears in your code.
- Every call starts from this object: `client. ...`. No client, no call.

*(That's "Word 1." You now have `client`. Next: what can you say to it?)*

---

## Word 2 — the family (which part of the API)

The OpenAI API isn't one thing — it's a **group of services**: chatting, embeddings, images, audio, file storage, and more. In the SDK, you pick one by the **attribute after `client`**. That attribute is the **family** (a "noun" — the area you're working in):

```python
client.chat            # the chat area
client.embeddings      # the vectors area
client.images          # the image area
client.files           # the file-storage area
```

Here's the **whole menu**. Skim it once so you know what *exists* — you don't need to learn each now, just recognise that the API is this tree. Each links to its official reference for full details:

| SDK path | Family — what it does | Reference |
|---|---|---|
| `client.chat.completions` | **Chat** — send messages, get a reply. The workhorse; this node uses it throughout. | [Chat](https://platform.openai.com/docs/api-reference/chat) |
| `client.responses` | **Responses** — newer agent-first API bundling tools + state + multimodal. OpenAI's recommended default going forward. | [Responses](https://platform.openai.com/docs/api-reference/responses) |
| `client.embeddings` | **Embeddings** — turn text into vectors for search / RAG. | [Embeddings](https://platform.openai.com/docs/api-reference/embeddings) |
| `client.images` | **Images** — text → image (generate / edit / variations). | [Images](https://platform.openai.com/docs/api-reference/images) |
| `client.audio.transcriptions` | **Speech-to-text** — audio → text (Whisper). | [Audio](https://platform.openai.com/docs/api-reference/audio) |
| `client.audio.speech` | **Text-to-speech** — text → spoken audio. | [Audio](https://platform.openai.com/docs/api-reference/audio) |
| `client.moderations` | **Moderation** — flag unsafe content (free safety filter). | [Moderations](https://platform.openai.com/docs/api-reference/moderations) |
| `client.files` | **Files** — upload data for batch / fine-tuning / retrieval. | [Files](https://platform.openai.com/docs/api-reference/files) |
| `client.batches` | **Batch** — run huge jobs asynchronously at ~50% cost. | [Batch](https://platform.openai.com/docs/api-reference/batch) |
| `client.fine_tuning.jobs` | **Fine-tuning** — train a custom model on your data. | [Fine-tuning](https://platform.openai.com/docs/api-reference/fine-tuning) |
| `client.vector_stores` | **Vector stores** — managed vector DB for file search. | [Vector stores](https://platform.openai.com/docs/api-reference/vector-stores) |
| `client.models` | **Models** — list / inspect available models. | [Models](https://platform.openai.com/docs/api-reference/models) |

<div class="diagram">
  <div class="flow v">
    <div class="flow"><span class="dbox gray">client</span><span class="darr">→</span><span class="dbox blue">chat.completions</span><span class="darr">→</span><span class="dbox blue">embeddings</span><span class="darr">→</span><span class="dbox blue">images</span><span class="darr">→</span><span class="dbox blue">audio</span><span class="darr">→</span><span class="dbox blue">files …</span></div>
  </div>
  <div class="dcap">The API is a tree: one client, many families hanging off it. You pick a branch.</div>
</div>

Some families nest one level deeper (`client.chat.completions`, `client.audio.transcriptions`) — that's just OpenAI grouping related things. The idea is the same: **the path names the area.**

*(That's "Word 2." You've picked a branch. Now: what can you do on that branch?)*

---

## Word 3 — the verb (the action)

On a family you call a **verb** — the action. `create` is by far the most common ("make one / run one"), but families expose a small, predictable set, exactly like a REST resource:

| Verb | Means | Example |
|---|---|---|
| `.create(...)` | make one / run one | `client.chat.completions.create(...)` |
| `.retrieve(id)` | fetch one by ID | `client.files.retrieve("file_abc")` |
| `.list()` | list many | `client.models.list()` |
| `.delete(id)` | delete one | `client.files.delete("file_abc")` |
| `.update(id, ...)` | modify one | `client.fine_tuning.jobs.update(...)` |
| *(special)* | family-specific action | `client.batches.cancel("batch_1")` |

**Which verbs exist depends on the family**, and there's a clean rule:

- **One-shot compute** (chat, embeddings, moderations) → basically **`create` only**. You *run* it and get an answer; there's nothing stored to fetch later.
- **Stateful resources** (files, batches, fine-tuning jobs) → **full set** (`create`, `retrieve`, `list`, `delete`). You *make a thing that lives on OpenAI's servers*, then check on it by ID over time.

So `client.chat.completions.create(...)` = *"in the chat area, run one completion."* `client.files.list()` = *"in the files area, show me all my files."* Same grammar, different noun + verb.

*(That's "Word 3." You can now name any action. Next: how do you say what you want?)*

---

## Word 4 — the arguments (what you want)

Inside `create(...)` you pass **keyword arguments** describing the request. For chat, exactly **two are required**:

```python
client.chat.completions.create(
    model="gpt-5.4-mini",                       # WHICH model runs it (a string)
    messages=[{"role": "user", "content": "Hi"}],  # the conversation (a list of dicts)
)
```

- **`model`** — which model does the work. Just a string ID. Swap it to trade cost for capability (`gpt-5.4-mini` cheap/fast, `gpt-5.4` stronger).
- **`messages`** — the conversation, as a list of `{"role", "content"}` dicts. This is the heart of chat and gets its own tile next (*Messages & roles*). For now: a list, each item is one turn.

Everything else is **optional** — omit it and a sensible default applies:

```python
client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[...],
    temperature=0.7,            # randomness  (Sampling & Generation node)
    max_completion_tokens=200,  # cap the output length
    stream=True,                # stream tokens as they arrive (Streaming tile)
    tools=[...],                # let the model call your functions (Tools tile)
)
```

You don't learn these now — you learn *that they slot in here as optional kwargs*, and each has a dedicated tile. The mental model: **`model` + `messages` are the sentence; the rest are adverbs you add when needed.**

*(That's "Word 4." You've said what you want. Now: what comes back?)*

---

## Word 5 — the response (what you get back)

The call pattern read **outward** (`client → family → verb`, drilling *down* a tree of services). The response is the mirror image: you read **inward**, drilling *into* a tree of data to reach the text. Same skill — follow the dots — just the other direction. Let's walk `resp.choices[0].message.content` one hop at a time.

**First, the surprise:** a call does **not** return a string. Print `resp` directly and you get a big object, not "Hello":

```python
resp = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content": "Say hello in one word."}],
)
print(resp)     # NOT "Hello" — a whole object:
```
```python
ChatCompletion(
    id='chatcmpl-abc123',
    choices=[
        Choice(
            index=0,
            finish_reason='stop',
            message=ChatCompletionMessage(role='assistant', content='Hello'),
        )
    ],
    model='gpt-5.4-mini',
    usage=CompletionUsage(prompt_tokens=11, completion_tokens=1, total_tokens=12),
)
```

The text `'Hello'` is buried in there. The dotted path is just the map to reach it. Hop by hop:

### Hop 1 — `resp`
The whole object (type `ChatCompletion`). Holds the reply **plus** metadata: an `id`, the `model` used, token `usage`, and a `choices` list. It's a receipt, not a string.

### Hop 2 — `resp.choices`
```python
print(resp.choices)   # -> [Choice(index=0, ...)]   a LIST
```
`.choices` is a **list**. *Why a list for one answer?* Because you *can* ask the model for several independent answers to the same prompt with `n=3` — then `choices` has 3 items. By default `n=1`, so the list has exactly one element. That's why the next hop is an index.

### Hop 3 — `resp.choices[0]`
```python
print(resp.choices[0])   # -> Choice(index=0, finish_reason='stop', message=...)
```
`[0]` picks the **first** answer out of the list (standard Python indexing — nothing OpenAI-specific). One `Choice` bundles that answer's `message` **and** its `finish_reason`.

#### When does `choices` have more than one — and why `[0]`?

By default the request sends **`n=1`**, so the model generates exactly one answer and `choices` has one item at index `0`. You use `[0]` simply because *it's the only one there*. Nothing magic about the zero — with `n=1`, indices `[1]`, `[2]`, … don't exist (accessing them throws `IndexError`).

You get more entries **only when you ask for them** with the `n` parameter:

```python
resp = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content": "Suggest a name for a coffee shop."}],
    n=3,                     # <-- ask for 3 independent answers to the SAME prompt
)

for i, choice in enumerate(resp.choices):
    print(i, choice.message.content)
# 0 Bean & Bloom
# 1 The Daily Grind
# 2 Camel & Cup
```

Now `choices` has **three** `Choice` objects — three *separate* generations of the same prompt, each its own `message` and `finish_reason`. They're independent samples, not ranked: index `0` is **not** "the best," just the first one produced. That's the key point — **the order is arbitrary**, so there's no "better index" to prefer. With `n=1` you use `[0]` because it's the only one; with `n>1` you decide what to do with all of them.

**When you'd actually set `n>1`:**
- **Pick-best-of-N.** Generate several candidates, then score them (with a rubric, a regex/JSON-valid check, or a second LLM call) and keep the winner. Common for code generation, structured extraction, or creative copy where one shot is unreliable.
- **Show options to a user.** "Here are 3 taglines — pick one." The UI shows all choices.
- **Self-consistency.** For reasoning/math, generate N answers and take the **majority vote** — often more accurate than a single try.

**What to do with multiple — the patterns:**

```python
# 1) Show them all
options = [c.message.content for c in resp.choices]

# 2) Pick the best by your own scoring function
best = max(resp.choices, key=lambda c: score(c.message.content)).message.content

# 3) Majority vote (self-consistency)
from collections import Counter
answers = [c.message.content.strip() for c in resp.choices]
winner = Counter(answers).most_common(1)[0][0]
```

**The cost catch (important):** `n=3` generates 3 completions, so you pay for **3× the output tokens**. The *input* is charged once (the prompt is sent once and shared), but each answer's output bills separately. So `n=5` isn't 5× total cost — it's 1× prompt + 5× completion. Use `n>1` deliberately, and keep `max_completion_tokens` tight when you do.

> **Rule of thumb:** default `n=1` and use `[0]`. Reach for `n>1` only when you have a concrete plan to *use* the extras — score them, vote on them, or show them. Never set `n=5` and then ignore `choices[1:]`; you paid for answers you threw away.

### Hop 4 — `resp.choices[0].message`
```python
print(resp.choices[0].message)   # -> ChatCompletionMessage(role='assistant', content='Hello')
```
The **message object** — the same `{role, content}` shape you *sent* in `messages`, now coming back with `role='assistant'`. It carries the role, the `content`, and (if the model called a tool) `tool_calls`. Still not a bare string — one more hop.

### Hop 5 — `resp.choices[0].message.content`
```python
print(resp.choices[0].message.content)   # -> "Hello"   ← finally, the text
```
`.content` is the actual string the model wrote. This is the thing you print or return ~95% of the time.

<div class="diagram">
  <div class="flow">
    <span class="dbox green">resp<span class="sub">ChatCompletion</span></span>
    <span class="darr">.choices</span>
    <span class="dbox blue">[ … ]<span class="sub">list of answers</span></span>
    <span class="darr">[0]</span>
    <span class="dbox blue">Choice<span class="sub">one answer</span></span>
    <span class="darr">.message</span>
    <span class="dbox orange">message<span class="sub">role + content</span></span>
    <span class="darr">.content</span>
    <span class="dbox green">"Hello"<span class="sub">the text</span></span>
  </div>
  <div class="dcap">Read inward: object → list → pick one → message → text. Each dot is one hop deeper.</div>
</div>

### The two side-pockets you'll also use

Not everything is under `.message`. Two useful values hang elsewhere on the object:

```python
print(resp.choices[0].finish_reason)   # 'stop'   — sits on the Choice, next to message
print(resp.usage.total_tokens)         # 12       — sits on resp itself
```

- **`finish_reason`** (on the `Choice`) — *why* generation ended: `stop` (natural end), `length` (hit your token cap — output was truncated, not the model being lazy), `tool_calls` (model wants a function). Check this first when output looks cut off.
- **`usage`** (on `resp`) — `prompt_tokens`, `completion_tokens`, `total_tokens`. Your cost and your context-budget meter. (Full tile: *Usage & token counting*.)

### The one habit that saves you

When a new response shape confuses you, **print the raw object** (or `resp.model_dump()` for a clean dict) and read the tree. You never have to guess the path — you can always *see* it:

```python
import json
print(json.dumps(resp.model_dump(), indent=2))   # the whole response as readable JSON
```

*(That's all five words — call pattern outward, response pattern inward. You can now read and write any OpenAI call.)*

---

## Putting the five words together

```python
from openai import OpenAI

client = OpenAI()                                   # Word 1: connection

resp = client.chat.completions.create(              # Word 2: family, Word 3: verb
    model="gpt-5.4-mini",                           # Word 4: arguments
    messages=[
        {"role": "system", "content": "You are terse. One sentence."},
        {"role": "user",   "content": "What is the capital of the UAE?"},
    ],
)

print(resp.choices[0].message.content)              # Word 5: response
# -> "The capital of the UAE is Abu Dhabi."
```

Read top to bottom, it's the sentence from the start of this article, now in code.

## One more thing — errors

Real calls hit the network, so they can fail. The SDK raises **typed exceptions** so you react per case:

```python
from openai import RateLimitError, APIError

try:
    resp = client.chat.completions.create(model="gpt-5.4-mini", messages=msgs)
except RateLimitError:
    ...   # sending too fast — back off and retry
except APIError as e:
    ...   # server-side; log e, retry transient ones
```

Just know they exist and they're typed (`RateLimitError`, `APITimeoutError`, `AuthenticationError`, `BadRequestError`). The *Retries & backoff* and *Rate limits* tiles go deep.

## The payoff — the pattern transfers

Because you learned the *grammar*, other SDKs read instantly. Anthropic:

```python
from anthropic import Anthropic
client = Anthropic()                                # Word 1
resp = client.messages.create(                      # Word 2 (family: messages) + Word 3 (create)
    model="claude-sonnet-4-6",
    max_tokens=100,
    messages=[{"role": "user", "content": "Hi"}],   # Word 4
)
print(resp.content[0].text)                         # Word 5 (different shape, same idea)
```

Different family name (`messages`), different response shape (`content[0].text`), but the five-word sentence is identical. **Learn it once, use it everywhere.**

## How a company uses this

In a real service the client is built **once at startup** (module-level or dependency-injected), never per request — recreating it re-reads config and wastes time. A Dubai SaaS backend wraps `client.chat.completions.create` in a single helper — `def call_llm(messages, **kw)` — that centralises the model name, default timeout, retry policy, and token logging. Every feature calls that helper, so switching models or adding cost-tracking is a one-line change instead of a codebase hunt. Fluency in the five-word pattern is exactly what lets you design that wrapper on day one instead of copy-pasting `create` calls everywhere.

## Common mistakes / misconceptions

- **Treating the response as a string.** It's an object — forgetting `.choices[0].message.content` prints `<ChatCompletion object ...>`.
- **Hard-coding the API key** and leaking it. Env var only; rotate immediately if exposed.
- **Recreating the client every call.** Build once, reuse.
- **Ignoring `finish_reason`.** Truncated output is usually `length` (your cap), not the model "being lazy."
- **Thinking `create` is the only verb.** Stateful families (files, batches, fine-tuning) also have `retrieve` / `list` / `delete`.

## Interview tip

Show the mental model, not a snippet: *"Every OpenAI call is `client.<family>.<verb>(arguments)` returning a structured object. For chat that's `client.chat.completions.create(model, messages)`; I read `choices[0].message.content` for text, `finish_reason` to see why it stopped, and `usage` for cost. The client is built once and reused, the key sits in an env var, and the same grammar transfers to Anthropic or any provider."* That answer says you understand the API's shape, not just one endpoint.

## Practice — assignments

Write a program for each. Do them in order. You need `pip install openai` and `OPENAI_API_KEY` set.

1. Write a program that asks the model to name one programming language and prints only the reply text (not the whole response object).

2. Write a program that makes a call, prints the full response as readable JSON, and then prints the model name, the total tokens used, and the finish reason — each on its own line.

3. Write a program that asks the model to explain the internet in 500 words but limits the output to 20 tokens. Print both the returned text and the finish reason.

4. Write a program that asks for a startup name for a bakery and requests 4 separate answers in one call, then prints all four, numbered.

5. Write a program that requests 4 bakery-name answers as above, then prints only the shortest one.

6. Write a program that asks "Is 17 a prime number? Answer only Yes or No." five times in one call, then prints the majority answer.

7. Write a reusable function that takes a prompt, sends it to the model, and returns just the reply text. It should default to the `gpt-5.4-mini` model but let the caller override the model or pass other options. Use it to answer two different prompts.

8. Write a program that calls the API with a fake model name and catches the error, printing a clean message instead of crashing.

9. (Stretch) If you have an Anthropic key, rewrite assignment 1 using the `anthropic` SDK and print the reply text.

10. (Stretch) Write a program that lists the available models and prints the first five model IDs.

*Do 1–8 before moving to the next tile. If any felt shaky, re-read that section first.*

*Next: Word 4 in depth — the `messages` list, its roles, and why "conversation memory" is really just re-sending it.*
