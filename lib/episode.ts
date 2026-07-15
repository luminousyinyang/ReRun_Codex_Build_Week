import { z } from "zod";

export const sceneTypes = ["recap", "narrative", "beat", "branch_outcome", "commercial", "cliffhanger"] as const;

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  isCorrect: z.boolean(),
  misconceptionKey: z.string().min(1).optional(),
});

const beatSchema = z.object({
  kind: z.literal("mcq"),
  question: z.string().min(1),
  options: z.array(optionSchema).min(2).max(4),
  onCorrect: z.string().min(1),
  onIncorrect: z.string().min(1),
});

const sceneSchema = z.object({
  id: z.string().min(1),
  type: z.enum(sceneTypes),
  background: z.string().min(1),
  visualAsset: z.string().min(1).optional(),
  speaker: z.string().min(1).optional(),
  line: z.string().min(1).optional(),
  deepDive: z.string().min(1).optional(),
  simpler: z.string().min(1).optional(),
  simplerAgain: z.string().min(1).optional(),
  next: z.string().min(1).nullable().optional(),
  recap: z.array(z.object({ prompt: z.string(), answers: z.array(z.string()).min(1), conceptKey: z.string() })).optional(),
  beat: beatSchema.optional(),
  refutation: z.string().min(1).optional(),
});

export const episodeBaseSchema = z.object({
  version: z.literal(1),
  episodeId: z.string().min(1),
  courseId: z.string().min(1),
  title: z.string().min(1),
  channel: z.literal(3),
  format: z.literal("toon"),
  difficulty: z.number().int().min(1).max(5),
  learningObjectives: z.array(z.object({ id: z.string(), conceptKey: z.string(), text: z.string() })).min(1),
  cast: z.array(z.object({ id: z.string(), name: z.string(), persona: z.string(), voice: z.string().optional(), spriteRef: z.string().optional() })).min(1),
  scenes: z.array(sceneSchema).min(1),
  cliffhanger: z.object({ teaser: z.string(), airsAfterHours: z.number().positive() }),
});

