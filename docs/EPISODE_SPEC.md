# EpisodeSpec v1

This is the frozen contract between the content pipeline and the player. Implement it as TypeScript types plus matching Zod schemas. Unknown fields are rejected; scene IDs must be unique; all references must resolve; P0 accepts MCQ beats only.

## Core types

```ts
type SceneType = "recap" | "narrative" | "beat" | "branch_outcome" | "commercial" | "cliffhanger";
type McqOption = { id: string; text: string; isCorrect: boolean; misconceptionKey?: string };
type Beat = { kind: "mcq"; question: string; options: McqOption[]; onCorrect: string; onIncorrect: string };
type Scene = {
  id: string; type: SceneType; background: string; visualAsset?: string; speaker?: string; line?: string;
  deepDive?: string; simpler?: string; simplerAgain?: string; next?: string;
  recap?: { prompt: string; answers: string[]; conceptKey: string }[];
  beat?: Beat; refutation?: string;
};
type EpisodeSpec = {
  version: 1; episodeId: string; courseId: string; title: string; channel: 3;
  format: "toon"; difficulty: 1 | 2 | 3 | 4 | 5;
  learningObjectives: { id: string; conceptKey: string; text: string }[];
  cast: { id: string; name: string; persona: string; voice?: string; spriteRef?: string }[];
  scenes: Scene[]; cliffhanger: { teaser: string; airsAfterHours: number };
};
type ConceptGraph = {
  courseTitle: string;
  objectives: { id: string; conceptKey: string; text: string }[];
  concepts: { key: string; facts: string[]; prerequisites: string[]; misconceptions: string[] }[];
};
```

## Validation rules

- `version` is exactly `1`; `channel` is exactly `3`; P0 `format` is exactly `toon`.
- An episode has one recap, at least one narrative scene, at least three beats, one branch outcome, one commercial, and one cliffhanger.
- MCQs have 2-4 unique options and exactly one correct option. Each non-correct option has a misconception key where one is known.
- `onCorrect`, `onIncorrect`, and `next` point to existing scene IDs. The main path must reach the commercial and cliffhanger without cycles; a re-ask may loop only to its own variant beat.
- `visualAsset`, when supplied, is a project-local public path to original/licensed/generated scene art. It is optional so a deterministic renderer can select a relevant local fallback for live scenes.
- Branch outcomes include a factual `refutation` and lead to a variant question; no insult, ridicule, or punishment language is permitted.
- The generator must return only source-grounded educational content. Client copy should call a schema failure “Technical Difficulties,” not expose raw model output.

## Complete bundled fixture: Photosynthesis - The Light Reactions Heist

