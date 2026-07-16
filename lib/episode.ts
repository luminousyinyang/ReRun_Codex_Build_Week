import { z } from "zod";
import { defaultTheme, getPresetTheme, showThemeSchema, type ShowTheme } from "@/lib/theme";

export const sceneTypes = ["recap", "narrative", "beat", "branch_outcome", "commercial", "cliffhanger"] as const;

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

export const teachRoles = ["hook", "define", "analogy", "example", "contrast", "recap"] as const;

const teachStepSchema = z.object({
  role: z.enum(teachRoles),
  text: z.string().min(1),
  /** A durable, caption-adjacent key term or formula for the current scene. */
  onScreen: z.string().min(1).optional(),
});

const beatSchema = z.object({
  kind: z.literal("mcq"),
  question: z.string().min(1),
  /** A genuinely easier, reworded prompt used after a learner rewinds. */
  simplerQuestion: z.string().min(1).optional(),
  /** Per-beat challenge level; optional so existing v1 episodes still load. */
  difficulty: z.number().int().min(1).max(5).optional(),
  /** Concepts deliberately retrieved or integrated by this question. */
  reviewsConcepts: z.array(z.string().min(1)).min(1).optional(),
  /** Lets live validation require a worked method for numerical application. */
  assessmentKind: z.enum(["conceptual", "compute"]).optional(),
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
  /** Learner-paced explanation steps, shown before this scene's question. */
  teach: z.array(teachStepSchema).min(1).optional(),
  /** A method demonstration shown after `teach` and before a compute question. */
  workedExample: z.array(teachStepSchema).min(1).optional(),
  /** Objective keys made explicit by this scene's instruction. */
  teachesConcepts: z.array(z.string().min(1)).min(1).optional(),
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
  channel: z.number().int().min(2).max(99),
  format: z.literal("toon"),
  difficulty: z.number().int().min(1).max(5),
  theme: showThemeSchema.optional(),
  learningObjectives: z.array(z.object({ id: z.string(), conceptKey: z.string(), text: z.string() })).min(1),
  cast: z.array(z.object({ id: z.string(), name: z.string(), persona: z.string(), voice: z.string().optional() })).min(1),
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
});

const structuredBeatSchema = z.object({
  kind: z.literal("mcq"),
  question: z.string().min(1),
  simplerQuestion: z.string().min(1).nullable(),
  difficulty: z.number().int().min(1).max(5).nullable(),
  reviewsConcepts: z.array(z.string().min(1)).min(1).nullable(),
  assessmentKind: z.enum(["conceptual", "compute"]).nullable(),
  options: z.array(structuredOptionSchema).min(2).max(4),
  onCorrect: z.string().min(1),
  onIncorrect: z.string().min(1),
});

