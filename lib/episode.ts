import { z } from "zod";
import { defaultTheme, getPresetTheme, showThemeSchema, type ShowTheme } from "@/lib/theme";

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

export const sceneSchema = z.object({
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
  theme: showThemeSchema.optional(),
  learningObjectives: z.array(z.object({ id: z.string(), conceptKey: z.string(), text: z.string() })).min(1),
  cast: z.array(z.object({ id: z.string(), name: z.string(), persona: z.string(), voice: z.string().optional(), spriteRef: z.string().optional() })).min(1),
  scenes: z.array(sceneSchema).min(1),
  cliffhanger: z.object({ teaser: z.string(), airsAfterHours: z.number().positive() }),
});

/**
 * Transport schema for OpenAI Structured Outputs. That API requires every
 * object key to be required, so fields that are optional in the runtime
 * episode contract are represented as required nullable fields here. The
 * nulls are normalized away before `episodeSchema` validates the result.
 */
const structuredOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  isCorrect: z.boolean(),
  misconceptionKey: z.string().min(1).nullable(),
});

const structuredBeatSchema = z.object({
  kind: z.literal("mcq"),
  question: z.string().min(1),
  options: z.array(structuredOptionSchema).min(2).max(4),
  onCorrect: z.string().min(1),
  onIncorrect: z.string().min(1),
});

const structuredSceneSchema = z.object({
  id: z.string().min(1),
  type: z.enum(sceneTypes),
  background: z.string().min(1),
  visualAsset: z.string().min(1).nullable(),
  speaker: z.string().min(1).nullable(),
  line: z.string().min(1).nullable(),
  deepDive: z.string().min(1).nullable(),
  simpler: z.string().min(1).nullable(),
  simplerAgain: z.string().min(1).nullable(),
  next: z.string().min(1).nullable(),
  recap: z.array(z.object({ prompt: z.string(), answers: z.array(z.string()).min(1), conceptKey: z.string() })).nullable(),
  beat: structuredBeatSchema.nullable(),
  refutation: z.string().min(1).nullable(),
});

export const episodeResponseSchema = z.object({
  version: z.literal(1),
  episodeId: z.string().min(1),
  courseId: z.string().min(1),
  title: z.string().min(1),
  channel: z.literal(3),
  format: z.literal("toon"),
  difficulty: z.number().int().min(1).max(5),
  theme: z.null(),
  learningObjectives: z.array(z.object({ id: z.string(), conceptKey: z.string(), text: z.string() })).min(1),
  cast: z.array(z.object({ id: z.string(), name: z.string(), persona: z.string(), voice: z.string().nullable(), spriteRef: z.string().nullable() })).min(1),
  scenes: z.array(structuredSceneSchema).min(1),
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

function omitNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => entry === null ? [] : [[key, omitNulls(entry)]]));
}

const recapStopWords = new Set([
  "about", "after", "before", "class", "concept", "course", "from", "into", "lesson", "material", "notes", "study", "that", "the", "their", "there", "these", "they", "this", "topic", "using", "with", "your",
]);

function meaningfulWords(value: string) {
  return Array.from(value.toLocaleLowerCase().matchAll(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu), (match) => match[0])
    .filter((word) => word.length >= 3 && !recapStopWords.has(word));
}

/**
 * Adds the live-only guarantees the player needs before it opens its recap
 * screen. A generated answer has to point back to the supplied material,
 * rather than accepting a placeholder such as "study".
 */
export function validateLiveEpisode(value: unknown, sourceNotes: string): EpisodeSpec {
  const episode = episodeSchema.parse(omitNulls(value));
  const recapScene = episode.scenes.find((scene) => scene.id === "recap" && scene.type === "recap");
  const recap = recapScene?.recap?.[0];
  if (!recapScene || !recap || !recapScene.next) {
    throw new Error("Generated episode is missing its source-based recap.");
  }

  const sourceWords = new Set(meaningfulWords(sourceNotes));
  const answerWords = recap.answers.flatMap(meaningfulWords);
  if (!answerWords.some((word) => sourceWords.has(word))) {
    throw new Error("Generated recap answer is not grounded in the supplied notes.");
  }
  return episode;
}

