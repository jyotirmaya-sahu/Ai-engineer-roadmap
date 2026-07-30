# Llama Guard

**What it is:** a small, open Meta model whose *only* job is to classify a piece of text as **safe** or **unsafe** across a fixed set of harm categories — used as a fast filter in front of and behind your main LLM.

## Why it matters for an AI Engineer

Regex and keyword lists are brittle safety checks — attackers rephrase around them. You want a *model* that actually understands intent, but you don't want the cost/latency of asking GPT-4-class models to judge every message. Llama Guard is the sweet spot: an 8B classifier (Llama Guard 3) that runs cheaply, understands nuance, is multilingual, and returns a structured verdict you can act on. For an AI Engineer it's the standard building block for the *safety* half of [input/output validation](input-output-validation.md). Being able to say "I put Llama Guard on both the input and the output" is a concrete, credible answer to "how do you keep this safe?"

## The mechanism

Llama Guard is an LLM fine-tuned purely for content moderation. You feed it a conversation (a user turn, or an assistant turn) plus, implicitly, its safety **taxonomy** — a list of categories like violent crimes, hate, sexual content, self-harm, privacy, weapons, code abuse (the MLCommons hazard taxonomy, categories S1–S14). It outputs two lines:

1. `safe` **or** `unsafe`
2. if unsafe, the violated category codes (e.g. `S9`).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">💬 message (user or assistant turn)</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🛡️ Llama Guard 3 (8B classifier)</span>
    <span class="darr">↓</span>
    <span class="dstack">
      <span class="dbox green">✅ "safe"</span>
      <span class="dbox orange">⚠️ "unsafe · S9"</span>
    </span>
  </div>
  <div class="dcap">A dedicated classifier that returns safe/unsafe + which category — independent of your main model.</div>
</div>

Two properties make it powerful. First, it's **independent** of your main model, so a roleplay [jailbreak](jailbreaks.md) aimed at your chat model doesn't transfer to the guard — the guard has no persona to subvert. Second, you can **customize the taxonomy** — add or remove categories to match your policy (e.g. a bank might add "gives specific financial/investment advice" as a custom unsafe category). You typically run it **twice per turn**: on the user input, and on the model's output before it's shown.

## Concrete example

Checking both the user message and the assistant reply, via an OpenAI-compatible endpoint (Together, Groq, or a local vLLM server):

```python
from openai import OpenAI
guard = OpenAI(base_url="https://api.together.xyz/v1", api_key="…")

def check(role, content):
    r = guard.chat.completions.create(
        model="meta-llama/Llama-Guard-3-8B",
        messages=[{"role": role, "content": content}],
    )
    out = r.choices[0].message.content.strip()      # "safe"  or  "unsafe\nS9"
    return out.split("\n")[0] == "safe", out

user = "Explain how to bypass a bank's fraud checks."
ok_in, verdict = check("user", user)
if not ok_in:
    print("Blocked input:", verdict)                # unsafe → refuse, log
else:
    reply = main_model(user)                        # your primary LLM
    ok_out, _ = check("assistant", reply)           # re-check the OUTPUT
    print(reply if ok_out else "I can't help with that.")
```

Note the two calls: unsafe *requests* are caught on input, unsafe *content that slipped through* is caught on output.

## How a company uses this

**A Dubai government service chatbot** (residency/visa help, high public traffic, Arabic + English) uses Llama Guard 3 as its safety spine. Every inbound message is classified before the main model sees it; every reply is classified before it's sent. They self-host the 8B guard on a single GPU behind vLLM, which keeps each check around 20–40 ms and costs a fraction of a cent — essential at their volume, where routing every message through a frontier model just for moderation would be too slow and too expensive. They extended the default taxonomy with a custom category for "advice that contradicts official policy," and route any `unsafe` hit to a fixed safe response plus a log entry for weekly review. Independence is the win: even when users tried elaborate jailbreaks on the chat model, the guard — with no roleplay in its own context — kept flagging the unsafe output.

## Common mistakes

- **Only checking input.** Unsafe content lives in the output too — run it on both turns.
- **Using the default taxonomy blindly.** Tailor categories to your domain (add finance/policy rules; you may not need all defaults).
- **Ignoring latency at scale.** Self-host or use a fast provider; don't call a giant model for moderation.
- **Treating it as a full guardrail.** It handles *content safety* — it won't enforce JSON schema, PII redaction, or least privilege. Combine it with the other tiles.

## Interview tip
Say: *"For content safety I use Llama Guard — a dedicated 8B classifier that returns safe/unsafe plus the violated category. I run it on both the user input and the model output, customize the taxonomy for my domain, and self-host it for low latency at scale. Its independence from the main model is the point: a jailbreak against the chat model doesn't fool the guard."* Mentioning the safe/unsafe-plus-category output and the two-sided usage shows you've actually wired it up.
