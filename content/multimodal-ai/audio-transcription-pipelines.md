# Audio transcription pipelines

**What it is:** the real-world plumbing around an ASR model that turns *hours* of messy audio into clean, speaker-labelled, timestamped transcripts at scale.

## Why it matters for an AI Engineer

A single [Whisper](./speech-to-text-whisper.md) call transcribes a short clip. Production never gives you short clips — it gives you a 90-minute board meeting, a 3-hour podcast, or 50,000 call recordings overnight. And nobody wants a wall of text; they want **who said what, when**. Bridging "raw audio file" to "structured, searchable, speaker-labelled transcript" is the pipeline. This is exactly the kind of unglamorous glue work that separates an AI Engineer from someone who's only run a demo notebook.

## The mechanism / how it works

A robust pipeline is a sequence of stages, each solving one failure mode of the raw model:

1. **Ingest & normalize.** Accept any format (mp3, m4a, wav, video), convert to 16kHz mono WAV with `ffmpeg`. Wrong sample rate silently wrecks accuracy.
2. **Voice Activity Detection (VAD).** Detect where speech actually is and drop silence. This slashes cost (you don't transcribe dead air) and kills Whisper's **silence-hallucination** bug.
3. **Chunking.** Whisper works in 30-second windows. Split long audio on VAD boundaries (natural pauses) — never mid-word — into ~30s segments, keeping timestamps so you can stitch them back.
4. **Transcribe.** Run each chunk through Whisper, in parallel workers for throughput.
5. **Diarization.** Separately, a model like **pyannote** answers "how many speakers, and when did each talk?" — clustering voice fingerprints into `SPEAKER_00`, `SPEAKER_01`.
6. **Merge.** Align diarization time-spans with transcript timestamps so each sentence gets a speaker label.
7. **Post-process.** Punctuation cleanup, custom vocabulary correction, and formatting into your final structure (JSON, SRT subtitles, etc.).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎧 3-hour recording</span>
    <span class="darr">↓<span class="lbl">ffmpeg</span></span>
    <span class="dbox orange">🔇 VAD: drop silence</span>
    <span class="darr">↓</span>
    <span class="dbox orange">✂️ chunk ~30s on pauses</span>
    <span class="darr">↓<span class="lbl">parallel</span></span>
    <span class="dbox purple">🧠 Whisper per chunk</span>
    <span class="dbox purple">👥 pyannote diarize</span>
    <span class="darr">↓<span class="lbl">merge by timestamp</span></span>
    <span class="dbox green">📝 speaker-labelled transcript</span>
  </div>
  <div class="dcap">Transcription and diarization run in parallel, then merge on timestamps.</div>
</div>

## Concrete example

`whisperx` wraps this whole flow — batched Whisper + alignment + diarization:

```python
import whisperx

audio = whisperx.load_audio("meeting.mp3")

model = whisperx.load_model("large-v3", device="cuda", compute_type="float16")
result = model.transcribe(audio, batch_size=16)   # batched = fast

# word-level timestamp alignment
align_model, meta = whisperx.load_align_model(result["language"], device="cuda")
result = whisperx.align(result["segments"], align_model, meta, audio, device="cuda")

# who spoke when
diarize = whisperx.DiarizationPipeline(use_auth_token="HF_TOKEN", device="cuda")
speakers = diarize(audio)
result = whisperx.assign_word_speakers(speakers, result)

for seg in result["segments"]:
    print(f"[{seg['start']:.1f}s] {seg.get('speaker','?')}: {seg['text']}")
```

`whisperx` transcribes long audio **many times faster than plain Whisper** thanks to batching and VAD-based chunking.

## How a company uses this

> A **Dubai media firm** transcribes and subtitles Arabic/English TV interviews. Input clips run 20–60 minutes. Their pipeline: `ffmpeg` normalize → VAD → parallel `large-v3` transcription → `pyannote` diarization → merge → export **SRT subtitles** with speaker names. Scale: ~500 hours/month. Running on a single GPU with `whisperx` batching, a 40-minute clip finishes in ~3 minutes wall-clock — the batching is what makes the SLA feasible. Two production headaches: **code-switching** (a sentence flips Arabic↔English) that only `large-v3` handles well, and **diarization drift** on crosstalk (guests interrupting), which they fix with a human QA pass on flagged overlaps rather than trusting the model blindly.

## Common mistakes / misconceptions

- **Chunking blindly every 30s.** Cutting mid-word destroys accuracy at boundaries — split on VAD pauses instead.
- **Skipping VAD.** You pay to transcribe silence *and* get hallucinated text in the gaps.
- **Treating diarization as solved.** It's the least reliable stage; crosstalk and similar voices break it. Budget QA.
- **Serial processing.** A 3-hour file done chunk-by-chunk is painfully slow — parallelize the workers.

## Interview tip
Say: *"A transcription pipeline is more than a Whisper call: normalize with ffmpeg, VAD to drop silence and stop hallucinations, chunk on pauses not fixed intervals, transcribe in parallel, diarize with pyannote, then merge on timestamps. whisperx bundles this and batches for speed. Diarization is the flaky part — I budget human QA for crosstalk."* Mentioning VAD, pause-based chunking, and diarization-as-separate shows real pipeline experience.
