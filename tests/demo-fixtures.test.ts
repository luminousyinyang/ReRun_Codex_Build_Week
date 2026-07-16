import { describe, expect, it } from "vitest";
import { demoShows, episodeSchema, type EpisodeSpec } from "@/lib/episode";

type RoundSixBeat = NonNullable<EpisodeSpec["scenes"][number]["beat"]> & {
  simplerQuestion?: string;
  difficulty?: number;
  reviewsConcepts?: string[];
  assessmentKind?: "conceptual" | "compute";
};

const expectedLibrary = {
  "photon-frontier": { title: "The Circuit Frontier", difficulty: 3 },
  "cellular-casefile": { title: "The Cellular Casefile", difficulty: 3 },
  "power-up-plant-lab": { title: "The Force Squad", difficulty: 2 },
  "tiny-lightkeepers": { title: "The Raindrop Trail", difficulty: 1 },
  "chloroplast-quest": { title: "The Chloroplast Quest", difficulty: 4 },
} as const;

function routesFor(episode: EpisodeSpec) {
  return episode.scenes.flatMap((scene) => [scene.next, scene.beat?.onCorrect, scene.beat?.onIncorrect]).filter(Boolean);
}

function reachableIds(episode: EpisodeSpec) {
  const byId = new Map(episode.scenes.map((scene) => [scene.id, scene]));
  const visited = new Set<string>();
  const pending = [episode.scenes[0]?.id];
  while (pending.length) {
    const id = pending.pop();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const scene = byId.get(id);
    if (!scene) continue;
    for (const destination of [scene.next, scene.beat?.onCorrect, scene.beat?.onIncorrect]) {
      if (destination && !visited.has(destination)) pending.push(destination);
    }
  }
  return visited;
}

describe("Round 6 bundled demo fixtures", () => {
  it("ships the five planned independent pilots at their planned difficulty", () => {
    expect(demoShows).toHaveLength(5);
    expect(Object.fromEntries(demoShows.map((show) => [show.id, {
      title: show.title,
      difficulty: show.episode.difficulty,
    }]))).toEqual(expectedLibrary);
    expect(new Set(demoShows.map((show) => show.episode.courseId)).size).toBe(5);
    expect(new Set(demoShows.map((show) => show.episode.scenes[0]?.recap?.[0]?.prompt)).size).toBe(5);
  });

  it("makes every pilot a valid, reachable 17-scene three-act learning story", () => {
    for (const { episode } of demoShows) {
      expect(episodeSchema.safeParse(episode).success).toBe(true);
      expect(episode.scenes).toHaveLength(17);
      expect(episode.scenes[0]).toMatchObject({ id: "recap", type: "recap" });
      expect(episode.scenes.at(-1)).toMatchObject({ type: "cliffhanger" });
      expect(episode.learningObjectives).toHaveLength(3);
      expect(new Set(episode.learningObjectives.map((objective) => objective.conceptKey)).size).toBe(3);

      const reachable = reachableIds(episode);
      expect(reachable.has(episode.scenes.at(-1)!.id)).toBe(true);
      expect(episode.scenes.filter((scene) => scene.type === "beat").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps routes, choices, and corrective outcomes internally consistent", () => {
    for (const { episode } of demoShows) {
      const ids = new Set(episode.scenes.map((scene) => scene.id));
      expect(new Set(routesFor(episode)).size).toBeGreaterThan(0);
      expect(routesFor(episode).every((destination) => ids.has(destination!))).toBe(true);

      for (const scene of episode.scenes.filter((candidate) => candidate.beat)) {
        const beat = scene.beat!;
        expect(new Set(beat.options.map((option) => option.id)).size).toBe(beat.options.length);
        expect(new Set(beat.options.map((option) => option.text.trim().toLocaleLowerCase())).size).toBe(beat.options.length);
        expect(beat.options.filter((option) => option.isCorrect)).toHaveLength(1);

        const incorrectOutcome = episode.scenes.find((candidate) => candidate.id === beat.onIncorrect);
        expect(incorrectOutcome).toMatchObject({ type: "branch_outcome" });
        expect(incorrectOutcome?.refutation?.trim()).toBeTruthy();
        expect(incorrectOutcome?.next).toBe(scene.id);
      }
    }
  });

  it("teaches each concept once, then re-tests without re-lecturing", () => {
    for (const { episode } of demoShows) {
      const conceptKeys = new Set(episode.learningObjectives.map((objective) => objective.conceptKey));
      const beats = episode.scenes.filter((scene) => scene.beat);
      const roundSixBeats = beats.map((scene) => ({ scene, beat: scene.beat as RoundSixBeat }));

      const taught = new Set<string>();
      for (const { scene, beat } of roundSixBeats) {
        const introduces = (beat.reviewsConcepts ?? []).some((key) => !taught.has(key));
        for (const key of beat.reviewsConcepts ?? []) taught.add(key);

        if (introduces) {
          // First exposure to a concept: teach it in full, once.
          expect(scene.teach!.length).toBeGreaterThanOrEqual(3);
          expect(scene.teach!.every((step) => step.text.trim().length > 0)).toBe(true);
          expect(scene.teach!.some((step) => step.role === "hook" || step.role === "define")).toBe(true);
          expect(scene.teach!.some((step) => step.role === "analogy" || step.role === "example")).toBe(true);
          expect(scene.teach!.some((step) => step.role === "contrast")).toBe(true);
          expect(scene.teach!.some((step) => step.onScreen?.trim())).toBe(true);
        } else if (beat.assessmentKind === "compute") {
          // Re-test that adds a genuinely new skill (a calculation): brief setup, no re-lecture.
          expect(scene.teach?.length ?? 0).toBeLessThanOrEqual(1);
        } else {
          // Pure spaced retrieval / integration: no re-teaching of already-taught concepts.
          expect(scene.teach ?? []).toHaveLength(0);
        }

        expect(scene.teachesConcepts?.length).toBeGreaterThan(0);
        expect(scene.teachesConcepts?.every((key) => conceptKeys.has(key))).toBe(true);
        expect(beat.reviewsConcepts?.every((key) => scene.teachesConcepts?.includes(key))).toBe(true);
        expect(beat.assessmentKind).toMatch(/^(conceptual|compute)$/);
        if (beat.assessmentKind === "compute") {
          expect(scene.workedExample?.length).toBeGreaterThanOrEqual(3);
          expect(scene.workedExample?.some((step) => step.role === "example")).toBe(true);
        } else {
          expect(scene.workedExample).toBeUndefined();
        }
        expect(new Set([scene.line, scene.deepDive, scene.simpler, scene.simplerAgain].map((line) => line?.trim().toLocaleLowerCase()))).toHaveLength(4);
        expect(beat.simplerQuestion?.trim()).toBeTruthy();
        expect(beat.simplerQuestion?.trim()).not.toBe(beat.question.trim());
        expect(beat.difficulty).toBeGreaterThanOrEqual(1);
        expect(beat.difficulty).toBeLessThanOrEqual(5);
        expect(beat.reviewsConcepts?.length).toBeGreaterThan(0);
        expect(beat.reviewsConcepts?.every((key) => conceptKeys.has(key))).toBe(true);
      }

      const finale = roundSixBeats.at(-1)?.beat;
      expect(finale?.reviewsConcepts).toEqual(expect.arrayContaining([...conceptKeys]));
    }
  });
});
