# Text-to-speech

**What it is:** the reverse of transcription — turning written text into natural-sounding spoken audio (TTS).

## Why it matters for an AI Engineer

If speech-to-text is the ears of your app, text-to-speech (TTS) is the mouth. It's what makes a **voice agent** feel like a phone call instead of a chat window. Any product where the user shouldn't be staring at a screen — a driving assistant, an IVR phone line, an accessibility reader, a language-learning app — needs TTS. Modern neural TTS crossed the "sounds human" line: 2026 models produce speech with correct emotion, pacing, and even the ability to clone a specific voice from seconds of sample audio. The engineering challenge shifts from "is it intelligible?" to "is it fast enough and cheap enough to stream in real time?"

## The mechanism / how it works

Old TTS glued together recorded sound snippets (concatenative) and sounded robotic. Modern **neural TTS** generates the waveform from scratch. The typical pipeline:

1. **Text normalization.** "Dr. Smith paid AED 1,500 on 3/4" must become "Doctor Smith paid one thousand five hundred dirhams on the third of April." This front-end handles numbers, dates, currencies, abbreviations — and it's where a lot of quality bugs live.
2. **Text → acoustic features.** A neural model (often transformer-based) maps the normalized text to a **Mel-spectrogram** — the same frequency-over-time picture Whisper *reads*, but here the model *writes* it. Prosody (rhythm, stress, intonation) is decided here.
3. **Vocoder.** A second model turns the spectrogram into an actual audio waveform you can play.

Two things you tune in practice: **voice** (pick from a library, or clone one) and **latency mode**. For a live agent you want **streaming** TTS — audio starts playing while the rest is still being generated, so the user hears the first word in ~200–400ms instead of waiting for the whole sentence. The relevant metric is **time-to-first-byte (TTFB)**, not total generation time.

## Concrete example

OpenAI hosted TTS, streaming to a file:

```python
from openai import OpenAI
client = OpenAI()

with client.audio.speech.with_streaming_response.create(
    model="gpt-4o-mini-tts",   # fast, cheap, expressive
    voice="alloy",
    input="Marhaba! Your claim number is 4-4-7-2. We'll call you back within an hour.",
    instructions="Speak warmly, at a calm pace.",  # steer tone
) as response:
    response.stream_to_file("reply.mp3")
```

For voice cloning / lowest latency, teams often reach for **ElevenLabs** or open models like **Kokoro** (tiny, fast, runs locally) or **XTTS-v2** (open, multilingual, clones a voice from ~6 seconds of reference audio).

## How a company uses this

> A **Dubai bank's phone banking line** replaced its stiff recorded IVR with a neural voice agent. Whisper transcribes what the caller says, an LLM decides the answer, and **streaming TTS** speaks it back. The hard constraint is **end-to-end latency under ~800ms** — beyond that, the pause feels broken and callers talk over the bot. To hit it they stream TTS (first audio at ~300ms), run the LLM with a small fast model for routing, and only escalate to a big model when needed. Cost matters at telephony scale: at ~$15 per million characters, a bank handling millions of minutes budgets TTS as a real line item and caps response length. They also maintain a **pronunciation dictionary** so Arabic names and product terms ("Emirates NBD") are spoken correctly instead of mangled by the normalizer.

## Common mistakes / misconceptions

- **Generating the whole clip before playing.** Kills the illusion of conversation. Stream it; optimize TTFB.
- **Ignoring text normalization.** The model will read "AED 1,500" as "a-e-d one comma five zero zero" if you don't handle it. Normalize numbers, currencies, and phone numbers explicitly.
- **Cloning voices without consent.** Voice cloning is a legal and ethical landmine — only clone voices you have rights to.
- **Picking a giant model for a phone line.** Latency beats fidelity for live agents; a smaller streaming model often wins.

## Interview tip
Say: *"For a voice agent the metric that matters is time-to-first-byte, not total generation time — I stream TTS so the user hears the first word in ~300ms. The quality traps are text normalization (numbers, currencies, names) and pronunciation dictionaries for domain terms."* Pairing TTS with STT ([speech-to-text](./speech-to-text-whisper.md)) as the two halves of a voice loop shows you see the whole system.