```json
{
  "version": 1,
  "episodeId": "bio101-light-reactions-001",
  "courseId": "bio101-photosynthesis",
  "title": "The Light Reactions Heist",
  "channel": 3,
  "format": "toon",
  "difficulty": 3,
  "learningObjectives": [
    { "id": "lo-light-products", "conceptKey": "photo.light-products", "text": "Identify the products of the light reactions." },
    { "id": "lo-atp", "conceptKey": "cell.atp", "text": "Distinguish ATP from DNA and glucose." }
  ],
  "cast": [
    { "id": "prof-paws", "name": "Professor Paws", "persona": "warm dramatic science host", "voice": "optional", "spriteRef": "demo/prof-paws" }
  ],
  "scenes": [
    { "id": "recap", "type": "recap", "background": "broadcast-blue test card", "recap": [{ "prompt": "The powerhouse of the cell is the ____.", "answers": ["mitochondria"], "conceptKey": "cell.organelles" }], "next": "s1" },
    { "id": "s1", "type": "narrative", "background": "cartoon chloroplast exterior, neon-green heist lighting", "speaker": "Professor Paws", "line": "Tonight, we crack the cell's sunlight vault. The first job happens in the light reactions.", "deepDive": "Chloroplast thylakoid membranes hold the light-catching machinery.", "next": "s2" },
    { "id": "s2", "type": "beat", "background": "vault door marked energy currency", "speaker": "Professor Paws", "line": "Which molecule is ready-to-spend cellular energy?", "beat": { "kind": "mcq", "question": "Which molecule carries usable energy for cell work?", "options": [{ "id": "atp", "text": "ATP", "isCorrect": true }, { "id": "dna", "text": "DNA", "isCorrect": false, "misconceptionKey": "information-vs-energy" }, { "id": "glucose", "text": "Glucose", "isCorrect": false, "misconceptionKey": "stored-fuel-vs-carrier" }], "onCorrect": "s3", "onIncorrect": "s2-outcome" } },
    { "id": "s2-outcome", "type": "branch_outcome", "background": "vault alarm and safe paper blueprints", "speaker": "Professor Paws", "line": "Wrong wire. The blueprints are not the battery.", "refutation": "DNA stores genetic information, glucose stores fuel, and ATP is the cell's immediately usable energy carrier.", "next": "s2-variant" },
    { "id": "s2-variant", "type": "beat", "background": "rewired vault, one amber cable", "speaker": "Professor Paws", "line": "Rewind: what does a cell spend directly?", "beat": { "kind": "mcq", "question": "The cell's ready-to-spend energy currency is...", "options": [{ "id": "atp", "text": "ATP", "isCorrect": true }, { "id": "dna", "text": "DNA", "isCorrect": false, "misconceptionKey": "information-vs-energy" }], "onCorrect": "s3", "onIncorrect": "s2-variant" } },
    { "id": "s3", "type": "narrative", "background": "glowing ATP vault opens", "speaker": "Professor Paws", "line": "ATP is in the getaway bag. Light reactions also make an electron carrier.", "simpler": "Light helps the cell fill two energy containers: ATP and NADPH.", "simplerAgain": "Two energy helpers leave the light reactions: ATP and NADPH.", "next": "s4" },
    { "id": "s4", "type": "beat", "background": "two glowing getaway canisters", "speaker": "Professor Paws", "line": "What is the other energy carrier?", "beat": { "kind": "mcq", "question": "Besides ATP, light reactions produce which electron carrier?", "options": [{ "id": "nadph", "text": "NADPH", "isCorrect": true }, { "id": "oxygen", "text": "Oxygen", "isCorrect": false, "misconceptionKey": "byproduct-vs-carrier" }, { "id": "co2", "text": "Carbon dioxide", "isCorrect": false, "misconceptionKey": "reactant-vs-product" }], "onCorrect": "commercial", "onIncorrect": "s4-outcome" } },
    { "id": "s4-outcome", "type": "branch_outcome", "background": "oxygen bubbles drift from a broken canister", "speaker": "Professor Paws", "line": "Oxygen exits as a by-product; it is not the carrier we bank.", "refutation": "Splitting water releases oxygen. NADPH carries energized electrons onward, while carbon dioxide is used later in the Calvin cycle.", "next": "s4-variant" },
    { "id": "s4-variant", "type": "beat", "background": "canister label highlighted", "speaker": "Professor Paws", "line": "One more take: which carrier transports energized electrons?", "beat": { "kind": "mcq", "question": "The light reactions produce ATP and...", "options": [{ "id": "nadph", "text": "NADPH", "isCorrect": true }, { "id": "oxygen", "text": "Oxygen", "isCorrect": false, "misconceptionKey": "byproduct-vs-carrier" }], "onCorrect": "commercial", "onIncorrect": "s4-variant" } },
    { "id": "commercial", "type": "commercial", "background": "retro power-company ad", "speaker": "Professor Paws", "line": "Commercial break. Answer a review question to skip.", "beat": { "kind": "mcq", "question": "Which organelle makes most ATP in cellular respiration?", "options": [{ "id": "mitochondria", "text": "Mitochondria", "isCorrect": true }, { "id": "nucleus", "text": "Nucleus", "isCorrect": false, "misconceptionKey": "organelle-function" }], "onCorrect": "cliffhanger", "onIncorrect": "commercial" } },
    { "id": "cliffhanger", "type": "cliffhanger", "background": "storm over the Calvin Cycle district", "speaker": "Professor Paws", "line": "We got ATP and NADPH, but the Calvin Cycle is waiting.", "next": null }
  ],
  "cliffhanger": { "teaser": "Next: the Calvin Cycle Caper.", "airsAfterHours": 24 }
}
```
