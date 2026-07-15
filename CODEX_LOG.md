# Codex work log

This is a concise, human-reviewed record of material Codex-assisted work. Keep it factual: update it when code or a decision actually ships, and never use it to imply a capability that was not built.

The Devpost submission still requires the `/feedback` session ID where most core functionality was developed.

| Date (PT) | Milestone | Codex contribution | Human review / outcome |
| --- | --- | --- | --- |
| 2026-07-14 | Product discovery | Read the ReRun PRD and supplied Player/print prototypes; extracted P0 loop, visual system, and implementation contracts. | Hybrid judge-first MVP selected; Player flow is canonical behavior reference. |
| 2026-07-14 | Hackathon readiness | Mapped the documentation package to OpenAI Build Week's Education category, submission deliverables, and judging criteria. | Compliance and final claims must be re-checked against live rules before submission. |
| 2026-07-14 | Documentation foundation | Drafted repository hygiene, architecture, EpisodeSpec, scene-authoring, test, judge, and submission documents. | Documents are a build contract; implementation entries will be appended as they land. |
| 2026-07-14 | P0 interactive player | Implemented the Next.js CRT player, Zod EpisodeSpec validator, bundled Photosynthesis fixture, branching beat engine, recap, rewind, commercial review, ratings, remote, and responsive/reduced-motion UI. | `npm run typecheck` and `npm run build` passed; browser-verified demo reaches the wrong-answer consequence branch without console errors. |
| 2026-07-14 | Optional live generation | Added server-side short-note validation and GPT-5.6 Responses structured-output episode route; missing-key and provider failures route learners back to the no-key demo. | Requires a real `OPENAI_API_KEY` for runtime exercise; demo path remains independent of it. |
| 2026-07-14 | Generated scene-art pass | Generated and bundled four original `gpt-image-2` frames for the Photosynthesis demo: Sunlight Vault, ATP Vault, Review Break, and Calvin Storm. | Prompts require original characters and prohibit text, logos, third-party characters, and imitation of named shows. The deterministic fixture uses local assets, while unknown/live scenes fall back by scene type so generation never blocks playback. |
| 2026-07-14 | Motion-performance pass | Converted the core episode path from single image frames into deterministic 2D scene composites: clean plates, chroma-keyed Professor Paws idle/talking poses, camera settle, atmosphere, beat/branch reactions, pause freezing, and reduced-motion support. | Local performance assets are bundled with the demo. The production pattern is documented so future subjects can add motion without making playback depend on a generation call. |
| 2026-07-14 | Player boot-flow correction | Restored the Player prototype’s one-time power-on flow: CRT boot line, brief gray static with white-noise cue, then ingest. Story navigation remains a direct program cut. | Source-checked against `ReRun Player.dc.html`; typecheck and production build pass. |
| 2026-07-15 | Fluid-shot and focus pass | Reworked playback into safe-frame 2.5D shots: uncropped 16:9 scene art over a CRT fill, drifting atmosphere, host performance, and scene-specific effects. Reframed questions as a blurred, signal-locked broadcast takeover with answer commitment feedback. | Production build/typecheck pass; desktop and phone viewport checks confirm the tube frame no longer crops the supplied 16:9 art. |
| 2026-07-15 | Tube viewport correction | Fixed an episode-height regression where the OSD header participated in document flow and pushed the bottom transport beyond the CRT viewport. The episode shell now owns a fixed height and the OSD is independently positioned. | Browser-verified on the wrong-answer/retry state: the complete `Rewind & retry` control remains inside the screen. |
| 2026-07-15 | Original animated-world art pass | Generated and bundled a four-plate original 2D animated scene set (Sunlight Vault, Energy Workshop, Review Break, and Calvin Storm), plus an original Professor Paws cutout. Replaced the demo’s painterly plates while retaining deterministic layered motion. | Assets were generated with the user-approved GPT Image CLI fallback, reviewed before wiring, and constrained to no text, logos, third-party characters, or imitation of existing shows. `npm run typecheck` and `npm run build` pass. |
| 2026-07-15 | Visual-format positioning | Clarified the judge-facing product thesis: AI study podcasts are audio-first; ReRun is the complementary visual, interactive format where a learner must answer inside a television episode. | Updated README, product, judge, and Devpost guidance with a deliberately bounded claim; it does not assert that visual study is best for every learner. |

## Logging rules

- Add one entry for a meaningful shipped feature, test suite, deployment milestone, or material design decision.
- Name the artifact or behavior affected and the verification performed.
- Keep prompts, secret values, personal data, and raw user study responses out of this file.
- Record uncertainty honestly; do not convert plans into completed work.
