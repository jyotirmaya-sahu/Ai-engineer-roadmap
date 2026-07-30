# Speech-to-text (Whisper)

**What it is:** turning spoken audio into written text using an Automatic Speech Recognition (ASR) model — Whisper being the open, workhorse standard.

## Why it matters for an AI Engineer

Voice is how humans actually talk to machines now — voice notes, call recordings, dictation, meeting audio. But an LLM can't read a `.mp3`; it reads tokens. Speech-to-text (STT) is the gateway: it converts audio into the text that every downstream LLM step depends on. If transcription is wrong, everything after it — summary, sentiment, the agent's reply — is wrong. It's also cheap and fast enough to be a default building block: OpenAI's hosted Whisper costs about **$0.006 per minute** of audio, and open-source Whisper runs on your own GPU for the price of electricity.

## The mechanism / how it works

Whisper is a **transformer trained on 680,000 hours of audio paired with transcripts** scraped from the web, across ~100 languages. It works in a few stages:

1. **Audio → spectrogram.** Raw sound is a waveform. Whisper first converts it into a **log-Mel spectrogram** — a picture of which frequencies are loud at each moment (30-second windows). This is the "image" the model actually looks at.
2. **Encoder.** A transformer encoder reads the spectrogram and produces a sequence of audio feature vectors.
3. **Decoder.** A second transformer *generates text tokens* one at a time, attending to those audio features — exactly like a language model predicting the next word, but conditioned on sound. Because it's a language model at heart, it also learns punctuation, casing, and can even translate speech to English.

Whisper comes in sizes — `tiny`, `base`, `small`, `medium`, `large-v3`, plus the faster `turbo`. Bigger = more accurate, slower, more VRAM. `large-v3` is the accuracy king; `turbo` is near-large accuracy at several times the speed.

Key limitation: Whisper processes audio in **30-second windows**. Anything longer must be chunked (that's the [audio transcription pipelines](./audio-transcription-pipelines.md) tile). It also has no idea *who* is speaking — for that you add diarization separately.

## Concrete example

Hosted API (simplest, no GPU):

```python
from openai import OpenAI
client = OpenAI()

with open("voicenote.mp3", "rb") as f:
    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=f,
        language="en",              # skip to auto-detect
        response_format="verbose_json",  # gives timestamps
    )
print(result.text)
```

Local, free, with the faster reimplementation `faster-whisper`:

```python
from faster_whisper import WhisperModel

model = WhisperModel("large-v3", device="cuda", compute_type="float16")
segments, info = model.transcribe("voicenote.mp3", beam_size=5)

print("Detected language:", info.language)
for seg in segments:
    print(f"[{seg.start:.1f}s → {seg.end:.1f}s] {seg.text}")
```

`faster-whisper` (built on CTranslate2) is roughly **4× faster and uses ~half the memory** of the reference implementation for the same accuracy — the default choice for self-hosting.

## How a company uses this

> A **Dubai call center** transcribes every support call for QA and analytics. At ~10,000 calls/day averaging 6 minutes, that's 60,000 audio-minutes daily. On the hosted API that's ~**$360/day**; self-hosting `large-v3` on a couple of A10 GPUs drops the marginal cost to near-zero but adds ops burden. They run `large-v3` because Gulf calls mix **Arabic and English mid-sentence** (code-switching), and the smaller models garble it. Latency budget: transcription must finish within a minute of call-end to feed the same-day QA dashboard, so they process calls in parallel worker queues rather than one giant batch.

Production gotchas that bite here: **hallucination on silence** (Whisper invents text during long pauses — feed it a voice-activity filter first), and **domain vocabulary** (product names, Arabic names) that it mis-spells — fixable with an `initial_prompt` hint listing expected terms.

## Common mistakes / misconceptions

- **Feeding it >30s and expecting magic.** The API chunks for you, but naive local code truncates at 30s. Use a pipeline for long audio.
- **Ignoring silence hallucination.** Whisper will confidently transcribe "Thank you for watching" into dead air. Add a VAD (voice activity detection) filter.
- **Assuming it knows speakers.** Whisper gives you *what* was said, never *who*. Diarization is a separate step.
- **Using `large-v3` when `turbo` would do.** For clean single-language audio, `turbo` is far cheaper/faster at nearly the same accuracy.

## Interview tip
Say: *"Whisper is an encoder-decoder transformer that turns a Mel-spectrogram into text; it works in 30-second windows, so long audio needs a chunking pipeline, and it doesn't do speaker diarization — that's bolted on. In production I use faster-whisper for cost, add a VAD to kill silence hallucinations, and pass domain terms via initial_prompt."* Naming the 30-second window and the silence-hallucination bug signals you've actually shipped it.
