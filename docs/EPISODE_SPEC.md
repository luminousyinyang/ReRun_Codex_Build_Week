# EpisodeSpec v1

`EpisodeSpec` is the frozen contract between the authoring pipeline and the player. Version remains `1`: Round 5 adds only optional, backward-compatible beat metadata. Runtime TypeScript and the matching Zod schemas reject unknown fields, require unique scene IDs, and require every route to resolve.

## Core types

```ts
type SceneType = "recap" | "narrative" | "beat" | "branch_outcome" | "commercial" | "cliffhanger";
type McqOption = { id: string; text: string; isCorrect: boolean; misconceptionKey?: string };
type Beat = {
  kind: "mcq";
  question: string;
  // Additive Round 5 fields. Old valid episodes may omit them.
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

## Round 5 demo-library contract

The no-key library ships five independent 21-scene, three-act episodes. These are content contracts, not merely theme skins.

| Show ID | Topic | Episode difficulty |
| --- | --- | --- |
| `photon-frontier` | circuits and Ohm's law | 3 |
| `cellular-casefile` | organelles | 3 |
| `power-up-plant-lab` | Newton's laws and forces | 2 |
| `tiny-lightkeepers` | water cycle | 1 |
| `chloroplast-quest` | light reactions and Calvin-cycle setup | 4 |

Each episode has a topic-specific recap, three taught concepts, an Act 2 retrieval beat that reviews Act 1 concept keys, and a cumulative Act 3 finale whose `reviewsConcepts` includes the concepts taught across the episode. Every graded beat supplies a `simplerQuestion`, a beat-level difficulty, and review concept keys. Its incorrect route goes to a supportive `branch_outcome` with a factual `refutation`.

## Validation rules

- `version` is exactly `1`; `channel` is exactly `3`; P0 `format` is exactly `toon`.
- The Round 5 bundled fixtures each contain exactly 21 scenes arranged as recap/Act 1, retrieval/Act 2, and cumulative finale/Act 3, ending at one reachable cliffhanger.
- MCQs have 2–4 unique option IDs/text values and exactly one correct option. Known distractors carry a `misconceptionKey`.
- Every `next`, `onCorrect`, and `onIncorrect` value resolves to a scene. The main route must reach the finale and cliffhanger without a dead end; only intentionally bounded retry routes may revisit a beat.
- Every graded beat has a genuine `simplerQuestion`: it changes the task wording or context, not just its narration caption. Its corrective outcome gives an accurate, supportive refutation.
- `reviewsConcepts` names concept keys taught in this episode. The Act 2 review includes an Act 1 key; the Act 3 finale integrates the episode's concepts.
- The player permits at most two incorrect attempts for a beat. On the second miss it shows the correct choice and explanation, then waits for an explicit **Continue with answer** action.
- `visualAsset`, when supplied, is a project-local path to original, licensed, or ReRun-generated art. It is optional for live scenes because the renderer has deterministic fallback art.
- `theme` is normalized server-side from an original preset or adjective-only custom vibe. It selects a supported built-in TTS voice and original delivery instruction; raw user vibe text never becomes an image or voice prompt.
- Generated content is source-grounded and classroom-safe. Client copy calls schema failure “Technical Difficulties” and never exposes raw model output.

## Live-generation guardrails

Live generation follows the same learning contract as the bundled library. A live episode must author a three-act route with at least three primary graded beats, a mid-episode retrieval that reviews its own Act 1 concepts, and a finale that retrieves across its own taught concepts. Every graded beat must include a real `simplerQuestion`, supportive corrective outcome/refutation, and valid destinations. Outcomes are manually acknowledged—never auto-advanced—and the player applies the two-miss answer-reveal cap. The server validates the generated structure and routes before a player receives it; schema failure uses the controlled fallback rather than partial content.

## Authoring example

```json
{
  "id": "act2-retrieval",
  "type": "beat",
  "background": "circuit repair bench",
  "line": "Signal check: use the relationship we learned in Act 1.",
  "beat": {
    "kind": "mcq",
    "question": "A 12 V source pushes 3 A through a resistor. What is the resistance?",
    "simplerQuestion": "Use V = I × R. If 12 volts and 3 amps are known, how many ohms is R?",
    "difficulty": 3,
    "reviewsConcepts": ["circuits.voltage-current", "circuits.ohms-law"],
    "options": [
      { "id": "four-ohms", "text": "4 Ω", "isCorrect": true },
      { "id": "thirty-six-ohms", "text": "36 Ω", "isCorrect": false, "misconceptionKey": "multiply-instead-of-divide" }
    ],
    "onCorrect": "act2-next",
    "onIncorrect": "act2-retrieval-outcome"
  }
}
```

The matching outcome gives the calculation correction and routes back to the same beat. The runtime tracks attempts; the authored graph does not need a separate infinite variant-beat loop.
