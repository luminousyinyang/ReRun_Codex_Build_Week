import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { demoAudioManifest } from "@/lib/demo-audio-manifest";
import { demoShows } from "@/lib/episode";
import { collectDemoNarrationTracks, normalizeNarrationLine } from "@/lib/demo-narration-catalog";

describe("demo narration catalog", () => {
  it("derives every teaching, worked-example, summary, and rewind line from the finalized fixtures", () => {
    const tracks = collectDemoNarrationTracks();
    const expectedKeys = new Set(
      demoShows.flatMap((show) => show.episode.scenes.flatMap((scene) => [
        ...(scene.teach?.map((step) => step.text) ?? []),
        ...(scene.workedExample?.map((step) => step.text) ?? []),
        scene.line,
        scene.simpler,
        scene.simplerAgain,
      ]
        .filter((line): line is string => Boolean(line))
        .map((line) => `${show.theme.voice}:${normalizeNarrationLine(line)}`))),
    );

    expect(new Set(tracks.map((track) => track.key))).toEqual(expectedKeys);
    expect(new Set(tracks.map((track) => track.voice))).toEqual(new Set(demoShows.map((show) => show.theme.voice)));
    expect(tracks.every((track) => track.line === normalizeNarrationLine(track.line))).toBe(true);
    for (const show of demoShows) {
      for (const scene of show.episode.scenes.filter((scene) => scene.beat)) {
        for (const step of [...(scene.teach ?? []), ...(scene.workedExample ?? [])]) {
          expect(tracks.some((track) => track.key === `${show.theme.voice}:${normalizeNarrationLine(step.text)}`)).toBe(true);
        }
      }
    }
  });

  it("ships a matching local MP3 for every catalog track", () => {
    const publicManifest = JSON.parse(readFileSync(join(process.cwd(), "public/assets/audio/manifest.json"), "utf8"));
    expect(demoAudioManifest).toEqual(publicManifest);

    const tracks = collectDemoNarrationTracks();
    expect(Object.keys(demoAudioManifest.entries)).toEqual(tracks.map((track) => track.key));
    for (const filename of Object.values(demoAudioManifest.entries)) {
      const path = join(process.cwd(), "public/assets/audio", filename);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(0);
    }
  });
});
