# Test plan

## Automated checks

| Layer | Cases | Acceptance |
| --- | --- | --- |
| Schema + fixtures | all five bundled episodes parse; duplicate ID, missing route, duplicate option, multiple correct choices, and unsafe/invalid branch fail with useful diagnostics; each fixture has 21 scenes, a distinct topic/recap/difficulty, three concepts, a ≥3-step `teach` sequence before every graded check, mapped `teachesConcepts`, an Act 2 review, and cumulative Act 3 finale | only a validated, independently authored `EpisodeSpec` reaches the player |
| Live authoring guardrails | generated episode has three acts, ≥3 primary graded beats, a ≥3-step teaching phase before every question, objective-only `teachesConcepts`, compute `workedExample`s, own-concept Act 2 retrieval and cumulative finale, simpler question per beat, supportive manually acknowledged outcomes, bounded retry behavior, and reachable ending | generated content cannot weaken the demo's instruction, learning, or control contract |
| Beat engine | each teaching step must finish or be explicitly continued before the next step; choices appear only after the final teaching/worked-example step; correct answer advances; incorrect answer shows consequence; first retry is explicit; second miss reveals the answer and requires explicit continuation; commercial advances only when correct | no dead ends, unsupported questions, or accidental bypasses |
| Rewind | first and second levels select distinct simpler copy **and** `simplerQuestion`; rewind during a teaching phase has an explicit authored behavior and never skips a required step; failed live rewind retains original copy | factual content is never blank, a literal replay, or replaced by error text |
| Demo integration | no environment variables; clean-profile smoke opens and narrates every bundled pilot | no external network request is required, and bundled media resolves before `/api/tts` |
| API boundaries | input length/type checks, structured response parsing, repair retry, unavailable state | raw model output and secrets never reach client |
| Theme + art | preset validation, custom-theme sanitization, moderation failure, stable art cache key, preview/final fallback | no third-party IP reaches an art prompt and local art remains visible |
| Narration + manifests | finalized narration catalog generates matching TypeScript/public JSON manifests; manifest parity, voice-aware coverage, non-empty local files, all teaching/worked-example text, and all rewind levels are checked | every voiced demo line resolves a committed local asset before live TTS |
| Playback control | fake-timer tests cover teaching-step progression, lower-third persistence, Autoplay ON dwell after instruction, Autoplay OFF continue, pause freezing dwell, outcome hold, correction-narration gate, and answer-reveal cap | automation never bypasses a learner decision or a teaching step |

## Accessibility and visual checks

- Navigate the entire demo with keyboard only; verify a visible focus indicator and logical order.
- Check captions, mute, error states, and answer feedback without audio.
- Test 320px mobile width and desktop layouts; remote controls remain visible and usable.
- Test `prefers-reduced-motion`; static, panning, and VHS effects stop while state changes remain understandable.
- Confirm the AI voice disclosure remains visible and captions cover every spoken line.
- Confirm each teaching step is captioned, a supplied lower-third remains visible until replaced, and formula/key-term text is not embedded in the scene art.
- Run automated contrast/accessibility checks and manually inspect amber/green/red use against CRT black.

## Manual judge-flow test

1. Fresh clone, no `.env.local`.
2. Install, start, and build using the README instructions.
3. Complete the judge-guide path in a fresh browser profile, including every teaching step before the first check, and smoke every other pilot.
4. Confirm demo mode has no account, API key, live TTS request, or wait dependency beyond the visible autoplay dwell.
5. Test the deployed URL on desktop and mobile.
6. Compare README, video script, Devpost description, and `CODEX_LOG.md` to the shipped behavior; remove or correct every unverified claim.

## Release gate

Do not deploy or submit with a failing fixture/schema/audio-manifest test, a question reachable before its teaching phase, a compute check without its worked example, broken bounded-retry or autoplay-control path, inaccessible primary control, missing local narration asset, or a live-mode error that does not lead to demo mode.
