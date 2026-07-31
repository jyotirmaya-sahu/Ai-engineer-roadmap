# Audio

**What it is:** Getting speech *into* and *out of* your LLM app — **transcription** (audio → text), **text-to-speech** (text → audio), and newer **speech-to-speech** models that listen and reply in voice directly, in one call.

## Why it matters for an AI Engineer

Voice is the interface for phone support, call-center automation, voice assistants, accessibility, and hands-free apps — all big in a service-heavy market like Dubai. As an AI Engineer you'll wire audio around a text LLM (transcribe → reason → speak) or use an end-to-end voice model. Knowing the three building blocks — STT, TTS, and realtime speech — lets you assemble any voice product. It also teaches an important production lesson: audio is *streaming, latency-sensitive, and priced by duration*, which changes how you architect the app compared to plain text.

## The mechanism — how it works

Three capabilities:

**1. Speech-to-text (STT / transcription).** You upload an audio file (or stream it); a model like OpenAI's `whisper`/`gpt-4o-transcribe` returns the text, often with timestamps and language detection. Billed **per minute of audio**. Great for meetings, calls, voice notes — and it handles accented and multilingual audio well, which matters for Arabic/English mixing.

**2. Text-to-speech (TTS).** You send text and pick a voice; the model returns an audio file (mp3, wav, opus). Billed **per character** of input text. Used for reading answers aloud, IVR prompts, audiobooks.

**3. Speech-to-speech / Realtime.** A single model both *hears* audio and *speaks* back, over a persistent low-latency connection (WebSocket / WebRTC), keeping tone and interruption handling. This is what makes natural voice agents possible without stitching three services and eating their combined latency.

The classic **pipeline architecture** chains them: microphone → STT → LLM (your normal [messages](/working-with-llm-apis/messages-roles) call, often with [tools](function-tool-schemas.md)) → TTS → speaker. The **realtime architecture** collapses that into one model for lower latency but less control over each stage.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🎤 speech</span>
    <span class="darr">→<span class="lbl">STT</span></span>
    <span class="dbox orange">📝 text</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM<span class="sub">reason + tools</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">📝 reply text</span>
    <span class="darr">→<span class="lbl">TTS</span></span>
    <span class="dbox green">🔊 voice</span>
  </div>
  <div class="dcap">The pipeline voice app: transcribe, reason with a text LLM, speak the answer. Realtime models fuse these steps.</div>
</div>

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

# 1) Transcribe an audio file (speech -> text)
with open("customer_call.mp3", "rb") as f:
    tx = client.audio.transcriptions.create(model="gpt-4o-transcribe", file=f)
question = tx.text
print(question)   # "Wain maktab Downtown Dubai? Where is the Downtown office?"

# 2) Reason with a normal text LLM call
answer = client.chat.completions.create(
    model="gpt-4.1",
    messages=[{"role": "user", "content": question}],
).choices[0].message.content

# 3) Speak the answer (text -> speech)
speech = client.audio.speech.create(model="gpt-4o-mini-tts", voice="alloy", input=answer)
speech.stream_to_file("reply.mp3")
```

That's a complete voice-in/voice-out loop in three calls. For a live conversation you'd use the Realtime API over a WebSocket instead.

## How a company uses this

A Dubai telecom automates its first-line call center. **Production reality:** incoming calls stream to STT, the transcript hits an LLM with tools like `check_plan(number)` and `raise_ticket()`, and the reply is spoken back via TTS. Their hard constraint is **latency** — humans notice a gap over ~700ms, so they *stream* STT partials, start the LLM before the caller finishes, and stream TTS out. They moved the most latency-sensitive flows to a **realtime speech-to-speech** model to cut the three-hop delay. Cost is tracked by audio minutes (STT) and characters (TTS), and they route Arabic dialects to the transcription model that scored best on their test set.

## Common mistakes

- **Ignoring latency** — chaining STT→LLM→TTS serially feels sluggish; stream each stage and overlap them.
- **Forgetting audio is billed by duration/characters**, not tokens — a long call is a real cost.
- **Assuming perfect transcripts** — accents, background noise, and code-switching cause errors; prompt the LLM to tolerate imperfect input.
- **Sending whole long files when you could stream** — for live use, stream partials.
- **Not testing on your actual accent/language mix** — pick the STT model empirically for Arabic/English.

## Interview tip
Say: *"Voice apps are either a pipeline — STT to a normal text LLM to TTS — or a single realtime speech-to-speech model. The pipeline gives control; realtime gives latency. STT is billed per audio minute, TTS per character, and the whole thing is latency-bound, so I stream and overlap the stages to stay under the ~700ms humans notice."* Mentioning the latency budget and billing units shows you'd actually ship a voice product.
