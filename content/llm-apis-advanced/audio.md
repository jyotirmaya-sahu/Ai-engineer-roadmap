# Audio

**What it is:** Getting speech *into* and *out of* your LLM app — **transcription** (audio → text), **text-to-speech** (text → audio), and newer **speech-to-speech** models that listen and reply in voice directly, in one call.

> **Bridge from the previous tile.** Vision gave the model eyes; audio gives it **ears and a voice**. But there's a key difference: images ride *inside* the chat call, while audio mostly uses **dedicated endpoints** — `client.audio.transcriptions` to hear and `client.audio.speech` to speak — which you met in the endpoint-family map back in [SDK setup & call pattern](/working-with-llm-apis/sdk-setup-call-pattern). Same `client.<family>.<verb>` shape, new families.

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
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content": question}],
).choices[0].message.content

# 3) Speak the answer (text -> speech)
speech = client.audio.speech.create(model="gpt-4o-mini-tts", voice="alloy", input=answer)
speech.stream_to_file("reply.mp3")
```

That's a complete voice-in/voice-out loop in three calls. For a live conversation you'd use the Realtime API over a WebSocket instead.

## A few more capabilities you'll want

The three basics cover most apps, but these come up fast in real products:

- **Timestamps & diarization.** Transcription can return **word- or segment-level timestamps** (ask for `timestamp_granularities`), so you can build captions or jump to a moment. *Diarization* — labelling *who* spoke ("Speaker 1 / Speaker 2") — is essential for meeting and call transcripts; some models/services do it, others need a separate step.
- **Translation, not just transcription.** Whisper-family models can **transcribe-and-translate to English** in one step — useful for Arabic audio you want to reason over in English.
- **Audio straight into a chat model.** Beyond the transcription endpoint, some chat models accept an **audio content part** in the messages array (exactly like the image part from the Vision tile) and can even reply with audio — no separate STT hop. Handy when you want the model to hear *tone*, not just words.
- **Streaming TTS.** For low latency, stream the TTS audio out as it's generated (and STT partials in as the user speaks) instead of waiting for whole files — the same [streaming](/working-with-llm-apis/streaming) idea, applied to audio.

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

**Next up — [Embeddings API](embeddings-api.md).** That's the last of the multimodal inputs. The next group of endpoints is where text becomes *math you can search*: embeddings turn text into vectors, the foundation of semantic search and the entire RAG phase ahead.

## Practice — assignments

Write a program for each. Do them in order. You need `pip install openai` and `OPENAI_API_KEY` set, plus a short audio file (record a voice note).

1. Write a program that transcribes an audio file to text with the transcription endpoint and prints the result.

2. Write a program that takes a line of text, converts it to speech with a chosen voice, and saves it as an mp3 you can play.

3. Write a program that chains all three: transcribe a spoken question, send the text to a chat model, then speak the answer back to a new audio file — the full voice-in/voice-out loop.

4. Write a program that transcribes a file *with word- or segment-level timestamps* and prints each segment with its start time.

5. Write a program that transcribes a non-English (e.g. Arabic) clip and also produces its English translation, printing both.

6. Write a program that measures the latency of each stage (STT, LLM, TTS) separately and prints how long each took — so you can see where a voice app's delay comes from.

7. (Stretch) Write a program that streams the TTS output (or STT partials) instead of waiting for the whole file, and observe the time-to-first-audio versus the non-streaming version.
