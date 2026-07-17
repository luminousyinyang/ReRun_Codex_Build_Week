# ReRun

**Appointment television for your homework.** ReRun turns notes into an interactive retro-TV episode: it teaches before it asks, pauses for retrieval, and adapts a retry after a miss.

The no-key demo is fully playable offline: five original, voiced pilots, bundled MP3 narration, original scene/host art, captions, deterministic option shuffle, and local saved-episode storage. The media bundle is intentionally checked in so a judge can experience the full loop without an API key or a network call.

ReRun was pair-programmed with **Codex** end to end during OpenAI Build Week, and live episodes are written by **GPT-5.6** as validated structured output. See [Built with Codex and GPT-5.6](#built-with-codex-and-gpt-56) and the human-reviewed audit trail in [`CODEX_LOG.md`](CODEX_LOG.md).

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

## Built with Codex and GPT-5.6

ReRun was built in one week for OpenAI Build Week, pair-programmed with Codex throughout. The full, human-reviewed audit trail — every milestone, what Codex contributed, and how each change was verified — is in [`CODEX_LOG.md`](CODEX_LOG.md).

**How we collaborated with Codex.** We worked contract-first: architecture, the EpisodeSpec schema, scene-authoring rules, and the test plan were drafted on day one as a build contract, and Codex implemented against them. Every milestone was human-reviewed before it was logged, with the verification performed (typecheck, tests, production build, browser checks) recorded per entry.

**Where Codex accelerated the workflow.** Codex implemented the working core: the CRT player (a ~1,200-line React state machine covering shots, question takeovers, branch reactions, and reduced-motion support), the ~600-line Zod EpisodeSpec validator, the branching beat engine, all five API routes (episode, ingest, scene-image, TTS, video export), the demo-audio prerender pipeline, and the 25-test suite. The complete P0 interactive player — boot flow, recap, branching, commercial review, remote, responsive UI — shipped on the first build day, and the CRT viewport and framing went through three logged rework passes in the two days after.

**Key product, engineering, and design decisions were ours.** A judge-first MVP scope; bundling all 46 MB of original media (268 narration MP3s, 32 art plates) so the full demo needs no key and no network; the original-art-only guardrail in every image prompt; teach-before-ask enforced as a schema requirement rather than a prompt suggestion; and the positioning against passive audio study formats. Codex executed these decisions; it did not make them.

**How GPT-5.6 contributes to the final result.** GPT-5.6 (Responses API, structured outputs) is the runtime author: it writes each live episode against the EpisodeSpec schema, so every generated show is guaranteed to carry typed teach steps before its first question and a corrective retry branch per concept — pedagogy enforced at validation time. Around it, `gpt-image-2` streams per-scene art, `gpt-4o-mini-tts` voices the host, and `omni-moderation-latest` screens generation inputs.

## Safety

ReRun is study support, not grading or a substitute for instruction. Generated content is constrained to supplied material and uses original, classroom-safe themes; the app does not imitate named characters, artists, or studios.
