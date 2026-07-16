# EpisodeSpec v1

`EpisodeSpec` is the frozen contract between the authoring pipeline and the player. Version remains `1`: Round 6 adds additive teaching-phase fields while preserving old saved episodes at the base runtime schema. The bundled fixtures and every newly generated live episode must meet the fuller Round 6 contract. Runtime TypeScript and the matching Zod schemas require unique scene IDs and require every route to resolve.

## Core types

```ts
type SceneType = "recap" | "narrative" | "beat" | "branch_outcome" | "commercial" | "cliffhanger";
type TeachRole = "hook" | "define" | "analogy" | "example" | "contrast" | "recap";
type TeachStep = { role: TeachRole; text: string; onScreen?: string };
type McqOption = { id: string; text: string; isCorrect: boolean; misconceptionKey?: string };
type Beat = {
  kind: "mcq";
  assessmentKind?: "conceptual" | "compute";
  question: string;
  // Additive Round 5/6 fields. Old valid episodes may omit them.
  simplerQuestion?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  reviewsConcepts?: string[];
  options: McqOption[];
  onCorrect: string;
  onIncorrect: string;
};
type Scene = {
  id: string; type: SceneType; background: string; visualAsset?: string;
  speaker?: string; line?: string; deepDive?: string;
  simpler?: string; simplerAgain?: string; next?: string | null;
  // Round 6: ordered, learner-paced instruction rendered before this scene's check.
  teach?: TeachStep[];
  teachesConcepts?: string[];
  // Required before any calculation check; examples use a different value from the check.
  workedExample?: TeachStep[];
  recap?: { prompt: string; answers: string[]; conceptKey: string }[];
  beat?: Beat; refutation?: string;
};
type EpisodeSpec = {
  version: 1; episodeId: string; courseId: string; title: string; channel: 3;
  format: "toon"; difficulty: 1 | 2 | 3 | 4 | 5; theme?: ShowTheme;
  learningObjectives: { id: string; conceptKey: string; text: string }[];
  cast: { id: string; name: string; persona: string; voice?: string; spriteRef?: string }[];
  scenes: Scene[]; cliffhanger: { teaser: string; airsAfterHours: number };
};
```

The Structured Outputs transport schema uses the same shape, with optional runtime fields represented as required nullable properties. The server removes nulls before runtime validation. This keeps OpenAI Structured Outputs compatible without changing the v1 player contract.

## Round 6 demo-library contract

The no-key library ships five independent 21-scene, three-act episodes. These are content contracts, not merely theme skins.

| Show ID | Topic | Episode difficulty |
| --- | --- | --- |
| `photon-frontier` | circuits and Ohm's law | 3 |
| `cellular-casefile` | organelles | 3 |
| `power-up-plant-lab` | Newton's laws and forces | 2 |
| `tiny-lightkeepers` | water cycle | 1 |
| `chloroplast-quest` | light reactions and Calvin-cycle setup | 4 |

Each episode has a topic-specific recap, three taught concepts, an Act 2 retrieval beat that reviews Act 1 concept keys, and a cumulative Act 3 finale whose `reviewsConcepts` includes the concepts taught across the episode. Every graded beat receives a `teach` sequence of 3–5 short steps before its question. `teachesConcepts` identifies the learning-objective concepts the sequence establishes or reinforces. The sequence motivates the idea, defines it in plain language, makes it concrete with an analogy or example, and contrasts a likely confusion before the check. Every graded beat supplies a `simplerQuestion`, a beat-level difficulty, and review concept keys. Its incorrect route goes to a supportive `branch_outcome` with a factual `refutation`.

## Validation rules

