# Demo and judge guide

## Zero-key path

1. Start the application with no environment variables.
2. Power on the television and choose **Load demo course**.
3. Complete the recap with `mitochondria` (or continue after feedback).
4. Start **The Light Reactions Heist** on CH 03.
5. At the ATP question, choose `DNA` to see the incorrect-answer consequence.
6. Choose **Rewind**, confirm the simpler explanation, then choose `ATP` on the variant beat.
7. At the NADPH question, choose `NADPH`; at the commercial, choose `Mitochondria` to skip.
8. Reach the cliffhanger and confirm the next-airtime card.

This path proves the core educational loop without an API key, login, pre-generated cloud asset, or live network dependency.

## Live mode

Add `OPENAI_API_KEY` in `.env.local` only to try short pasted-note ingestion. Live mode is optional and must be labeled as such. It may reject unsupported, unsafe, empty, or oversized content. If a model call, schema check, asset fetch, or rate limit fails, the app must preserve a clear explanation and offer the bundled demo.

## Expected controls

- Keyboard: Tab/Shift+Tab moves focus; Enter/Space activates controls; answer choices are reachable without a pointer.
- Captions: enabled by default and toggleable.
- Motion/audio: reduced-motion preference disables decorative motion; mute does not suppress visual feedback.

## Troubleshooting

| Symptom | Expected resolution |
| --- | --- |
| No API key | This is normal in demo mode; launch the bundled course. |
| Live generation unavailable | Show Technical Difficulties and return to/demo-launch action. |
| Schema validation fails | Do not render partial model output; retry once server-side, then use controlled fallback. |
| Audio blocked by browser | Continue with captions and visual feedback. |

## Clean-machine release check

Use a fresh clone and browser profile. Install dependencies, run the documented command, omit `.env.local`, complete the eight-step path, test keyboard and mobile width, build for production, then repeat against the deployed URL. Record the result and date in `CODEX_LOG.md`.
