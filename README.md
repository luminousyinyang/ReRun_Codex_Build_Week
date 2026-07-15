# ReRun

**Appointment television for your homework.** ReRun turns study material into an interactive retro-TV episode: the plot pauses at question beats, wrong answers play out as memorable consequences, and rewind gives a simpler explanation instead of replaying the same one.

ReRun is being built for the **OpenAI Build Week 2026 - Education** category. It is designed for high-school, college, and self-directed learners who want a more active alternative to passive study media.

> Status: the bundled demo is a voiced-show-ready, deterministic interactive experience: it performs timed host chatter and auto-play without credentials, while configured OpenAI routes add AI narration, live scene art, and original-show themes for pasted notes.

## The missing visual layer

AI study podcasts can make material easier to listen to. ReRun is their visual, interactive complement: it turns source material into a television episode where learners see a concept in context, answer to keep the plot moving, and encounter a visible consequence or simpler re-explanation when needed.

It is not a passive video generator, and it does not claim that a visual format is best for every learner. The demonstrated value is an active learning loop inside a deliberately visual narrative.

## Why ReRun

The product's learning loop is deliberately active:

1. A learner supplies short notes or starts the bundled Photosynthesis course.
2. The CRT television presents a story scene and stops at a question beat.
3. A correct response advances the plot. An incorrect response plays out the mistaken logic, gives an accurate correction, and asks a variant question.
4. Rewind requests a simpler explanation with a different analogy. Commercial breaks double as review questions.
5. The episode ends with a cliffhanger and an estimated review time.

This makes the demonstrated experience about retrieval practice, immediate corrective feedback, adaptive re-explanation, and spaced review - not passive AI consumption. ReRun does not claim that it replaces a teacher, tutor, or validated learning intervention.

## Judge-first demo mode

The P0 release includes **Photosynthesis: Season 1**, a bundled deterministic course. It requires no API key, external media generation, account, or network call. The canonical judge path intentionally demonstrates the whole loop:

`power on -> load demo -> recap -> CH 03 -> choose an incorrect answer -> consequence -> rewind -> variant answer -> commercial review -> cliffhanger`

Live generation is an enhancement for short pasted notes only. If configuration or a generation request is unavailable, the app must say so plainly and offer the bundled demo; it must never strand a learner in a loading state.

See [the judge guide](docs/DEMO_AND_JUDGE_GUIDE.md) for the expected path and [the implementation plan](docs/BUILD_PLAN.md) for scope.

## Run locally

```bash
npm install
cp .env.example .env.local # optional; demo mode works without it
npm run dev
```

Open `http://localhost:3000`, choose **Load demo course**, and complete the judge path above. Do not commit `.env.local`; `.gitignore` protects secrets while preserving `.env.example`.

## Architecture at a glance

The renderer owns presentation and navigation. The model may author validated content but does not execute UI behavior.

`notes/PDF text -> ConceptGraph -> EpisodeSpec -> deterministic CRT renderer`

- **Client:** CRT shell, remote controls, subtitles, motion/audio preferences, and branching beat engine.
- **Server:** structured episode generation, TTS narration, safe original-theme normalization, and streamed scene-art routes.
- **Reliability:** Zod validation, one repair retry for generated structures, cached/bundled demo assets, and clear fallback states.

The Photosynthesis demo includes a local, original animated-world visual pack and never needs an API key. Configured live episodes use a sanitized original theme, stream matching scene art without blocking playback, and retain the same deterministic fallback art if a request fails. Audio is AI-generated when configured and is disclosed in the player.

The full contract is in [Architecture](docs/ARCHITECTURE.md) and [EpisodeSpec v1](docs/EPISODE_SPEC.md).

## Documentation

- [Build plan](docs/BUILD_PLAN.md)
- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [EpisodeSpec and Photosynthesis fixture](docs/EPISODE_SPEC.md)
- [Scene authoring guide](docs/SCENE_AUTHORING.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Demo and judge guide](docs/DEMO_AND_JUDGE_GUIDE.md)
- [Test plan](docs/TEST_PLAN.md)
- [Devpost submission guide](docs/DEVPOST_SUBMISSION.md)
- [Codex work log](CODEX_LOG.md)

## Accessibility and safety

The remote is keyboard-operable, focus-visible, caption-first, responsive, and respectful of `prefers-reduced-motion`. Generated educational content must be classroom-safe, age-appropriate, accurate within the supplied source material, free of real-person impersonation, and must not reveal an answer when the learner asks for a hint.

All shipped art, voices, sound, and video must be original, appropriately licensed, or generated for ReRun. Do not use third-party characters, trademarks, copyrighted music, or unlicensed study-video footage.

## Built with Codex + GPT-5.6

Codex is used to plan, scaffold, implement, test, and document the project. GPT-5.6 is the runtime intelligence for structured curriculum parsing, episode authoring, rubric-grounded evaluation, misconception-aware feedback, adaptive rewind explanations, and constrained Socratic call-in assistance. Each model output is bounded by a documented schema and is rendered by deterministic application code.

`CODEX_LOG.md` records meaningful, human-reviewed milestones. It is evidence of the process, not a substitute for the required `/feedback` session ID in the Devpost form.

## Testing and deployment

The test requirements cover schema validation, learning-flow branching, zero-key demo integration, accessibility, and a clean-machine judge run. Read [the test plan](docs/TEST_PLAN.md) before shipping.

Deploy to Vercel only after the demo works from a fresh browser profile. The release and submission requirements are in [the Devpost guide](docs/DEVPOST_SUBMISSION.md).

## License

See [LICENSE](LICENSE). ReRun remains a working name pending final trademark/name review by the project owner.