- `version` is exactly `1`; `channel` is exactly `3`; P0 `format` is exactly `toon`.
- The Round 6 bundled fixtures each contain exactly 21 scenes arranged as recap/Act 1, retrieval/Act 2, and cumulative finale/Act 3, ending at one reachable cliffhanger.
- MCQs have 2–4 unique option IDs/text values and exactly one correct option. Known distractors carry a `misconceptionKey`.
- Every `next`, `onCorrect`, and `onIncorrect` value resolves to a scene. The main route must reach the finale and cliffhanger without a dead end; only intentionally bounded retry routes may revisit a beat.
- Every graded beat has a genuine `simplerQuestion`: it changes the task wording or context, not just its narration caption. Its corrective outcome gives an accurate, supportive refutation.
- Every Round 6 graded scene has a `teach` sequence of at least three non-empty one-idea steps and a non-empty `teachesConcepts` list containing only this episode's learning-objective keys. The teaching appears before that scene's question and is never reachable only through a wrong-answer branch.
- `onScreen`, when present, is short durable learner support such as a key term, contrast, or formula. It is rendered by the player as accessible UI, not embedded as artwork text.
- A calculation beat carries a `workedExample` of at least three steps before its question becomes answerable. The example states the transferable relationship, works a value, and includes a contrast or check; the following question uses a different value so its hint cannot be the answer.
- In Round 6 fixtures, `line`, `deepDive`, `simpler`, and `simplerAgain` are distinct authored takes. The latter three may clarify, simplify, or add mechanism, but must not be literal repetitions of the main line.
- `reviewsConcepts` names concept keys taught in this episode. The Act 2 review includes an Act 1 key; the Act 3 finale integrates the episode's concepts.
- The player permits at most two incorrect attempts for a beat. On the second miss it shows the correct choice and explanation, then waits for an explicit **Continue with answer** action.
- `visualAsset`, when supplied, is a project-local path to original, licensed, or ReRun-generated art. It is optional for live scenes because the renderer has deterministic fallback art.
- `theme` is normalized server-side from an original preset or adjective-only custom vibe. It selects a supported built-in TTS voice and original delivery instruction; raw user vibe text never becomes an image or voice prompt.
- Generated content is source-grounded and classroom-safe. Client copy calls schema failure “Technical Difficulties” and never exposes raw model output.

## Live-generation guardrails

Live generation follows the same learning contract as the bundled library. A live episode must author a three-act route with at least three primary graded beats, a 3–5-step teaching sequence before every question, a mid-episode retrieval that reviews its own Act 1 concepts, and a finale that retrieves across its own taught concepts. Calculation beats include a worked example before the learner applies the procedure to a new value. Every graded beat must include a real `simplerQuestion`, supportive corrective outcome/refutation, and valid destinations. Outcomes are manually acknowledged—never auto-advanced—and the player applies the two-miss answer-reveal cap. The server validates the generated structure, instruction order, and routes before a player receives it; schema failure uses the controlled fallback rather than partial content.

## Authoring example

```json
{
  "id": "beat-ohms-apply",
  "type": "beat",
  "background": "circuit repair bench",
  "line": "Current depends on both voltage and resistance.",
  "deepDive": "Ohm's law describes a proportional relationship when resistance stays constant.",
  "simpler": "Think of voltage as a push and resistance as a narrow doorway.",
  "simplerAgain": "More resistance means less current.",
  "teachesConcepts": ["circuits.ohms-law"],
  "teach": [
    { "role": "define", "text": "Ohm's law connects the push, the flow, and the obstacle.", "onScreen": "I = V ÷ R" },
    { "role": "example", "text": "With 12 volts and 6 ohms, divide 12 by 6: 2 amps flow.", "onScreen": "12 V ÷ 6 Ω = 2 A" },
    { "role": "contrast", "text": "Keep the voltage the same and double resistance: the current gets smaller, not bigger." }
  ],
  "workedExample": [
    { "role": "define", "text": "To find current, divide voltage by resistance.", "onScreen": "I = V ÷ R" },
    { "role": "example", "text": "With 12 volts and 6 ohms, divide 12 by 6: 2 amps flow.", "onScreen": "12 V ÷ 6 Ω = 2 A" },
    { "role": "contrast", "text": "With the same voltage, more resistance means less current." }
  ],
  "beat": {
    "kind": "mcq",
    "assessmentKind": "compute",
    "question": "A 24 V source and 6 Ω resistor produce what current?",
    "simplerQuestion": "Use current = voltage ÷ resistance: 24 ÷ 6 = ?",
    "difficulty": 3,
    "reviewsConcepts": ["circuits.ohms-law"],
    "options": [
      { "id": "four-amps", "text": "4 A", "isCorrect": true },
      { "id": "thirty-amps", "text": "30 A", "isCorrect": false, "misconceptionKey": "add-instead-of-divide" }
    ],
    "onCorrect": "act2-next",
    "onIncorrect": "outcome-ohms-apply"
  }
}
```

This check asks a new value—24 V through 6 Ω—rather than repeating the worked 12 V / 6 Ω example. The matching outcome gives the calculation correction and routes back to the same beat. The runtime tracks attempts; the authored graph does not need a separate infinite variant-beat loop.