export const episodeSchema = episodeBaseSchema.superRefine((episode, context) => {
  const ids = new Set<string>();
  for (const scene of episode.scenes) {
    if (ids.has(scene.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate scene id: ${scene.id}` });
    ids.add(scene.id);
    if (scene.beat && scene.beat.options.filter((option) => option.isCorrect).length !== 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Beat ${scene.id} must have exactly one correct option` });
    }
  }
  for (const scene of episode.scenes) {
    for (const destination of [scene.next, scene.beat?.onCorrect, scene.beat?.onIncorrect]) {
      if (destination && !ids.has(destination)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown scene destination: ${destination}` });
    }
  }
});

export type EpisodeSpec = z.infer<typeof episodeSchema>;
export type Scene = EpisodeSpec["scenes"][number];

export const demoEpisode: EpisodeSpec = episodeSchema.parse({
  version: 1,
  episodeId: "bio101-light-reactions-001",
  courseId: "bio101-photosynthesis",
  title: "The Light Reactions Heist",
  channel: 3,
  format: "toon",
  difficulty: 3,
  learningObjectives: [
    { id: "lo-atp", conceptKey: "cell.atp", text: "Distinguish ATP from DNA and glucose." },
    { id: "lo-nadph", conceptKey: "photo.light-products", text: "Identify the electron carrier produced in light reactions." },
  ],
  cast: [{ id: "prof-paws", name: "Professor Paws", persona: "warm, dramatic science host" }],
  scenes: [
    { id: "recap", type: "recap", background: "broadcast-blue test card", recap: [{ prompt: "The powerhouse of the cell is the ____.", answers: ["mitochondria"], conceptKey: "cell.organelles" }], next: "s1" },
    { id: "s1", type: "narrative", background: "cartoon chloroplast exterior, neon-green heist lighting", visualAsset: "/assets/scenes/sunlight-vault.png", speaker: "Professor Paws", line: "Tonight, we crack the cell's sunlight vault. The first job happens in the light reactions.", deepDive: "Chloroplast thylakoid membranes hold the light-catching machinery.", next: "s2" },
    { id: "s2", type: "beat", background: "vault door marked energy currency", speaker: "Professor Paws", line: "Freeze. Which molecule is ready-to-spend cellular energy?", deepDive: "Cells use a small rechargeable energy carrier for immediate work.", beat: { kind: "mcq", question: "Which molecule carries usable energy for cell work?", options: [{ id: "atp", text: "ATP", isCorrect: true }, { id: "dna", text: "DNA", isCorrect: false, misconceptionKey: "information-vs-energy" }, { id: "glucose", text: "Glucose", isCorrect: false, misconceptionKey: "stored-fuel-vs-carrier" }], onCorrect: "s3", onIncorrect: "s2-outcome" } },
    { id: "s2-outcome", type: "branch_outcome", background: "vault alarm and safe paper blueprints", speaker: "Professor Paws", line: "Wrong wire. The blueprints are not the battery.", refutation: "DNA stores genetic information, glucose stores fuel, and ATP is the cell's immediately usable energy carrier.", next: "s2-variant" },
    { id: "s2-variant", type: "beat", background: "rewired vault, one amber cable", speaker: "Professor Paws", line: "Rewind: what does a cell spend directly?", beat: { kind: "mcq", question: "The cell's ready-to-spend energy currency is...", options: [{ id: "atp", text: "ATP", isCorrect: true }, { id: "dna", text: "DNA", isCorrect: false, misconceptionKey: "information-vs-energy" }], onCorrect: "s3", onIncorrect: "s2-variant" } },
    { id: "s3", type: "narrative", background: "glowing ATP vault opens", speaker: "Professor Paws", line: "ATP is in the getaway bag. Light reactions also make an electron carrier.", deepDive: "Light energizes electrons, and the cell stores that energy in ATP and NADPH.", simpler: "Light helps the cell fill two energy containers: ATP and NADPH.", simplerAgain: "Two energy helpers leave the light reactions: ATP and NADPH.", next: "s4" },
    { id: "s4", type: "beat", background: "two glowing getaway canisters", speaker: "Professor Paws", line: "What is the other energy carrier?", beat: { kind: "mcq", question: "Besides ATP, light reactions produce which electron carrier?", options: [{ id: "nadph", text: "NADPH", isCorrect: true }, { id: "oxygen", text: "Oxygen", isCorrect: false, misconceptionKey: "byproduct-vs-carrier" }, { id: "co2", text: "Carbon dioxide", isCorrect: false, misconceptionKey: "reactant-vs-product" }], onCorrect: "commercial", onIncorrect: "s4-outcome" } },
    { id: "s4-outcome", type: "branch_outcome", background: "oxygen bubbles drift from a broken canister", speaker: "Professor Paws", line: "Oxygen exits as a by-product; it is not the carrier we bank.", refutation: "Splitting water releases oxygen. NADPH carries energized electrons onward, while carbon dioxide is used later in the Calvin cycle.", next: "s4-variant" },
    { id: "s4-variant", type: "beat", background: "canister label highlighted", speaker: "Professor Paws", line: "One more take: which carrier transports energized electrons?", beat: { kind: "mcq", question: "The light reactions produce ATP and...", options: [{ id: "nadph", text: "NADPH", isCorrect: true }, { id: "oxygen", text: "Oxygen", isCorrect: false, misconceptionKey: "byproduct-vs-carrier" }], onCorrect: "commercial", onIncorrect: "s4-variant" } },
    { id: "commercial", type: "commercial", background: "retro power-company ad", visualAsset: "/assets/scenes/review-break.png", speaker: "Professor Paws", line: "Commercial break. Answer a review question to skip.", beat: { kind: "mcq", question: "Which organelle makes most ATP in cellular respiration?", options: [{ id: "mitochondria", text: "Mitochondria", isCorrect: true }, { id: "nucleus", text: "Nucleus", isCorrect: false, misconceptionKey: "organelle-function" }], onCorrect: "cliffhanger", onIncorrect: "commercial" } },
    { id: "cliffhanger", type: "cliffhanger", background: "storm over the Calvin Cycle district", visualAsset: "/assets/scenes/calvin-storm.png", speaker: "Professor Paws", line: "We got ATP and NADPH, but the Calvin Cycle is waiting.", next: null },
  ],
  cliffhanger: { teaser: "Next: the Calvin Cycle Caper.", airsAfterHours: 24 },
});
