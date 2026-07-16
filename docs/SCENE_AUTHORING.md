# Scene authoring guide

## Non-negotiable rules

- Write from supplied material or the approved bundled curriculum; do not invent contested facts or citations.
- Every incorrect answer gets a concise, accurate, supportive correction. Never mock, shame, punish, or call a learner careless.
- Use classroom-safe language for ages 13+; no real public figures, copyrighted characters, gore, unsafe scenarios, or visible text in generated art.
- Keep each line short enough for captions on a television screen. Let interaction carry the lesson rather than long exposition.
- The host can be playful and Socratic but cannot reveal a call-in answer before the learner attempts it.

## Round 5 episode recipe

Author a complete 21-scene, three-act learning story—not a skin of another subject.

| Act | Learning purpose | Required evidence |
| --- | --- | --- |
| Recap / Act 1 | establish the topic and teach its first concepts | topic-specific recap and initial instruction/graded beats |
| Act 2 | retrieve and extend Act 1 learning | a review beat whose `reviewsConcepts` includes an Act 1 concept key |
| Act 3 | integrate the episode's learning | cumulative finale whose `reviewsConcepts` covers the taught concepts, then a reachable cliffhanger |

Every pilot teaches three concepts. The bundled library covers circuits/Ohm's law, organelles, Newton's laws/forces, water cycle, and light reactions/Calvin-cycle setup. Do not reuse photosynthesis questions, recap copy, or consequence scenes for the non-photosynthesis shows.

Live-generated episodes follow this exact learning shape as a minimum: three acts, at least three primary graded beats, their own-concept mid-episode retrieval, and their own-concept cumulative finale. Treat these as authoring guardrails: a live episode that cannot establish all routes, supportive outcomes, simpler questions, and a reachable ending is rejected before the player opens it.

## Scene recipes

| Scene | Purpose | Required ingredients |
| --- | --- | --- |
| Recap | warm up retrieval | one topic-specific prior fact, accepted answers, concept key |
| Narrative | establish a meaningful problem | visual metaphor, one factual claim, optional deep-dive and rewind lines |
| Beat | require active retrieval | one objective, 2–4 unique plausible options, one correct answer, difficulty, `simplerQuestion`, review keys, valid destinations |
| Branch outcome | correct a misconception kindly | visible consequence, exact refutation, route back to the beat |
| Commercial | make spaced review feel in-universe | a previously taught concept and answer-required continuation |
| Cliffhanger | create return motivation | next-concept teaser and computed review time |

## Question, retry, and rewind design

Distractors should map to realistic misconceptions, not joke choices. Each beat needs a `simplerQuestion` that genuinely rewords or reframes the decision. Changing only the caption is not enough.

An incorrect route must lead to a factual refutation and wait for its narration to finish before the learner can use **Rewind & retry**. Rewind changes both the spoken/caption explanation and the rendered question. The player allows two wrong attempts: after the second, it reveals the correct answer and explanation and waits for **Continue with answer**. Author content so that this is helpful feedback, never a punishment.

Use `reviewsConcepts` to make retrieval deliberate. The middle review re-asks Act 1; the finale interleaves the episode's three concepts. Give each beat a 1–5 difficulty appropriate to its specific pilot rather than copying a global difficulty.

## Art and narration

Teaching and challenge plates must portray the pilot's actual subject in its established original theme. Use the stable demo-show asset paths and 1536×1024 JPEG format. Prompts must enforce the theme's exclusions and prohibit logos, visible writing, named franchises, artists, people, or imitation.

Every voiced line and rewind level in a bundled pilot must have a narration-catalog entry using that show's validated theme voice. The catalog is the source of truth for generated TypeScript and public JSON manifests; no-key playback resolves its bundled file before considering `/api/tts`.

## Author review checklist

- Can a learner answer with the supplied material and prior scenes?
- Are the recap, concepts, and finale unique to this pilot's subject?
- Does every beat include difficulty, `simplerQuestion`, and relevant `reviewsConcepts`?
- Does every wrong route have a supportive factual outcome and a valid retry route?
- Do all destinations resolve and does the ending remain reachable?
- Would the line remain constructive when read aloud to a struggling learner?
- Do captions, reduced motion, and age positioning remain respected?
