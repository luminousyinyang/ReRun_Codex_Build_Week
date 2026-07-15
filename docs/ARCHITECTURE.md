# Architecture

## Boundary

The application is a deterministic renderer around validated content. GPT-5.6 may author or evaluate educational content; it does not decide browser state, execute code, access secrets, or bypass the `EpisodeSpec` contract.

```text
source text -> /api/ingest -> ConceptGraph -> /api/episode -> EpisodeSpec
                                                       |                 |
                                                       v                 v
                                               asset/cache jobs     CRT Player
```

## Client

The React client owns the CRT shell, scene traversal, branch transitions, remote actions, captions, reduced-motion behavior, local anonymous attempts, and the technical-difficulties fallback. It accepts only validated episode data.

## Server route contracts

| Route | Input | Success | Failure / fallback |
| --- | --- | --- | --- |
| `/api/ingest` | `{ text }` | `ConceptGraph` | rejects empty/oversize/non-educational input; client offers demo |
| `/api/episode` | `{ text, themeInput }` | validated `EpisodeSpec`, normalized `ShowTheme` | custom vibes are sanitized/moderated; then controlled unavailable result |
| `/api/tts` | `{ text, voice?, instructions? }` | streamed MP3 narration | unavailable in zero-key demo; client uses timed chatter fallback |
| `/api/scene-image` | validated scene + sanitized `ShowTheme` | SSE preview/final JPEG events | bounded session cache; renderer keeps its local fallback |
| `/api/beat/eval` | answer + rubric + scoped beat | `{ verdict, feedback, misconceptionKey? }` | P1 only; P0 MCQs are local/deterministic |
| `/api/rewind` | scene, level, excluded analogies | replacement line object | retain original line and report unavailable if generation fails |
| `/api/callin` | episode context + learner message | streaming Socratic reply | P1 only; never reveal the answer |
| `/api/schedule` | attempts/concept state | due concepts / airtime | local FSRS-lite fallback |

All mutation-like routes enforce input limits, server-side secret access, structured output validation, and request cancellation. Do not pass raw learner material to client-visible logs.

## Content pipeline

1. **Curriculum parser:** source text to a small `ConceptGraph` of objectives, facts, prerequisites, and misconceptions.
2. **Showrunner:** graph slice plus difficulty and channel to `EpisodeSpec` JSON through structured output.
3. **Validator:** Zod parses output; one constrained repair attempt may fix schema defects.
4. **Assets:** the fixture references bundled original scene art and optional host motion layers; no media-generation request is needed during a demo. Live art uses a server-compiled flat-cel prompt, streams a preview/final JPEG pair, and is cached only in the browser session plus a bounded process cache. The renderer always keeps a local fallback visible while artwork is generated.
5. **Broadcast:** player begins only from a fully validated fixture/spec.

## Storage and reliability

P0 stores anonymous progress locally and bundles the demo fixture in the repository. Future Supabase tables are `courses`, `episodes`, `attempts`, `concept_state`, and `schedule`; persistence is not a P0 dependency. Cache entries must be disposable and must not be required for the demo.

When a live dependency fails, show the themed error state, preserve entered text only locally where safe, and expose **Watch the demo**. Never silently substitute unrelated generated material.