const structuredTeachStepSchema = z.object({
  role: z.enum(teachRoles),
  text: z.string().min(1),
  onScreen: z.string().min(1).nullable(),
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
  teach: z.array(structuredTeachStepSchema).min(1).nullable(),
  workedExample: z.array(structuredTeachStepSchema).min(1).nullable(),
  teachesConcepts: z.array(z.string().min(1)).min(1).nullable(),
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
  cast: z.array(z.object({ id: z.string(), name: z.string(), persona: z.string(), voice: z.string().nullable() })).min(1),
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
    if (scene.beat) {
      const optionIds = new Set<string>();
      const optionTexts = new Set<string>();
      for (const option of scene.beat.options) {
        const normalizedText = option.text.trim().toLocaleLowerCase();
        if (optionIds.has(option.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Beat ${scene.id} has duplicate option id: ${option.id}` });
        if (optionTexts.has(normalizedText)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Beat ${scene.id} has duplicate option text: ${option.text}` });
        optionIds.add(option.id);
        optionTexts.add(normalizedText);
      }
    }
  }
  for (const scene of episode.scenes) {
    for (const destination of [scene.next, scene.beat?.onCorrect, scene.beat?.onIncorrect]) {
      if (destination && !ids.has(destination)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown scene destination: ${destination}` });
    }
  }

  const start = episode.scenes.find((scene) => scene.id === "recap");
  if (start) {
    const reachable = new Set<string>();
    const pending = [start.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const scene = episode.scenes.find((candidate) => candidate.id === id);
      if (!scene) continue;
      for (const destination of [scene.next, scene.beat?.onCorrect, scene.beat?.onIncorrect]) {
        if (destination && !reachable.has(destination)) pending.push(destination);
      }
    }
    // Structured Output normalization removes null optional fields, so an
    // omitted `next` is also a terminal scene at runtime.
    const ending = episode.scenes.find((scene) => scene.type === "cliffhanger" && !scene.next);
    if (!ending || !reachable.has(ending.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Episode must have a reachable cliffhanger ending." });
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
  validateLiveEpisodeStructure(episode);
  return episode;
}

/**
 * Live generations use a deliberately fuller contract than the backward-
 * compatible v1 runtime schema. This keeps old saved episodes readable while
 * refusing a thin or unsafe new generation before the player receives it.
 */
export function validateLiveEpisodeStructure(episode: EpisodeSpec) {
  if (episode.scenes.length < 12 || episode.scenes.length > 22) throw new Error("Generated episode must contain between 12 and 22 scenes.");
  const sceneTypeCount = (type: Scene["type"]) => episode.scenes.filter((scene) => scene.type === type).length;
  if (sceneTypeCount("recap") !== 1 || sceneTypeCount("cliffhanger") !== 1) {
    throw new Error("Generated episode must contain one recap and one cliffhanger.");
  }
  if (sceneTypeCount("narrative") < 3) {
    throw new Error("Generated episode must include a short narrative setup for each act.");
  }

  const objectiveKeys = new Set(episode.learningObjectives.map((objective) => objective.conceptKey));
  if (episode.learningObjectives.length !== 3 || objectiveKeys.size !== 3) {
    throw new Error("Generated episode must teach exactly three distinct learning objectives.");
  }
  const beats = episode.scenes.filter((scene) => scene.beat);
  if (beats.length < 3) throw new Error("Generated episode must contain at least three primary MCQ beats.");
  const sceneById = new Map(episode.scenes.map((scene) => [scene.id, scene]));
  const successPath: Scene[] = [];
  const visited = new Set<string>();
  let cursor = sceneById.get("recap");
  while (cursor && !visited.has(cursor.id)) {
    successPath.push(cursor);
    visited.add(cursor.id);
    const successor = cursor.beat?.onCorrect ?? cursor.next;
    cursor = successor ? sceneById.get(successor) : undefined;
  }
  if (!successPath.some((scene) => scene.type === "cliffhanger")) throw new Error("Generated episode needs a canonical success path to its cliffhanger.");

  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const taughtSoFar = new Set<string>();
  for (const scene of beats) {
    const beat = scene.beat!;
    if (!beat.simplerQuestion || beat.simplerQuestion.trim().toLocaleLowerCase() === beat.question.trim().toLocaleLowerCase()) {
      throw new Error(`Beat ${scene.id} needs a distinct simplerQuestion for its rewind.`);
    }
    if (beat.difficulty === undefined || !beat.reviewsConcepts?.length) {
      throw new Error(`Beat ${scene.id} needs difficulty and reviewsConcepts metadata.`);
    }
    if (beat.reviewsConcepts.some((concept) => !objectiveKeys.has(concept))) {
      throw new Error(`Beat ${scene.id} reviews a concept that is not taught by this episode.`);
    }
    if (beat.assessmentKind !== "conceptual" && beat.assessmentKind !== "compute") {
      throw new Error(`Beat ${scene.id} needs an assessmentKind.`);
    }
    // A beat that first introduces a concept must teach it in full. Later beats
    // re-test already-taught concepts and must NOT re-lecture (spaced practice).
    const introducesConcept = beat.reviewsConcepts.some((concept) => !taughtSoFar.has(concept));
    for (const concept of beat.reviewsConcepts) taughtSoFar.add(concept);
    if (introducesConcept && (!scene.teach || scene.teach.length < 3)) {
      throw new Error(`Beat ${scene.id} needs at least three teaching steps before its question.`);
    }
    if (!scene.teachesConcepts || beat.reviewsConcepts.some((concept) => !scene.teachesConcepts!.includes(concept))) {
      throw new Error(`Beat ${scene.id} must name every concept it teaches before assessment.`);
    }
    if (scene.teachesConcepts.some((concept) => !objectiveKeys.has(concept))) {
      throw new Error(`Scene ${scene.id} teaches an unknown concept key.`);
    }
    if (beat.assessmentKind === "compute") {
      if (!scene.workedExample || scene.workedExample.length < 3 || !scene.workedExample.some((step) => step.role === "example")) {
        throw new Error(`Compute beat ${scene.id} needs a worked example before its question.`);
      }
    }
    if (!scene.line || !scene.deepDive || !scene.simpler || !scene.simplerAgain) {
      throw new Error(`Teaching scene ${scene.id} needs summary, deep-dive, and two rewind takes.`);
    }
    const versions = [scene.line, scene.deepDive, scene.simpler, scene.simplerAgain].map(normalize);
    if (new Set(versions).size !== versions.length) {
      throw new Error(`Teaching scene ${scene.id} repeats a summary, deep-dive, or rewind take.`);
    }
    const outcome = episode.scenes.find((candidate) => candidate.id === beat.onIncorrect);
    if (!outcome || outcome.type !== "branch_outcome" || !outcome.refutation || !outcome.next) {
      throw new Error(`Beat ${scene.id} needs a supportive corrective branch with a refutation and retry.`);
    }
    const correctTarget = episode.scenes.find((candidate) => candidate.id === beat.onCorrect);
    if (!correctTarget || correctTarget.type === "branch_outcome") {
      throw new Error(`Beat ${scene.id} must route a correct answer forward, never to a retry branch.`);
    }
    const retry = episode.scenes.find((candidate) => candidate.id === outcome.next);
    if (!retry?.beat || retry.id !== scene.id) {
      throw new Error(`Corrective branch for ${scene.id} must rewind to the same simplified beat.`);
    }
  }
  const reviewed = new Set(beats.flatMap((scene) => scene.beat!.reviewsConcepts ?? []));
  if (Array.from(objectiveKeys).some((concept) => !reviewed.has(concept))) {
    throw new Error("Generated episode must assess every taught concept.");
  }
  const taughtOnSuccessPath = new Set(successPath.flatMap((scene) => scene.teachesConcepts ?? []));
  if (Array.from(objectiveKeys).some((concept) => !taughtOnSuccessPath.has(concept))) {
    throw new Error("Generated episode must teach every objective on its canonical success path.");
  }
  const finalBeat = beats.at(-1)!;
  if (objectiveKeys.size !== finalBeat.beat!.reviewsConcepts?.length || Array.from(objectiveKeys).some((concept) => !finalBeat.beat!.reviewsConcepts?.includes(concept))) {
    throw new Error("Generated finale must cumulatively integrate all three taught concepts.");
  }
}

export type DemoShow = {
  id: string;
  title: string;
  teaser: string;
  topic: string;
  theme: ShowTheme;
  episode: EpisodeSpec;
  art: { teaching: string; challenge: string; host?: { idle: string; talk: string; retry: string } };
};

type PilotBeat = {
  key: string;
  line: string;
  question: string;
  simplerQuestion: string;
  options: readonly [string, string, string];
  correct: number;
  refutation: string;
  reviewsConcepts: string[];
};

type Pilot = {
  id: string;
  title: string;
  teaser: string;
  themeId: string;
  difficulty: number;
  subject: string;
  /** Short plain-language topic shown on the home lineup and catalog cards. */
  topic: string;
  host: string;
  /** Host-appropriate lead-in for the supportive corrective branch. */
  retryLead: string;
  recap: { prompt: string; answers: string[]; conceptKey: string };
  objectives: readonly [{ key: string; text: string }, { key: string; text: string }, { key: string; text: string }];
  actLines: readonly [string, string, string, string];
  beats: readonly [PilotBeat, PilotBeat, PilotBeat, PilotBeat, PilotBeat, PilotBeat];
};

type TeachStep = { role: (typeof teachRoles)[number]; text: string; onScreen?: string };

type ConceptTeachingProfile = {
  hook: string;
  definition: string;
  analogy: string;
  contrast: string;
  onScreen: string;
  /** New mechanism shown only when a learner pauses. Must add detail the four
   * teach steps did not already state, so a pause is never a rerun. */
  deepDive: string;
  /** Host-flavored hand-off line shown right before this concept's question.
   * Points at the topic to prime retrieval; never states the answer. Unique per
   * concept (each concept belongs to one show) so no two questions share a cue. */
  cue: string;
};

const conceptTeaching: Record<string, ConceptTeachingProfile> = {
  "circuits.voltage": { hook: "Your phone charger and a lightning bolt rely on the same hidden push. Let's name it.", definition: "Voltage is an energy difference that pushes electric charge through a complete circuit.", analogy: "Think of a water tower: higher water presses harder through a hose, like voltage pushes charge.", contrast: "Voltage is the push, not the moving charge. Moving charge is current.", onScreen: "VOLTAGE = push on charge", deepDive: "Measured in volts, it is really an energy difference per unit of charge between two points. A battery holds that difference ready at its terminals, so charge is pushed the instant a complete path connects them.", cue: "Signal's yours now, cadet — lock in what voltage really is." },
  "circuits.current": { hook: "Flip a switch and something starts moving through the wire almost instantly. What is it?", definition: "Electric current is the movement of electric charge through a complete path.", analogy: "If voltage is the hill, current is the stream of balls rolling down it each second.", contrast: "Current is the flow; voltage supplies the push and resistance makes flow harder.", onScreen: "CURRENT = flow of charge", deepDive: "Current is measured in amperes, where one ampere is a fixed amount of charge passing a point every second. In a single loop, that same current flows through every part in turn.", cue: "Meter's live — read what's actually moving through the loop." },
  "circuits.ohms-law": { hook: "Engineers predict a circuit's current before they ever build it. Here's the rule that lets them.", definition: "Ohm's law links current, voltage, and resistance: current equals voltage divided by resistance.", analogy: "A narrow hallway slows a crowd; more resistance leaves less current for the same push.", contrast: "More resistance does not create current. At fixed voltage, it lowers current.", onScreen: "I = V ÷ R", deepDive: "The rule rearranges to fit the unknown: V = I × R finds the push and R = V ÷ I finds the resistance. Double the resistance at the same voltage and the current is cut in half.", cue: "Instruments ready — call the current before we build it." },
  "cell.nucleus": { hook: "Every cell carries a full instruction manual for the whole body. Where does it keep that manual safe?", definition: "The nucleus stores most of a eukaryotic cell's DNA instructions.", analogy: "It is the cell's protected filing room for the instruction manual.", contrast: "The nucleus stores instructions; it does not assemble proteins or make most ATP.", onScreen: "NUCLEUS = DNA instructions", deepDive: "A double membrane called the nuclear envelope wraps the DNA, and pores in it control what passes through. Working copies of instructions leave to be used while the master originals stay protected inside.", cue: "Your move, detective — find who guards the files." },
  "cell.mitochondria": { hook: "Moving, thinking, breathing — all of it needs energy nonstop. Which cell part keeps supplying it?", definition: "Mitochondria make much of a cell's ATP during cellular respiration.", analogy: "They are energy stations that recharge many small ATP batteries.", contrast: "Mitochondria supply much ATP; they are not the DNA archive or protein assembly line.", onScreen: "MITOCHONDRIA = ATP", deepDive: "Their folded inner membranes pack in extra surface area to run respiration. That is why hard-working cells such as muscle carry far more mitochondria than sluggish ones do.", cue: "Follow the power trail and name its source." },
  "cell.ribosomes": { hook: "Cells are always building new proteins to grow and repair. Where does that assembly happen?", definition: "Ribosomes assemble proteins by linking amino acids together.", analogy: "They are tiny workbenches that follow instructions to build a protein.", contrast: "Ribosomes build proteins; they do not store DNA or specialize in ATP production.", onScreen: "RIBOSOMES = proteins", deepDive: "A ribosome reads a messenger copy of the DNA three letters at a time, adding one amino acid per instruction. Some drift freely while others dock on membranes to build proteins meant for export.", cue: "One suspect left — identify the builder." },
  "forces.newton-first": { hook: "A hockey puck glides across smooth ice and just keeps going. What would it take to change that?", definition: "An object's motion changes only when forces are unbalanced, creating a nonzero net force.", analogy: "A tug-of-war stays still when both teams pull equally; motion changes when one side wins.", contrast: "Balanced does not mean no forces. It means the forces cancel.", onScreen: "NET FORCE 0 → no motion change", deepDive: "This tendency to resist any change in motion is called inertia, and more mass means more of it. On real surfaces friction is usually the hidden force that finally slows a gliding object down.", cue: "Call it, squad — what changes an object's motion?" },
  "forces.newton-second": { hook: "The same shove barely moves a truck but launches a light cart. Why the difference?", definition: "Newton's second law says net force causes acceleration, and F equals mass times acceleration.", analogy: "The same push changes a shopping cart more than a heavy truck because the truck has more mass.", contrast: "More force gives more acceleration only when mass stays the same.", onScreen: "F = m × a", deepDive: "Because acceleration equals force divided by mass, the same net force gives a heavier object a smaller acceleration. Double the force and acceleration doubles; double the mass and it halves.", cue: "Power meter's yours — make the read on that push." },
  "forces.newton-third": { hook: "A rocket in empty space has nothing to push against, yet it still flies. How?", definition: "For every force on one object, there is an equal and opposite force on another object.", analogy: "When you step off a skateboard, your foot pushes it back while it pushes you forward.", contrast: "The pair is equal but acts on two different objects, so it does not cancel on one object.", onScreen: "ACTION ↔ REACTION (two objects)", deepDive: "The two forces are always the same type and happen at the very same instant. Because each one pushes on a different object, they never cancel — which is exactly why a rocket or a swimmer moves.", cue: "Team-up time — spot the partner force." },
  "water.evaporation": { hook: "A rain puddle vanishes on a sunny afternoon. Where did all that water actually go?", definition: "Evaporation is liquid water changing into water vapor, a gas.", analogy: "Sun-warmed puddle water can slip into the air one invisible molecule at a time.", contrast: "Evaporation rises into air; it does not turn water into ice or rain.", onScreen: "EVAPORATION: liquid → gas", deepDive: "The fastest-moving surface molecules escape first, so evaporation actually cools the water left behind. Extra heat, moving wind, and more exposed surface all make it happen faster.", cue: "Your turn, little sprout — follow where the puddle went." },
  "water.condensation": { hook: "A cold glass 'sweats' on a warm day, though nothing spilled. Where do those drops come from?", definition: "Condensation is water vapor cooling and changing into liquid droplets.", analogy: "Like breath making tiny drops on a cold window, cooling vapor gathers into droplets.", contrast: "Condensation makes droplets; evaporation makes vapor.", onScreen: "CONDENSATION: gas → liquid", deepDive: "Cool air can hold less water vapor than warm air, so the surplus vapor collects onto tiny floating particles. That very process forms cloud droplets, ground fog, and the dew you find on morning grass.", cue: "Peek up at the cloud and tell me what's forming." },
  "water.precipitation": { hook: "Clouds drift for days, then all at once it pours. What finally sends the water down?", definition: "Precipitation is water falling from clouds as rain, snow, sleet, or hail.", analogy: "When cloud droplets grow too heavy to stay aloft, gravity brings them back down.", contrast: "Precipitation falls; evaporation rises and condensation gathers cloud droplets.", onScreen: "PRECIPITATION = water falls", deepDive: "Inside a cloud, droplets keep colliding and merging until they are finally too heavy to float. How cold the air is on the way down decides whether they land as rain, snow, sleet, or hail.", cue: "Last little step — name what's coming down from the cloud." },
  "photosynthesis.light-reactions": { hook: "A leaf turns sunlight into fuel. Where inside it does that very first step happen?", definition: "The light reactions use light in thylakoid membranes inside chloroplasts.", analogy: "Thylakoids are solar-panel rooms where chlorophyll catches light energy.", contrast: "Light reactions happen in thylakoids, not in the cell wall or nucleus.", onScreen: "LIGHT REACTIONS → thylakoids", deepDive: "Chlorophyll packed into the thylakoid membrane absorbs light and lifts electrons to a higher energy level. That captured energy is what the cell spends to build ATP and NADPH.", cue: "Explorer's call — find where the light gets caught." },
  "photosynthesis.water-splitting": { hook: "The oxygen in your next breath came from a plant tearing something apart. What?", definition: "During light reactions, water is split to replace electrons and releases oxygen.", analogy: "Water is a supply crate: its electrons keep the light system running while oxygen exits as a by-product.", contrast: "Water splitting releases oxygen; carbon dioxide is used later to build carbon compounds.", onScreen: "H₂O → electrons + O₂", deepDive: "Splitting water, called photolysis, hands its electrons to the light system to replace the ones chlorophyll gave up. Oxygen leaves as waste, and the leftover hydrogen ions help drive ATP production.", cue: "Trace the split and name what's set loose." },
  "photosynthesis.calvin-setup": { hook: "Catching light is only the beginning. What does the plant make first, before any sugar?", definition: "ATP and NADPH from the light reactions provide energy and energized electrons for carbon fixation.", analogy: "They are charged delivery packs carried from the solar-panel room to the sugar-building workshop.", contrast: "ATP and NADPH support carbon fixation; oxygen is not their cargo and water is not their product.", onScreen: "ATP + NADPH → carbon fixation", deepDive: "Out in the stroma, the Calvin cycle spends that ATP and NADPH to attach carbon from carbon dioxide onto a growing sugar. It needs no light directly — only the energy the light stage already delivered.", cue: "Check the cargo heading for the next stage." },
};

function teachingFor(beat: PilotBeat, phase: "introduce" | "retrieve" | "review") {
  const profiles = beat.reviewsConcepts.map((concept) => conceptTeaching[concept]).filter((profile): profile is ConceptTeachingProfile => Boolean(profile));
  const primary = profiles[0];
  if (!primary) throw new Error(`Missing teaching profile for ${beat.key}`);

  const ruleKey = beat.key === "combine" && beat.reviewsConcepts.includes("circuits.ohms-law")
    ? "circuits.ohms-law"
    : beat.key === "combine" && beat.reviewsConcepts.includes("forces.newton-second")
      ? "forces.newton-second"
      : undefined;
  const rule = ruleKey ? conceptTeaching[ruleKey] : undefined;
  const workedExample = ruleKey === "circuits.ohms-law"
    ? [
        { role: "define" as const, text: "For a circuit calculation, start with Ohm's law: current equals voltage divided by resistance.", onScreen: "I = V ÷ R" },
        { role: "example" as const, text: "Worked example: 12 volts through 6 ohms means I equals 12 divided by 6, so 2 amps flow.", onScreen: "12 V ÷ 6 Ω = 2 A" },
        { role: "contrast" as const, text: "Name the units as you work: volts are the push, ohms resist flow, and amps measure current." },
      ]
    : ruleKey === "forces.newton-second"
      ? [
          { role: "define" as const, text: "For force problems, rearrange Newton's second law: acceleration equals net force divided by mass.", onScreen: "a = F ÷ m" },
          { role: "example" as const, text: "Worked example: a 6-newton net force on a 2-kilogram cart gives 6 divided by 2, or 3 meters per second squared.", onScreen: "6 N ÷ 2 kg = 3 m/s²" },
          { role: "contrast" as const, text: "Use net force, not just any single push, because net force is what changes the cart's motion." },
        ]
      : undefined;

  // Teach a concept in full the FIRST time it appears; after that, don't re-lecture.
  // Retrieval and conceptual-review beats are spaced practice — a short cue, then the
  // question. A compute review introduces a genuinely new skill (the calculation), so
  // it keeps a brief setup plus a worked example rather than repeating the concepts.
  let teach: TeachStep[] | undefined;
  let line: string;
  if (phase === "introduce") {
    teach = [
      { role: "hook", text: primary.hook },
      { role: "define", text: primary.definition, onScreen: primary.onScreen },
      { role: "analogy", text: primary.analogy },
      { role: "contrast", text: primary.contrast },
    ];
    // The pre-question line is a bridge, never the answer. The four teach steps
    // above did the teaching; restating the on-screen term here would hand over
    // the correct option. Each concept has its own host-flavored cue, so no two
    // questions in a show share this line.
    line = primary.cue;
  } else if (rule && workedExample) {
    teach = [{ role: "hook", text: "New tool — turn what you already know into a quick calculation.", onScreen: rule.onScreen }];
    line = "Your turn — run the numbers.";
  } else if (phase === "retrieve") {
    teach = undefined;
    line = "Quick recall — no new notes, just answer from memory.";
  } else {
    teach = undefined;
    line = beat.key === "finale" ? "Last one — the whole picture in a single answer." : "Here's where it all clicks into place.";
  }

  const focus = rule ?? primary;
  return {
    teach,
    workedExample,
    line,
    deepDive: focus.deepDive,
    simpler: focus.analogy,
    simplerAgain: `${focus.onScreen}.`,
    assessmentKind: workedExample ? "compute" as const : "conceptual" as const,
  };
}

function narrativeSupport(line: string) {
  return {
    line,
    deepDive: `${line} Look for the detail that makes this moment matter.`,
    simpler: `Think of it as one small step in the story: ${line}`,
    simplerAgain: `Hold onto this broadcast clue: ${line}`,
  };
}

function buildPilot(pilot: Pilot): DemoShow {
  const theme = getPresetTheme(pilot.themeId);
  const [conceptOne, conceptTwo, retrieve, conceptThree, integration, finale] = pilot.beats;
  const objectives = pilot.objectives.map((objective, index) => ({ id: `lo-${index + 1}`, conceptKey: objective.key, text: objective.text }));
  const makeBeat = (beat: PilotBeat, onCorrect: string, level: number, phase: "introduce" | "retrieve" | "review", type: "beat" | "commercial" = "beat") => {
    const lesson = teachingFor(beat, phase);
    return {
      id: `beat-${beat.key}`,
      type,
      background: `${pilot.subject}, decision moment: ${beat.key}`,
      speaker: pilot.host,
      line: lesson.line,
      deepDive: lesson.deepDive,
      simpler: lesson.simpler,
      simplerAgain: lesson.simplerAgain,
      ...(lesson.teach ? { teach: lesson.teach } : {}),
      ...(lesson.workedExample ? { workedExample: lesson.workedExample } : {}),
      teachesConcepts: beat.reviewsConcepts,
      beat: {
        kind: "mcq" as const,
        question: beat.question,
        simplerQuestion: beat.simplerQuestion,
        difficulty: level,
        reviewsConcepts: beat.reviewsConcepts,
        assessmentKind: lesson.assessmentKind,
        options: beat.options.map((text, index) => ({ id: `${beat.key}-${index + 1}`, text, isCorrect: index === beat.correct })),
        onCorrect,
        onIncorrect: `outcome-${beat.key}`,
      },
    };
  };
  const makeOutcome = (beat: PilotBeat, next = `beat-${beat.key}`) => ({
    id: `outcome-${beat.key}`,
    type: "branch_outcome" as const,
    background: `${pilot.subject}, supportive correction for ${beat.key}`,
    speaker: pilot.host,
    ...narrativeSupport(`${pilot.retryLead} ${beat.refutation}`),
    refutation: beat.refutation,
    next,
  });
  const episode = episodeSchema.parse({
    version: 1,
    episodeId: `demo-${pilot.id}`,
    courseId: `demo-${pilot.id}`,
    title: pilot.title,
    channel: ({ "photon-frontier": 4, "cellular-casefile": 5, "power-up-plant-lab": 6, "tiny-lightkeepers": 7, "chloroplast-quest": 8 } as Record<string, number>)[pilot.id] ?? 3,
    format: "toon",
    difficulty: pilot.difficulty,
    theme,
    learningObjectives: objectives,
    cast: [{ id: `${pilot.id}-host`, name: pilot.host, persona: theme.hostPersona, voice: theme.voice }],
    scenes: [
      { id: "recap", type: "recap", background: `${pilot.subject}, recap card`, speaker: pilot.host, recap: [pilot.recap], next: "act-1-open" },
      // One short setup narrative per act (each foreshadows that act's concept),
      // then the concept is taught and tested inside its beat. No filler payoffs,
      // no separate "integration" scene — the combine and finale beats do that.
      { id: "act-1-open", type: "narrative", background: `${pilot.subject}, act one discovery`, speaker: pilot.host, ...narrativeSupport(pilot.actLines[0]), next: `beat-${conceptOne.key}` },
      makeBeat(conceptOne, "act-2-open", pilot.difficulty, "introduce"),
      makeOutcome(conceptOne),
      { id: "act-2-open", type: "narrative", background: `${pilot.subject}, act two investigation`, speaker: pilot.host, ...narrativeSupport(pilot.actLines[1]), next: `beat-${conceptTwo.key}` },
      makeBeat(conceptTwo, `beat-${retrieve.key}`, pilot.difficulty, "introduce"),
      makeOutcome(conceptTwo),
      makeBeat(retrieve, "act-3-open", pilot.difficulty, "retrieve"),
      makeOutcome(retrieve),
      { id: "act-3-open", type: "narrative", background: `${pilot.subject}, act three plan`, speaker: pilot.host, ...narrativeSupport(pilot.actLines[3]), next: `beat-${conceptThree.key}` },
      makeBeat(conceptThree, `beat-${integration.key}`, pilot.difficulty, "introduce"),
      makeOutcome(conceptThree),
      makeBeat(integration, `beat-${finale.key}`, pilot.difficulty, "review"),
      makeOutcome(integration),
      makeBeat(finale, "cliffhanger", pilot.difficulty, "review"),
      makeOutcome(finale),
      { id: "cliffhanger", type: "cliffhanger", background: `${pilot.subject}, next adventure revealed`, speaker: pilot.host, ...narrativeSupport(pilot.teaser), next: null },
    ],
    cliffhanger: { teaser: pilot.teaser, airsAfterHours: 24 },
  });
  return {
    id: pilot.id,
    title: pilot.title,
    teaser: pilot.teaser,
    topic: pilot.topic,
    theme,
    art: { teaching: `/assets/demo-shows/${pilot.id}-teaching.jpg`, challenge: `/assets/demo-shows/${pilot.id}-challenge.jpg`, host: { idle: `/assets/motion/${pilot.id}-idle.png`, talk: `/assets/motion/${pilot.id}-talk.png`, retry: `/assets/motion/${pilot.id}-retry.png` } },
    episode,
  };
}

const pilots: Pilot[] = [
  {
    id: "photon-frontier", title: "The Circuit Frontier", teaser: "Next: Resistance Riddles in the Outer Circuit.", topic: "Circuits & Ohm's law", themeId: "retro-sci-fi", difficulty: 3, subject: "a glowing spacecraft circuit lab", host: "Anchor Volt", retryLead: "Close read, cadet.", recap: { prompt: "In a circuit, electric current is the flow of what?", answers: ["electric charge"], conceptKey: "circuits.current" }, objectives: [{ key: "circuits.voltage", text: "Explain voltage as the push on electric charge." }, { key: "circuits.current", text: "Relate current to the flow of electric charge." }, { key: "circuits.ohms-law", text: "Use Ohm's law to connect voltage, current, and resistance." }], actLines: ["Signal from the frontier: the ship's circuit is alive with something we can't see. Time to name it.", "Every reading on this console traces back to that one hidden push.", "Power is moving through the wires now — but moving how, and how much? Next reading, please.", "The crew wants to predict this circuit before they ever flip the switch. Let's find the rule."], beats: [
      { key: "voltage", line: "First signal lock: what does voltage do?", question: "In a circuit, voltage is best described as...", simplerQuestion: "What gives electric charges a push?", options: ["A push or energy difference for charge", "The number of charges flowing each second", "A part that always creates electricity"], correct: 0, refutation: "Voltage is the electrical push; current describes how much charge flows, and a component does not automatically supply a push.", reviewsConcepts: ["circuits.voltage"] },
      { key: "current", line: "Meter check: identify the flow.", question: "Electric current is the flow of...", simplerQuestion: "What moves through a circuit as current?", options: ["Electric charge", "Only voltage", "Resistance"], correct: 0, refutation: "Current is moving electric charge. Voltage pushes, while resistance opposes that flow.", reviewsConcepts: ["circuits.current"] },
      { key: "retrieve-voltage", line: "Midway transmission: retrieve Act One.", question: "Which quantity provides the push that can drive current?", simplerQuestion: "Which word means electrical push?", options: ["Voltage", "Current", "Resistance"], correct: 0, refutation: "Voltage is the push. Current is the resulting charge flow and resistance makes the flow harder.", reviewsConcepts: ["circuits.voltage"] },
      { key: "ohms-law", line: "The frontier equation is online.", question: "If voltage stays the same and resistance increases, current will...", simplerQuestion: "More resistance with the same push means what happens to current?", options: ["Decrease", "Increase", "Stay exactly the same"], correct: 0, refutation: "Ohm's law is I = V/R, so increasing resistance at fixed voltage lowers current.", reviewsConcepts: ["circuits.ohms-law"] },
      { key: "combine", line: "Combine the meter clues.", question: "A 24 V source and 6 Ω resistor produce what current?", simplerQuestion: "Use current = voltage ÷ resistance: 24 ÷ 6 = ?", options: ["4 A", "18 A", "144 A"], correct: 0, refutation: "I = V/R, so 24 volts divided by 6 ohms equals 4 amperes.", reviewsConcepts: ["circuits.voltage", "circuits.current", "circuits.ohms-law"] },
      { key: "finale", line: "Finale: stabilize the ship's circuit.", question: "Which change lowers current in a circuit with a fixed voltage?", simplerQuestion: "To make less current with the same voltage, what should increase?", options: ["Increase resistance", "Increase voltage", "Remove the circuit path"], correct: 0, refutation: "Increasing resistance lowers current when voltage is fixed. Raising voltage increases current; opening the path stops the circuit rather than tuning it.", reviewsConcepts: ["circuits.voltage", "circuits.current", "circuits.ohms-law"] },
    ] },
  {
    id: "cellular-casefile", title: "The Cellular Casefile", teaser: "Next: The Protein Shipment Mystery.", topic: "Cell organelles", themeId: "noir", difficulty: 3, subject: "a moody animal-cell detective office", host: "Detective Nucleus", retryLead: "Close, detective.", recap: { prompt: "Which organelle contains most of a cell's DNA?", answers: ["nucleus"], conceptKey: "cell.nucleus" }, objectives: [{ key: "cell.nucleus", text: "Identify the nucleus as the organelle that stores DNA." }, { key: "cell.mitochondria", text: "Identify mitochondria as major ATP-producing organelles." }, { key: "cell.ribosomes", text: "Identify ribosomes as the place where proteins are assembled." }], actLines: ["Case opened. Every cell is a building full of specialized rooms — first, let's find who guards the records.", "Somewhere in here, the master files never leave the building.", "The lights are on all over this cell. Something is generating the power, and we're going to follow it.", "One room keeps churning out product day and night. Time to name the workshop."], beats: [
      { key: "nucleus", line: "Find the keeper of the DNA files.", question: "Which organelle stores most of a eukaryotic cell's DNA?", simplerQuestion: "Where does a cell keep its DNA instructions?", options: ["Nucleus", "Ribosome", "Mitochondrion"], correct: 0, refutation: "The nucleus stores most DNA. Ribosomes assemble proteins and mitochondria help make ATP.", reviewsConcepts: ["cell.nucleus"] },
      { key: "mitochondria", line: "Follow the ATP evidence.", question: "Which organelle makes much of a cell's ATP during respiration?", simplerQuestion: "Which cell part is known for making ATP?", options: ["Mitochondrion", "Nucleus", "Cell membrane"], correct: 0, refutation: "Mitochondria produce much of the ATP during cellular respiration; the nucleus stores DNA and the membrane controls movement in and out.", reviewsConcepts: ["cell.mitochondria"] },
      { key: "retrieve-nucleus", line: "Recheck the first witness statement.", question: "A cell's genetic instructions are chiefly stored in which organelle?", simplerQuestion: "Which organelle holds DNA?", options: ["Nucleus", "Mitochondrion", "Ribosome"], correct: 0, refutation: "The nucleus holds most genetic instructions; it is not the ATP maker or protein assembler.", reviewsConcepts: ["cell.nucleus"] },
      { key: "ribosomes", line: "The protein workshop has a name.", question: "Which structure assembles proteins from amino acids?", simplerQuestion: "What tiny cell structure builds proteins?", options: ["Ribosome", "Nucleus", "Mitochondrion"], correct: 0, refutation: "Ribosomes assemble proteins. The nucleus stores DNA, and mitochondria specialize in ATP production.", reviewsConcepts: ["cell.ribosomes"] },
      { key: "combine", line: "Match every clue to its room.", question: "Which pairing is correct?", simplerQuestion: "Pick the organelle job pair that matches.", options: ["Mitochondria—ATP production", "Nucleus—protein assembly", "Ribosomes—DNA storage"], correct: 0, refutation: "Mitochondria make much ATP; nuclei store DNA; ribosomes assemble proteins.", reviewsConcepts: ["cell.nucleus", "cell.mitochondria", "cell.ribosomes"] },
      { key: "finale", line: "Close the case with all three suspects sorted.", question: "A cell needs DNA instructions, ATP, and a new protein. Which order of organelles fits those needs?", simplerQuestion: "Which list matches DNA, ATP, then protein building?", options: ["Nucleus, mitochondria, ribosomes", "Ribosomes, nucleus, mitochondria", "Mitochondria, ribosomes, nucleus"], correct: 0, refutation: "The nucleus stores DNA, mitochondria make much ATP, and ribosomes assemble proteins.", reviewsConcepts: ["cell.nucleus", "cell.mitochondria", "cell.ribosomes"] },
    ] },
  {
    id: "power-up-plant-lab", title: "The Force Squad", teaser: "Next: Friction vs. the Rolling Rover.", topic: "Newton's laws of motion", themeId: "power-squad", difficulty: 2, subject: "a bright physics hero training lab", host: "Captain Vector", retryLead: "Good effort, squad.", recap: { prompt: "A force is a push or a ____.", answers: ["pull"], conceptKey: "forces.force" }, objectives: [{ key: "forces.newton-first", text: "Describe Newton's first law using balanced and unbalanced forces." }, { key: "forces.newton-second", text: "Relate net force, mass, and acceleration in Newton's second law." }, { key: "forces.newton-third", text: "Identify equal-and-opposite force pairs in Newton's third law." }], actLines: ["Hero training, lesson one: things in motion have a mind of their own. What does it take to change that?", "A still object and a coasting object are hiding the same secret about forces.", "Same shove, wildly different results. Squad, we need the rule that explains it.", "Every hero move comes with a partner reaction. Let's spot the pair."], beats: [
      { key: "first-law", line: "Freeze frame: what changes motion?", question: "According to Newton's first law, an object changes its motion when...", simplerQuestion: "What kind of force changes an object's motion?", options: ["It has an unbalanced net force", "Forces are balanced", "It has no mass"], correct: 0, refutation: "Balanced forces cancel, so a net (unbalanced) force is needed to change motion.", reviewsConcepts: ["forces.newton-first"] },
      { key: "second-law", line: "Power meter: read the net force.", question: "With the same mass, a larger net force causes...", simplerQuestion: "More net force on the same object gives what?", options: ["More acceleration", "Less acceleration", "No motion at all"], correct: 0, refutation: "Newton's second law says acceleration increases when net force increases for the same mass.", reviewsConcepts: ["forces.newton-second"] },
      { key: "retrieve-first-law", line: "Mid-lab callback: balance check.", question: "A cart moves at constant speed in a straight line. Its net force is...", simplerQuestion: "No change in motion means the net force is what?", options: ["Zero", "Always large", "Equal to its mass"], correct: 0, refutation: "Constant velocity means no acceleration, so the net force is zero even if individual forces are present.", reviewsConcepts: ["forces.newton-first"] },
      { key: "third-law", line: "Team-up move: spot the action-reaction pair.", question: "When a rocket pushes exhaust backward, the exhaust pushes the rocket...", simplerQuestion: "If the rocket pushes gas backward, which way does the gas push the rocket?", options: ["Forward", "Backward only", "Not at all"], correct: 0, refutation: "Newton's third-law forces are equal and opposite on different objects, so exhaust pushes the rocket forward.", reviewsConcepts: ["forces.newton-third"] },
      { key: "combine", line: "Use force math and balance together.", question: "A 2 kg cart has a net force of 8 N. Its acceleration is...", simplerQuestion: "Acceleration = force ÷ mass: 8 ÷ 2 = ?", options: ["4 m/s²", "6 m/s²", "16 m/s²"], correct: 0, refutation: "Using F = ma, acceleration is 8 newtons divided by 2 kilograms: 4 m/s².", reviewsConcepts: ["forces.newton-first", "forces.newton-second"] },
      { key: "finale", line: "Finale: launch the lab rover safely.", question: "Which statement uses all three Newton's laws correctly?", simplerQuestion: "Pick the statement with balance, acceleration, and an action-reaction pair right.", options: ["A net force accelerates the rover; its wheels push backward on the ground as the ground pushes it forward", "Balanced forces make the rover speed up; the ground gives no force back", "The rover accelerates without any net force because it has mass"], correct: 0, refutation: "A net force causes acceleration, and the ground and wheels exert an equal-and-opposite pair on different objects.", reviewsConcepts: ["forces.newton-first", "forces.newton-second", "forces.newton-third"] },
    ] },
  {
    id: "tiny-lightkeepers", title: "The Raindrop Trail", teaser: "Next: The Rainy-Day Garden Parade.", topic: "The water cycle", themeId: "cozy-preschool", difficulty: 1, subject: "a cozy garden water-cycle village", host: "Tilly the Tortoise", retryLead: "So close, little sprout.", recap: { prompt: "Water vapor is water in what state of matter?", answers: ["gas"], conceptKey: "water.vapor" }, objectives: [{ key: "water.evaporation", text: "Explain evaporation as liquid water changing into water vapor." }, { key: "water.condensation", text: "Explain condensation as water vapor cooling into liquid droplets." }, { key: "water.precipitation", text: "Identify precipitation as water falling from clouds." }], actLines: ["A little puddle sat in the sun this morning. By lunchtime it was gone. Where did it go?", "The puddle didn't really disappear — let's follow where it went.", "Way up high, the sky is turning cloudy. Let's peek at how a cloud is born.", "The cloud is full and heavy now. Guess what happens next!"], beats: [
      { key: "evaporation", line: "Where did the warm puddle water go?", question: "Evaporation happens when liquid water changes into...", simplerQuestion: "When a puddle warms and rises into air, it becomes what?", options: ["Water vapor", "Ice", "Rock"], correct: 0, refutation: "Evaporation changes liquid water into water vapor, a gas. It does not make ice or rock.", reviewsConcepts: ["water.evaporation"] },
      { key: "condensation", line: "Look closely at the cloud droplets.", question: "Condensation happens when water vapor cools and becomes...", simplerQuestion: "Cooling water vapor makes what kind of water?", options: ["Liquid droplets", "More vapor", "Sunlight"], correct: 0, refutation: "Condensation turns cooling water vapor into tiny liquid droplets that can form clouds.", reviewsConcepts: ["water.condensation"] },
      { key: "retrieve-evaporation", line: "Remember the first sunny clue.", question: "Which process sends water from a warm pond into the air?", simplerQuestion: "What is the name for water rising from a warm pond?", options: ["Evaporation", "Condensation", "Precipitation"], correct: 0, refutation: "Evaporation sends liquid water into the air as vapor; condensation makes droplets and precipitation falls from clouds.", reviewsConcepts: ["water.evaporation"] },
      { key: "precipitation", line: "The cloud is ready to share water.", question: "Rain, snow, and hail falling from clouds are called...", simplerQuestion: "What do we call water falling from clouds?", options: ["Precipitation", "Evaporation", "Condensation"], correct: 0, refutation: "Precipitation is water that falls from clouds. Evaporation rises, and condensation gathers droplets.", reviewsConcepts: ["water.precipitation"] },
      { key: "combine", line: "Put the little water trip in order.", question: "Which order is part of the water cycle?", simplerQuestion: "What happens after water warms, then cools in clouds?", options: ["Evaporation, condensation, precipitation", "Precipitation, evaporation, condensation", "Condensation, precipitation, evaporation only"], correct: 0, refutation: "Water can evaporate, condense into cloud droplets, and fall as precipitation before collecting again.", reviewsConcepts: ["water.evaporation", "water.condensation", "water.precipitation"] },
      { key: "finale", line: "Finale: help the garden get its water back.", question: "A puddle warms, a cloud forms, then rain falls. Which names match?", simplerQuestion: "Warm puddle, cloud, rain: which three water-cycle words fit?", options: ["Evaporation, condensation, precipitation", "Condensation, evaporation, precipitation", "Precipitation, condensation, evaporation"], correct: 0, refutation: "Warm water evaporates, vapor condenses into clouds, and water falls as precipitation.", reviewsConcepts: ["water.evaporation", "water.condensation", "water.precipitation"] },
    ] },
  {
    id: "chloroplast-quest", title: "The Chloroplast Quest", teaser: "Next: Sugar-Building Beyond the Storm.", topic: "Photosynthesis", themeId: "neon-quest", difficulty: 4, subject: "a neon chloroplast adventure realm", host: "Ari the Explorer", retryLead: "Good instinct, explorer.", recap: { prompt: "The light reactions occur in chloroplast ____ membranes.", answers: ["thylakoid"], conceptKey: "photosynthesis.thylakoid" }, objectives: [{ key: "photosynthesis.light-reactions", text: "Locate the light reactions in thylakoid membranes and identify their outputs." }, { key: "photosynthesis.water-splitting", text: "Explain that water splitting supplies electrons and releases oxygen." }, { key: "photosynthesis.calvin-setup", text: "Explain how ATP and NADPH support carbon fixation in the Calvin cycle." }], actLines: ["Quest briefing: sunlight just struck the leaf. Somewhere inside, the first step begins — let's find the room.", "Whatever this room does, it powers everything the plant makes next.", "The oxygen in your next breath starts here, with the plant taking something apart. Let's see what.", "The light stage packed some supplies for the road ahead. Let's see what it's carrying."], beats: [
      { key: "light-reactions", line: "Name the first chamber of the quest.", question: "Where do the light reactions take place in a chloroplast?", simplerQuestion: "Which chloroplast membranes catch light?", options: ["Thylakoid membranes", "The cell wall", "The nucleus"], correct: 0, refutation: "Light reactions occur in thylakoid membranes. A cell wall is outside the cell, and the nucleus stores DNA.", reviewsConcepts: ["photosynthesis.light-reactions"] },
      { key: "water-splitting", line: "Trace the source of replacement electrons.", question: "Splitting water during the light reactions provides electrons and releases...", simplerQuestion: "When water is split for light reactions, what gas comes out?", options: ["Oxygen", "Carbon dioxide", "Glucose"], correct: 0, refutation: "Water splitting supplies electrons and releases oxygen. Carbon dioxide is used later to build carbon compounds.", reviewsConcepts: ["photosynthesis.water-splitting"] },
      { key: "retrieve-location", line: "Mid-quest recall: return to Act One.", question: "Which structures hold the light-catching machinery?", simplerQuestion: "Where inside the chloroplast is light caught?", options: ["Thylakoid membranes", "Mitochondrial cristae", "Ribosomes"], correct: 0, refutation: "Thylakoid membranes contain the light-catching machinery; cristae belong to mitochondria and ribosomes build proteins.", reviewsConcepts: ["photosynthesis.light-reactions"] },
      { key: "calvin-setup", line: "Choose the supplies carried to the next stage.", question: "Which pair from the light reactions helps power carbon fixation in the Calvin cycle?", simplerQuestion: "Which two energy helpers leave the light reactions?", options: ["ATP and NADPH", "Oxygen and water", "Carbon dioxide and glucose"], correct: 0, refutation: "ATP supplies usable energy and NADPH carries energized electrons to support carbon fixation; oxygen is a by-product.", reviewsConcepts: ["photosynthesis.calvin-setup"] },
      { key: "combine", line: "Link water, light, and energy carriers.", question: "Which sequence is accurate?", simplerQuestion: "Pick the path from water and light to energy helpers.", options: ["Light reactions split water, release oxygen, and make ATP and NADPH", "The Calvin cycle splits water and makes oxygen", "Oxygen becomes ATP in the nucleus"], correct: 0, refutation: "In thylakoids, light reactions split water, release oxygen, and produce ATP and NADPH for later carbon fixation.", reviewsConcepts: ["photosynthesis.light-reactions", "photosynthesis.water-splitting", "photosynthesis.calvin-setup"] },
      { key: "finale", line: "Finale: open the route to carbon fixation.", question: "Why are ATP and NADPH important after the light reactions?", simplerQuestion: "What do ATP and NADPH help the Calvin cycle do?", options: ["They provide energy and energized electrons for building carbon compounds", "They store oxygen for the thylakoids", "They turn chlorophyll into water"], correct: 0, refutation: "ATP and NADPH carry the energy and reducing power that support building carbon compounds in the Calvin cycle.", reviewsConcepts: ["photosynthesis.light-reactions", "photosynthesis.water-splitting", "photosynthesis.calvin-setup"] },
    ] },
];

/** Five independent no-key pilots: each is a tight three-act, 17-scene episode. */
export const demoShows: DemoShow[] = pilots.map(buildPilot);

/** The studio's initial episode remains a full fixture, not a shared clone. */
export const demoEpisode: EpisodeSpec = demoShows[0].episode;
