# Scene authoring guide

## Non-negotiable rules

- Write from supplied material or the approved bundled curriculum; do not invent contested facts or citations.
- Every incorrect answer gets a concise, accurate, supportive correction. Never mock, shame, punish, or call a learner careless.
- Use classroom-safe language for ages 13+; no real public figures, copyrighted characters, gore, unsafe scenarios, or visible text in generated art.
- Keep each teaching step short enough for captions on a television screen and limit it to one idea. The lesson is built from several paced steps, not one long exposition or an unsupported pop quiz.
- The host can be playful and Socratic but cannot reveal a call-in answer before the learner attempts it.

## Round 6 episode recipe

Author a complete 17-scene, three-act learning story—not a skin of another subject.

| Act | Learning purpose | Required evidence |
| --- | --- | --- |
| Recap / Act 1 | establish the topic and teach its first concepts | topic-specific recap, 3–5-step teaching sequence before each check, and graded beats |
| Act 2 | retrieve and extend Act 1 learning | a review beat whose `reviewsConcepts` includes an Act 1 concept key |
| Act 3 | integrate the episode's learning | cumulative finale whose `reviewsConcepts` covers the taught concepts, then a reachable cliffhanger |

Every pilot teaches three concepts. The bundled library covers circuits/Ohm's law, organelles, Newton's laws/forces, water cycle, and light reactions/Calvin-cycle setup. Do not reuse photosynthesis questions, recap copy, consequence scenes, or teaching sequences for the non-photosynthesis shows.

Live-generated episodes follow this exact learning shape as a minimum: three acts, at least three primary graded beats, a teaching sequence before every question, their own-concept mid-episode retrieval, and their own-concept cumulative finale. Treat these as authoring guardrails: a live episode that cannot establish all routes, teaching, supportive outcomes, simpler questions, and a reachable ending is rejected before the player opens it.

## Scene recipes

| Scene | Purpose | Required ingredients |
| --- | --- | --- |
| Recap | warm up retrieval | one topic-specific prior fact, accepted answers, concept key |
| Narrative | establish a meaningful problem | visual metaphor, one factual claim, and distinct deep-dive and rewind takes |
| Beat | teach, then require active retrieval | 3–5 `teach` steps; `teachesConcepts` objective keys; one objective or deliberate review; 2–4 unique plausible options; one correct answer; difficulty, `simplerQuestion`, review keys, and valid destinations |
| Branch outcome | correct a misconception kindly | visible consequence, exact refutation, route back to the beat |
| Commercial | make spaced review feel in-universe | a previously taught concept and answer-required continuation |
| Cliffhanger | create return motivation | next-concept teaser and computed review time |

## Question, retry, and rewind design

Distractors should map to realistic misconceptions, not joke choices. Each beat needs a `simplerQuestion` that genuinely rewords or reframes the decision. Changing only the caption is not enough.

### Teaching before the check

Every graded beat must open with at least three learner-paced `teach` steps before choices appear. Use a compact progression appropriate to the idea:

1. Motivate or hook the concept in the show situation.
2. Define it plainly and name the key term.
3. Make it concrete through an analogy, visible example, or worked procedure.
4. Where useful, contrast the likely misconception with the correct model.
5. Recap the model in language that sets up the question.

Author `teachesConcepts` with only this episode's learning-objective keys. It makes instructional coverage inspectable; do not use a wrong-answer branch as the first place a learner encounters an explanation. Put concise durable support such as `VOLTAGE = PUSH ON CHARGE` or `I = V ÷ R` in `onScreen`. It is displayed as an accessible lower-third, so do not ask art generation to paint readable words into the scene.

For `assessmentKind: "compute"`, author a `workedExample` with at least three steps before the question: state the relationship, work a value, and contrast/check the reasoning. Ask the learner to apply the relationship to a **new** value. A `simplerQuestion` may cue the method, but it must not simply reveal the arithmetic answer.

`line`, `deepDive`, `simpler`, and `simplerAgain` are four authored takes, not a copy fan-out. The main line summarizes the lesson, deep dive adds mechanism or an edge case, and the rewind takes use a warmer analogy then a bare one-idea version. The player presents the teaching steps in order; Pause adds the deep dive and Rewind supplies distinct simpler language.

An incorrect route must lead to a factual refutation and wait for its narration to finish before the learner can use **Rewind & retry**. Rewind changes both the spoken/caption explanation and the rendered question. The player allows two wrong attempts: after the second, it reveals the correct answer and explanation and waits for **Continue with answer**. Author content so that this is helpful feedback, never a punishment.

Use `reviewsConcepts` to make retrieval deliberate. The middle review re-asks Act 1; the finale interleaves the episode's three concepts. Give each beat a 1–5 difficulty appropriate to its specific pilot rather than copying a global difficulty.

## Art and narration

Teaching and challenge plates must portray the pilot's actual subject in its established original theme. Use the stable demo-show asset paths and 1536×1024 JPEG format. Prompts must enforce the theme's exclusions and prohibit logos, visible writing, named franchises, artists, people, or imitation. The existing subject-matched teaching/challenge plates can support the new micro-lessons; key terms and formulas belong in the player lower-third, not regenerated image text.

Every voiced line and rewind level in a bundled pilot must have a narration-catalog entry using that show's validated theme voice. The catalog is the source of truth for generated TypeScript and public JSON manifests; no-key playback resolves its bundled file before considering `/api/tts`.

## Author review checklist

- Does every beat teach the model in at least three paced steps before its choices appear?
- Can a learner answer with the supplied material and prior teaching steps, without seeing a wrong-answer correction first?
- Does `teachesConcepts` map only to this episode's learning objectives?
- For a compute beat, does a worked example use a different value than the following check?
- Are the recap, concepts, and finale unique to this pilot's subject?
- Does every beat include difficulty, `simplerQuestion`, and relevant `reviewsConcepts`?
- Does every wrong route have a supportive factual outcome and a valid retry route?
- Do all destinations resolve and does the ending remain reachable?
- Would the line remain constructive when read aloud to a struggling learner?
- Do captions, reduced motion, and age positioning remain respected?
