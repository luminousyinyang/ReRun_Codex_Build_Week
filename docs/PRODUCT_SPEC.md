# Product specification

## Product promise

ReRun makes the learner a necessary cast member in an educational TV show. The episode cannot progress until they retrieve, choose, or explain the relevant idea.

## Format thesis

AI study podcasts can turn notes into an audio-first review experience. ReRun addresses the complementary visual, interactive gap: it turns source material into a television episode where a learner sees ideas in context, receives a short learner-paced explanation before each check, participates in the plot, and receives a narrative consequence or simpler re-explanation.

ReRun is not a passive video generator and does not claim that visual study is superior for every learner. Its P0 promise is narrower and demonstrable: active retrieval, accurate corrective feedback, and adaptive re-explanation inside an original visual narrative.

## Audience

- **Primary:** students age 13+ and adult self-learners preparing for an assessment.
- **Secondary (post-MVP):** teachers assigning a course or reviewing class misconceptions.

ReRun is study support, not assessment certification, professional advice, or a substitute for instruction or accommodations.

## P0 journeys

### First use

1. Learner powers on a CRT in a dim room.
2. They load the bundled demo or paste short notes.
3. A “Please Stand By” production state remains visible while an optional live episode is generated.
4. CH 03 begins; a character presents a short hook/definition/example-or-analogy/contrast teaching sequence, with a durable key-term or formula lower-third where useful.
5. The show pauses at a question beat only after that sequence; the learner answers, sees accurate feedback, and reaches a cliffhanger/review time.

### Incorrect-answer recovery

1. Learner chooses a plausible misconception.
2. A short consequence scene illustrates why the logic fails without shaming the learner.
3. The show states the corrective contrast, offers rewind, and re-asks a meaningfully different question.
4. The learner can continue only after an active response.

## Learning-design rules

- Every P0 beat asks for retrieval only after a short teaching sequence; no check relies on a wrong-answer correction as its first explanation.
- Corrections identify the conceptual distinction and remain faithful to source material.
- Rewind changes reading level and analogy, not factual content.
- Spaced retrieval questions draw on previously introduced concepts when data is available.
- Ratings reflect recent demonstrated performance only; they are not grades, diagnoses, or learner labels.

## MVP acceptance criteria

- The first teaching sequence and interactive beat appear in demo mode without external calls.
- The episode has at least three question opportunities, one consequence branch, one variant re-ask, one spaced retrieval review, and one cliffhanger.
- Captions are available by default; sound is optional; controls work with keyboard and touch.
- A live-mode failure surfaces a readable “technical difficulties” explanation and a demo launch action.

## Explicit non-goals

P0 excludes accounts, teacher analytics, multiplayer, formal grading, high-stakes use, full adaptive scheduling, and generated video. It supports bounded PDF/document/slide/photo/audio/video extraction for source ingestion, not lossless document reconstruction.