export const demoEpisode: EpisodeSpec = episodeSchema.parse({
  version: 1,
  episodeId: "bio101-light-reactions-001",
  courseId: "bio101-photosynthesis",
  title: "The Light Reactions Heist",
  channel: 3,
  format: "toon",
  difficulty: 3,
  theme: defaultTheme,
  learningObjectives: [
    { id: "lo-atp", conceptKey: "cell.atp", text: "Distinguish ATP from DNA and glucose." },
    { id: "lo-nadph", conceptKey: "photo.light-products", text: "Identify the electron carrier produced in light reactions." },
  ],
  cast: [{ id: "prof-paws", name: "Professor Paws", persona: "warm, dramatic science host" }],
  scenes: [
    { id: "recap", type: "recap", background: "broadcast-blue test card", recap: [{ prompt: "The powerhouse of the cell is the ____.", answers: ["mitochondria"], conceptKey: "cell.organelles" }], next: "s1" },
    { id: "s1", type: "narrative", background: "cartoon chloroplast exterior, neon-green heist lighting", visualAsset: "/assets/scenes-v3/sunlight-vault-v3.jpg", speaker: "Professor Paws", line: "Tonight, we crack the cell's sunlight vault. The first job happens in the light reactions.", deepDive: "Chloroplast thylakoid membranes hold the light-catching machinery.", simpler: "Plants catch sunlight in a special part of the cell.", simplerAgain: "The light reactions are where the cell first catches light.", next: "s2" },
    { id: "s2", type: "beat", background: "vault door marked energy currency", speaker: "Professor Paws", line: "Freeze. Which molecule is ready-to-spend cellular energy?", deepDive: "Cells use a small rechargeable energy carrier for immediate work.", simpler: "Which tiny cell helper is ready to use for energy right now?", simplerAgain: "Pick the cell's spend-now energy helper.", beat: { kind: "mcq", question: "Which molecule carries usable energy for cell work?", options: [{ id: "atp", text: "ATP", isCorrect: true }, { id: "dna", text: "DNA", isCorrect: false, misconceptionKey: "information-vs-energy" }, { id: "glucose", text: "Glucose", isCorrect: false, misconceptionKey: "stored-fuel-vs-carrier" }], onCorrect: "s3", onIncorrect: "s2-outcome" } },
    { id: "s2-outcome", type: "branch_outcome", background: "vault alarm and safe paper blueprints", speaker: "Professor Paws", line: "Wrong wire. The blueprints are not the battery.", simpler: "DNA is an instruction book, not a battery.", simplerAgain: "ATP is the battery-like helper, not DNA.", refutation: "DNA stores genetic information, glucose stores fuel, and ATP is the cell's immediately usable energy carrier.", next: "s2-variant" },
    { id: "s2-variant", type: "beat", background: "rewired vault, one amber cable", speaker: "Professor Paws", line: "Rewind: what does a cell spend directly?", simpler: "What energy helper can a cell use right away?", simplerAgain: "Which answer means ready-to-use cell energy?", beat: { kind: "mcq", question: "The cell's ready-to-spend energy currency is...", options: [{ id: "atp", text: "ATP", isCorrect: true }, { id: "dna", text: "DNA", isCorrect: false, misconceptionKey: "information-vs-energy" }], onCorrect: "s3", onIncorrect: "s2-variant" } },
    { id: "s3", type: "narrative", background: "glowing ATP vault opens", speaker: "Professor Paws", line: "ATP is in the getaway bag. Light reactions also make an electron carrier.", deepDive: "Light energizes electrons, and the cell stores that energy in ATP and NADPH.", simpler: "Light helps the cell fill two energy containers: ATP and NADPH.", simplerAgain: "Two energy helpers leave the light reactions: ATP and NADPH.", next: "s4" },
    { id: "s4", type: "beat", background: "two glowing getaway canisters", speaker: "Professor Paws", line: "What is the other energy carrier?", simpler: "What is the second energy helper made with ATP?", simplerAgain: "Besides ATP, which helper carries energized electrons?", beat: { kind: "mcq", question: "Besides ATP, light reactions produce which electron carrier?", options: [{ id: "nadph", text: "NADPH", isCorrect: true }, { id: "oxygen", text: "Oxygen", isCorrect: false, misconceptionKey: "byproduct-vs-carrier" }, { id: "co2", text: "Carbon dioxide", isCorrect: false, misconceptionKey: "reactant-vs-product" }], onCorrect: "commercial", onIncorrect: "s4-outcome" } },
    { id: "s4-outcome", type: "branch_outcome", background: "oxygen bubbles drift from a broken canister", speaker: "Professor Paws", line: "Oxygen exits as a by-product; it is not the carrier we bank.", simpler: "Oxygen comes out, but it does not carry the energy onward.", simplerAgain: "NADPH carries energized electrons; oxygen does not.", refutation: "Splitting water releases oxygen. NADPH carries energized electrons onward, while carbon dioxide is used later in the Calvin cycle.", next: "s4-variant" },
    { id: "s4-variant", type: "beat", background: "canister label highlighted", speaker: "Professor Paws", line: "One more take: which carrier transports energized electrons?", simpler: "Which helper carries energized electrons after light is captured?", simplerAgain: "ATP and which electron carrier leave the light reactions?", beat: { kind: "mcq", question: "The light reactions produce ATP and...", options: [{ id: "nadph", text: "NADPH", isCorrect: true }, { id: "oxygen", text: "Oxygen", isCorrect: false, misconceptionKey: "byproduct-vs-carrier" }], onCorrect: "commercial", onIncorrect: "s4-variant" } },
    { id: "commercial", type: "commercial", background: "retro power-company ad", visualAsset: "/assets/scenes-v3/review-break-v3.jpg", speaker: "Professor Paws", line: "Commercial break. Answer a review question to skip.", simpler: "Quick review: which cell part makes most ATP during respiration?", simplerAgain: "Pick the cell's main ATP-making organelle.", beat: { kind: "mcq", question: "Which organelle makes most ATP in cellular respiration?", options: [{ id: "mitochondria", text: "Mitochondria", isCorrect: true }, { id: "nucleus", text: "Nucleus", isCorrect: false, misconceptionKey: "organelle-function" }], onCorrect: "cliffhanger", onIncorrect: "commercial" } },
    { id: "cliffhanger", type: "cliffhanger", background: "storm over the Calvin Cycle district", visualAsset: "/assets/scenes-v3/calvin-storm-v5.jpg", speaker: "Professor Paws", line: "We got ATP and NADPH, but the Calvin Cycle is waiting.", simpler: "ATP and NADPH are ready; the next step uses them.", simplerAgain: "Next, the Calvin Cycle uses the energy helpers.", next: null },
  ],
  cliffhanger: { teaser: "Next: the Calvin Cycle Caper.", airsAfterHours: 24 },
});

