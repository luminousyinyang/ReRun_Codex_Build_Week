# ReRun

**Appointment television for your homework.** ReRun turns study material into an interactive retro-TV episode: the plot pauses at question beats, wrong answers play out as memorable consequences, and rewind gives a simpler explanation instead of replaying the same one.

ReRun is being built for the **OpenAI Build Week 2026 - Education** category. It is designed for high-school, college, and self-directed learners who want a more active alternative to passive study media.

> Status: the bundled demo is a no-key interactive broadcast. Its voice-aware narration catalog and asset prerender pipeline cover every line across all five pilots; until the checked-in MP3 bundle is rendered with `OPENAI_API_KEY`, demo playback falls directly to browser speech or its visible timer rather than calling live TTS. Configured OpenAI routes add AI narration, live scene art, and original-show themes with their own validated TTS voice and delivery direction for pasted notes.

## The missing visual layer

AI study podcasts can make material easier to listen to. ReRun is their visual, interactive complement: it turns source material into a television episode where learners see a concept in context, answer to keep the plot moving, and encounter a visible consequence or simpler re-explanation when needed.

It is not a passive video generator, and it does not claim that a visual format is best for every learner. The demonstrated value is an active learning loop inside a deliberately visual narrative.

## Why ReRun

The product's learning loop is deliberately active:

1. A learner supplies short notes or picks one of five bundled, topic-specific pilots.
2. The CRT television presents a story scene and stops at a question beat.
3. A correct response advances the plot. An incorrect response plays out the mistaken logic, gives an accurate correction, and enables an explicit retry.
4. Rewind requests a simpler explanation and a genuinely simpler rewording of the question. After two misses, the correct answer is revealed and the learner explicitly continues. Commercial breaks double as review questions.
5. The episode ends with a cliffhanger and an estimated review time.

This makes the demonstrated experience about retrieval practice, immediate corrective feedback, adaptive re-explanation, and spaced review - not passive AI consumption. ReRun does not claim that it replaces a teacher, tutor, or validated learning intervention.

## Judge-first demo mode

The P0 release includes five bundled deterministic pilots: circuits/Ohm's law, organelles, Newton's laws/forces, water cycle, and light reactions/Calvin-cycle setup. They require no API key, external media generation, account, or network call. The canonical judge path intentionally demonstrates the whole loop:

`power on -> choose a pilot -> recap -> CH 03 -> choose an incorrect answer -> consequence -> rewind -> simpler question -> commercial review -> cumulative finale -> cliffhanger`

Live generation is an enhancement for short pasted notes only. If configuration or a generation request is unavailable, the app must say so plainly and offer the bundled demo; it must never strand a learner in a loading state.

See [the judge guide](docs/DEMO_AND_JUDGE_GUIDE.md) for the expected path and [the implementation plan](docs/BUILD_PLAN.md) for scope.

## Run locally

```bash
npm install
cp .env.example .env.local # optional; demo mode works without it
npm run dev
```

Open `http://localhost:3000`, choose **Browse 5 demo shows**, then pick any pilot and complete the judge path above. Autoplay is on by default for ordinary narrative scenes; it shows an “Up next” dwell and can be turned off at any time. Do not commit `.env.local`; `.gitignore` protects secrets while preserving `.env.example`.

## Architecture at a glance

The renderer owns presentation and navigation. The model may author validated content but does not execute UI behavior.

`notes/PDF text -> ConceptGraph -> EpisodeSpec -> deterministic CRT renderer`

- **Client:** CRT shell, remote controls, subtitles, motion/audio preferences, and branching beat engine.
- **Server:** structured episode generation, TTS narration, safe original-theme normalization, and streamed scene-art routes.
- **Reliability:** Zod validation, one repair retry for generated structures, cached/bundled demo assets, and clear fallback states.

Five no-key pilots make the show-format choice explorable immediately: **The Photon Frontier** teaches circuits and Ohm's law, **The Cellular Casefile** organelles, **Power-Up Plant Lab** Newton's laws and forces, **The Tiny Lightkeepers** the water cycle, and **The Chloroplast Quest** light reactions and Calvin-cycle setup. Each is an independent 21-scene, three-act episode with three taught concepts, an Act 2 retrieval review, and a cumulative finale. Configured live episodes use a sanitized original theme, stream matching scene art without blocking playback, and retain deterministic fallback art if a request fails. Each theme selects a supported built-in TTS voice plus original delivery direction; `npm run prerender:demo-audio` writes the checked-in bundle for every demo line.

The full contract is in [Architecture](docs/ARCHITECTURE.md) and [EpisodeSpec v1](docs/EPISODE_SPEC.md).

## Documentation

- [Build plan](docs/BUILD_PLAN.md)
- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [EpisodeSpec v1 and bundled-pilot contract](docs/EPISODE_SPEC.md)
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
