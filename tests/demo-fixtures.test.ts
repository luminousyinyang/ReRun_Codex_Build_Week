import { describe, expect, it } from "vitest";
import { demoShows, episodeSchema, type EpisodeSpec } from "@/lib/episode";

type RoundFiveBeat = NonNullable<EpisodeSpec["scenes"][number]["beat"]> & {
  simplerQuestion?: string;
  difficulty?: number;
  reviewsConcepts?: string[];
};

const expectedLibrary = {
  "photon-frontier": { title: "The Photon Frontier", difficulty: 3 },
  "cellular-casefile": { title: "The Cellular Casefile", difficulty: 3 },
  "power-up-plant-lab": { title: "Power-Up Plant Lab", difficulty: 2 },
  "tiny-lightkeepers": { title: "The Tiny Lightkeepers", difficulty: 1 },
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

describe("Round 5 bundled demo fixtures", () => {
  it("ships the five planned independent pilots at their planned difficulty", () => {
    expect(demoShows).toHaveLength(5);
    expect(Object.fromEntries(demoShows.map((show) => [show.id, {
      title: show.title,
      difficulty: show.episode.difficulty,
    }]))).toEqual(expectedLibrary);
    expect(new Set(demoShows.map((show) => show.episode.courseId)).size).toBe(5);
    expect(new Set(demoShows.map((show) => show.episode.scenes[0]?.recap?.[0]?.prompt)).size).toBe(5);
  });

  it("makes every pilot a valid, reachable 21-scene three-act learning story", () => {
    for (const { episode } of demoShows) {
      expect(episodeSchema.safeParse(episode).success).toBe(true);
      expect(episode.scenes).toHaveLength(21);
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

  it("authors simpler questions and deliberate own-concept retrieval", () => {
    for (const { episode } of demoShows) {
      const conceptKeys = new Set(episode.learningObjectives.map((objective) => objective.conceptKey));
      const beats = episode.scenes.filter((scene) => scene.beat);
      const roundFiveBeats = beats.map((scene) => ({ scene, beat: scene.beat as RoundFiveBeat }));

      for (const { beat } of roundFiveBeats) {
        expect(beat.simplerQuestion?.trim()).toBeTruthy();
        expect(beat.simplerQuestion?.trim()).not.toBe(beat.question.trim());
        expect(beat.difficulty).toBeGreaterThanOrEqual(1);
        expect(beat.difficulty).toBeLessThanOrEqual(5);
        expect(beat.reviewsConcepts?.length).toBeGreaterThan(0);
        expect(beat.reviewsConcepts?.every((key) => conceptKeys.has(key))).toBe(true);
      }

      const actOneConcepts = new Set(
        roundFiveBeats
          .filter(({ scene }) => episode.scenes.indexOf(scene) < 5)
          .flatMap(({ beat }) => beat.reviewsConcepts ?? []),
      );
      const actTwoBeats = roundFiveBeats.filter(({ scene }) => {
        const index = episode.scenes.indexOf(scene);
        return index >= 5 && index < 11;
      });
      expect(actTwoBeats.some(({ beat }) => beat.reviewsConcepts?.some((key) => actOneConcepts.has(key)))).toBe(true);

      const finale = roundFiveBeats.at(-1)?.beat;
      expect(finale?.reviewsConcepts).toEqual(expect.arrayContaining([...conceptKeys]));
    }
  });
});
