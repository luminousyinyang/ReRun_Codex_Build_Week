# ReRun

**Appointment television for your homework.** ReRun turns notes into an interactive retro-TV episode: it teaches before it asks, pauses for retrieval, and adapts a retry after a miss.

The no-key demo is fully playable offline: five original, voiced pilots, bundled MP3 narration, original scene/host art, captions, deterministic option shuffle, and local saved-episode storage. The media bundle is intentionally checked in so a judge can experience the full loop without an API key or a network call.

## Judge path

Power on, select any show from the lineup, complete the recap, watch the teaching steps, intentionally miss a question, then select **Rewind & retry**. The corrective branch returns to the authored simpler question after one cue; a second miss reveals the answer. The remote’s pause/play, rewind, fast-forward, AUTO, captions, mute, and ratings controls all operate real player state. Use the TV guide to change shows.

Each pilot occupies its own channel (CH 04–08). The Act 2 retrieval check and finale are both part of the aired path.

## Bring your own material

Paste notes or add text, PDF, DOCX, PPTX, CSV, photo, audio, or video files. Extracted text is placed back into the editable notes box before generation. Audio/video must be under 25 MB; `.mov` should be exported as mp4 or webm. On Vercel, large uploads can exceed platform request limits, so the full multi-file demo is best shown locally.

Configured live generation uses GPT-5.6 and an original-theme guardrail. GPT-5.6 access can be restricted by project; if your key cannot use it, set `OPENAI_MODEL` to a model available to your project. The production **Please Stand By** screen remains visible while the episode is written; after validation, an illustration screen streams original per-scene art previews and final images. A failed art request falls back to the built-in scene treatment instead of blocking playback.

Saved generated episodes appear in **Your recent episodes** for seven days. After their artwork is ready, **Download video** captures the show in the browser and sends the WebM recording to the local server for MP4 conversion. Video export needs a supported browser and a live key for its narrated scenes. It uses `ffmpeg` when available (set `FFMPEG_PATH` when it is not on the server `PATH`), but safely downloads the valid WebM recording when no encoder is installed. The bundled no-key pilots remain the reliable judge path.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. No `.env` file is needed for the bundled demo. Add `OPENAI_API_KEY` only for live generation, extraction, narration, or scene art.

## Verification

```bash
npm run typecheck
npm run test
npm run build
```


## Safety

ReRun is study support, not grading or a substitute for instruction. Generated content is constrained to supplied material and uses original, classroom-safe themes; the app does not imitate named characters, artists, or studios.
