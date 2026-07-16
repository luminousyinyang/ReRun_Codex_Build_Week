# Demo and judge guide

## Zero-key path

1. Start the application with no environment variables.
2. Power on the television and choose **Browse 5 demo shows**.
3. Choose **The Photon Frontier** (circuits and Ohm's law) and complete its topic-specific recap.
4. Confirm **Autoplay ON**. Watch a normal narrative scene: an “Up next” affordance appears and advances only after the 1.6-second dwell.
5. At the first graded question, choose a distractor to see its supportive incorrect-answer consequence. The player must not auto-advance this outcome.
6. Wait for corrective narration to complete, then choose **Rewind & retry**. Confirm both the simpler caption and the simpler question wording appear; answer correctly.
7. Turn **Autoplay OFF** and confirm a normal narrative scene now waits for **Continue**. Pause during an autoplay dwell and confirm the dwell is frozen.
8. At a later beat, deliberately miss twice. Confirm the second miss reveals the answer and explanation and requires **Continue with answer**.
9. Complete the Act 2 retrieval review and Act 3 cumulative finale, then confirm the reachable cliffhanger and next-airtime card.

This path proves the core educational loop, learner-controlled playback, bounded retries, and no-key fallback. The release gate additionally requires the locally prerendered narration bundle and subject-matched plates before claiming full local media coverage.

## What the demo demonstrates

Study podcasts are useful audio-first tools. This demo shows ReRun's complementary visual and interactive format: a concept is situated in a scene, a learner must answer to move the program forward, an incorrect answer receives a visible-but-kind consequence and correction, and rewind returns with a simpler explanation. The experience demonstrates an active learning loop, not a claim that a television format works better for every learner.

## Live mode

Add `OPENAI_API_KEY` in `.env.local` only to try short pasted-note ingestion. Live mode is optional and must be labeled as such. It may reject unsupported, unsafe, empty, or oversized content. If a model call, schema check, asset fetch, or rate limit fails, the app must preserve a clear explanation and offer the bundled demo.

## Expected controls

- Keyboard: Tab/Shift+Tab moves focus; Enter/Space activates controls; answer choices are reachable without a pointer.
- Captions: enabled by default and toggleable.
- Motion/audio: reduced-motion preference disables decorative motion; mute does not suppress visual feedback.
- Autoplay: defaults on only for ordinary narrative scenes, shows the visible dwell, and never advances a branch outcome, beat, commercial, or answer reveal. Pausing freezes a pending dwell.
- Retry: **Rewind & retry** stays unavailable until correction narration ends. The second wrong attempt always exposes the answer and requires explicit continuation.

## Troubleshooting

| Symptom | Expected resolution |
| --- | --- |
| No API key | This is normal in demo mode; launch the bundled course. |
| Live generation unavailable | Show Technical Difficulties and return to/demo-launch action. |
| Schema validation fails | Do not render partial model output; retry once server-side, then use controlled fallback. |
| Audio blocked by browser | Continue with captions and visual feedback; local MP3 fallback should already have been attempted before live TTS. |

## Clean-machine release check

Use a fresh clone and browser profile. Install dependencies, run the documented command, omit `.env.local`, and open every one of the five pilots. Confirm each starts with a local narration file (no `/api/tts` request), complete the judge path above, test keyboard and mobile width, build for production, then repeat against the deployed URL. Record the result and date in `CODEX_LOG.md`.
