# Build plan

## Delivery target

Ship a runnable, hosted Education-category web app by July 21, 2026, with a complete no-key judge experience and a truthful explanation of how Codex and GPT-5.6 were used. The P0 path is the only promise: **topic-specific demo -> learner-paced teaching phase -> CH 03 retrieval loop**.

## Scope

| Priority | Ship | Deliberately defer |
| --- | --- | --- |
| P0 | CRT shell and remote; five bundled topic-specific pilots; recap; learner-paced teaching before every beat; worked examples for calculation checks; consequence flow; adaptive retry; spaced retrieval review; ratings display; cliffhanger; multi-format ingest; responsive/a11y basics; judge docs | None |
| P1 | Game Show, call-in chat, fast-forward mastery gate, static channels, TV Guide UI, CH 99 intervention | Only after all P0 checks pass |
| P2 | Accounts, teacher dashboard, rich PDF/OCR, multiplayer, video generation, native app, multi-episode seasons | Do not start during Build Week |

## Dependency order

1. Scaffold Next.js 15, TypeScript, Tailwind, Zod, test runner, `.env.example`, and the design tokens.
2. Freeze `EpisodeSpec`; add fixtures and validation tests before UI work.
3. Implement the deterministic player and demo courses, including every P0 teaching phase and branch.
4. Add API route contracts, live short-note parsing, structured episode generation, and safe fallback to demo.
5. Add polish: captions, audio optionality, reduced motion, error cards, mobile remote, and caching.
6. Run the judge path from a clean browser and deploy before recording the video.

## Day-by-day sequence

| Day | Outcome |
| --- | --- |
| Jul 13-14 | Contracts, repository hygiene, static CRT shell, visual tokens, and fixture validation |
| Jul 15 | Demo player: scene navigation, MCQ beat, correct/incorrect branch |
| Jul 16 | Consequences, variant re-ask, rewind state, spaced retrieval review |
| Jul 17 | Ingest and structured generation behind the demo fallback; recap and ratings |
| Jul 18 | Cliffhanger/schedule card, a11y, responsive layout, sound and motion polish |
| Jul 19 | Bug bash, production deployment, clean-machine run, and small user test |
| Jul 20 | Record/edit the <3-minute demo and reconcile README, video, and Devpost copy |
| Jul 21 AM | Final smoke test; submit early with the required session ID |

## Cut line

If live generation is unreliable, preserve the bundled demo and remove live UI affordances rather than showing a broken flow. If any P1 work conflicts with zero-key demo quality, cut P1 immediately.

## Definition of Done

- A fresh clone can install, run, and complete the bundled demo without secrets.
- The intended teaching, incorrect-answer, rewind, variant-answer, commercial, and cliffhanger loop works with keyboard and pointer input.
- All episode data passes Zod validation and invalid data produces a controlled technical-difficulties state.
- A deployed URL, public-or-judge-shared repository, README, demo video, category, and `/feedback` session ID are ready before submission.
