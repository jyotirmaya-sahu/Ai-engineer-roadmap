# Multimodal models (text+image+audio)

**What it is:** a *single* model that natively takes text, images, and audio together in one request — and can respond across modalities — instead of chaining separate specialist tools.

## Why it matters for an AI Engineer

Everything else in this node — [Whisper](./speech-to-text-whisper.md), [OCR](./ocr.md), [VLMs](./vision-llms-vlms.md), [TTS](./text-to-speech.md) — historically meant stitching four models into a pipeline. Native multimodal models (GPT-4o and o-series, Gemini 2.x, Claude with vision) collapse much of that into one API call: send a screenshot *and* a voice clip *and* a question, get an answer. This is the biggest architecture shift in applied AI — it simplifies your stack, cuts latency, and preserves information that pipelines throw away (tone of voice, visual context). Knowing *when* the one-model approach beats the pipeline — and when it doesn't — is a core 2026 AI-Engineer judgment call.

## The mechanism / how it works

The unifying trick is: **turn every modality into tokens in one shared sequence.**

1. **Modality-specific encoders.** Text is tokenized normally. An image is cut into patches → visual tokens (see [VLMs](./vision-llms-vlms.md)). Audio is turned into a spectrogram → audio tokens.
2. **One shared token stream.** All those tokens — text, image, audio — are placed into a *single* sequence and fed to the same transformer. The model attends across all of them at once, so it can literally reason about "the tone in this audio combined with what's on this screenshot."
3. **Any-to-any output (increasingly).** The newest models generate non-text too: emit audio tokens (native speech, no separate TTS) or image tokens. GPT-4o's voice mode is one model hearing *and* speaking — which is why it captures emotion and interruptions a Whisper→LLM→TTS pipeline flattens.

**Pipeline vs. native — the real trade-off:**

<div class="diagram">
  <div class="flow v">
    <div class="dgroup"><span class="dgt">PIPELINE (specialists)</span>
      <div class="flow">
        <span class="dbox gray">🎤</span><span class="darr">→</span>
        <span class="dbox purple">Whisper</span><span class="darr">→</span>
        <span class="dbox purple">LLM</span><span class="darr">→</span>
        <span class="dbox purple">TTS</span><span class="darr">→</span>
        <span class="dbox green">🔊</span>
      </div>
    </div>
    <div class="dgroup"><span class="dgt">NATIVE MULTIMODAL</span>
      <div class="flow">
        <span class="dbox gray">🎤🖼️💬</span><span class="darr">→</span>
        <span class="dbox purple">one model</span><span class="darr">→</span>
        <span class="dbox green">🔊📝</span>
      </div>
    </div>
  </div>
  <div class="dcap">Native models fuse modalities in one pass — lower latency, keeps tone/context a pipeline loses.</div>
</div>

Native wins on **latency** (one call, not four), **richness** (tone, emotion, visual nuance survive), and **simplicity**. Pipelines still win on **cost** (a $0.006/min Whisper call beats sending audio through a frontier model), **control/accuracy on narrow tasks**, and **swappability** (upgrade one stage without touching the rest).

## Concrete example

One call, image + text together (and you can add audio input the same way):

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": [
        {"type": "text", "text": "Read this receipt and tell me if the tip looks right."},
        {"type": "image_url", "image_url": {"url": "https://x/receipt.jpg"}},
    ]}],
)
print(resp.choices[0].message.content)   # one model does OCR + reasoning
```

No separate OCR step — the native model reads *and* reasons in a single pass. For live voice, the Realtime API streams audio in and speech out through one model, hitting sub-second turn-taking a pipeline struggles to match.

## How a company uses this

> A **Dubai telecom** rebuilt its customer-support voice bot on a native realtime multimodal model. The old stack (Whisper → LLM → TTS) added up to ~1.5s of latency per turn and lost the caller's frustration cues in transcription. The native model hears tone, handles interruptions, and replies in ~600ms — callers stop talking over it. But they *kept the pipeline* for one thing: **bulk overnight transcription** of recorded calls for analytics, where latency doesn't matter and Whisper is ~20× cheaper per minute than routing audio through the frontier model. That split — **native for live/interactive, specialists for high-volume batch** — is the pragmatic 2026 architecture. They also found native models pricier per request, so they cap context and downscale images to control the bill.

## Common mistakes / misconceptions

- **"Native replaces everything."** For high-volume batch (transcribe a million calls), cheap specialists still win big on cost.
- **Ignoring cost.** Pushing audio/high-res images through a frontier model is far pricier than a dedicated tool. Reserve native for where its richness pays off.
- **Losing swappability.** One monolithic model means you can't upgrade just the OCR or just the TTS — you're tied to the provider's whole stack.
- **Assuming any-to-any everywhere.** Not all models emit audio/images natively; check what output modalities each actually supports.

## Interview tip
Say: *"Native multimodal models fuse text, image, and audio into one token stream, so they reason across modalities in a single pass — great for live voice where latency and tone matter. But it's a trade-off: pipelines of specialists (Whisper, OCR, TTS) still win on cost, narrow-task accuracy, and swappability. My rule of thumb: native for interactive real-time, specialist pipelines for high-volume batch."* That explicit trade-off — and knowing when *not* to use the shiny model — is exactly the senior judgment interviewers probe for.