export type DemoShow = {
  id: string;
  title: string;
  teaser: string;
  theme: ShowTheme;
  episode: EpisodeSpec;
  art: { teaching: string; challenge: string };
};

function demoShow(id: string, title: string, teaser: string, themeId: string): DemoShow {
  const theme = getPresetTheme(themeId);
  return {
    id,
    title,
    teaser,
    theme,
    art: {
      teaching: `/assets/demo-shows/${id}-teaching.jpg`,
      challenge: `/assets/demo-shows/${id}-challenge.jpg`,
    },
    episode: episodeSchema.parse({
      ...demoEpisode,
      episodeId: `demo-${id}`,
      courseId: `demo-${id}`,
      title,
      theme,
      cast: demoEpisode.cast.map((member, index) => index === 0 ? { ...member, persona: theme.hostPersona } : member),
      cliffhanger: { ...demoEpisode.cliffhanger, teaser },
    }),
  };
}

/** Five no-key show skins for the same short, reviewable photosynthesis pilot.
 * They make the show-format choice immediately explorable without asking a
 * visitor to provide notes or configure a live-generation key. */
export const demoShows: DemoShow[] = [
  demoShow("photon-frontier", "The Photon Frontier", "Next: The Carbon Circuit", "retro-sci-fi"),
  demoShow("cellular-casefile", "The Cellular Casefile", "Next: The Calvin Cycle Caper", "noir"),
  demoShow("power-up-plant-lab", "Power-Up Plant Lab", "Next: The Carbon Capture Rescue", "power-squad"),
  demoShow("tiny-lightkeepers", "The Tiny Lightkeepers", "Next: The Garden's Sugar Story", "cozy-preschool"),
  demoShow("chloroplast-quest", "The Chloroplast Quest", "Next: The Cycle Beyond the Storm", "neon-quest"),
];
