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
| `/api/episode` | `ConceptGraph`, difficulty, format | validated `EpisodeSpec` | one repair retry; then controlled unavailable result |
| `/api/beat/eval` | answer + rubric + scoped beat | `{ verdict, feedback, misconceptionKey? }` | P1 only; P0 MCQs are local/deterministic |
| `/api/rewind` | scene, level, excluded analogies | replacement line object | retain original line and report unavailable if generation fails |
| `/api/callin` | episode context + learner message | streaming Socratic reply | P1 only; never reveal the answer |
| `/api/schedule` | attempts/concept state | due concepts / airtime | local FSRS-lite fallback |

All mutation-like routes enforce input limits, server-side secret access, structured output validation, and request cancellation. Do not pass raw learner material to client-visible logs.

## Content pipeline

1. **Curriculum parser:** source text to a small `ConceptGraph` of objectives, facts, prerequisites, and misconceptions.
2. **Showrunner:** graph slice plus difficulty and channel to `EpisodeSpec` JSON through structured output.
3. **Validator:** Zod parses output; one constrained repair attempt may fix schema defects.
4. **Assets:** the P0 fixture references bundled, original scene art in `public/assets/scenes-v2/` and optional motion layers in `public/assets/motion/`; no media-generation request is needed during a demo. A scene may provide `visualAsset`; when it does not, the renderer chooses a local scene-type fallback. Motion-ready scenes compose a clean plate with transparent character poses and CSS-only atmosphere. Future asset jobs may cache stable character references and scene art by content hash, but they must never block playback or leave a learner waiting for an image to render.
5. **Broadcast:** player begins only from a fully validated fixture/spec.

## Storage and reliability

P0 stores anonymous progress locally and bundles the demo fixture in the repository. Future Supabase tables are `courses`, `episodes`, `attempts`, `concept_state`, and `schedule`; persistence is not a P0 dependency. Cache entries must be disposable and must not be required for the demo.

When a live dependency fails, show the themed error state, preserve entered text only locally where safe, and expose **Watch the demo**. Never silently substitute unrelated generated material.
