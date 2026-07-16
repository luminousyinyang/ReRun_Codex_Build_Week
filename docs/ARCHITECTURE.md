# Architecture

ReRun is a deterministic player around validated episode data. Models may extract source material or author an `EpisodeSpec`; they never control browser state.

```text
notes or files -> /api/ingest -> editable source text -> /api/episode -> validated EpisodeSpec -> CRT player
```

`/api/ingest` receives multipart files. Plain text is read locally; PDFs/documents/slides use Responses file input, images use vision, and supported audio/video uses transcription. If text is too long, a constrained condensation pass preserves concepts, definitions, formulas, and examples before returning at most 12,000 editable characters.

`/api/episode` receives the final text plus a preset or original theme. It validates input, normalizes custom vibes, produces structured output, validates the result against the runtime schema, and returns actionable 422 errors for learner-fixable theme input. Provider failures remain a generic unavailable result.

The client owns scene traversal, narration, retries, pause/play, channel navigation, captions, mute, local ratings, and localStorage saved episodes. Bundled demo MP3s and art make the five pilots work without a key. Live scene art is optional and never blocks playback.
