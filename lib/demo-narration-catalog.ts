import { demoShows, type DemoShow } from "@/lib/episode";
import type { TtsVoice } from "@/lib/theme";

export type DemoNarrationTrack = {
  key: string;
  line: string;
  showId: string;
  voice: TtsVoice;
};

export function normalizeNarrationLine(line: string) {
  return line.trim().replace(/\s+/g, " ");
}

/**
 * The single source of truth for both the player-visible demo script and the
 * checked-in no-key audio bundle. Keep the spoken copy derived from the
 * finalized fixtures rather than scraping TypeScript source text.
 */
export function collectDemoNarrationTracks(shows: DemoShow[] = demoShows): DemoNarrationTrack[] {
  const byKey = new Map<string, DemoNarrationTrack>();
  for (const show of shows) {
    for (const scene of show.episode.scenes) {
      for (const line of [scene.line, scene.simpler, scene.simplerAgain]) {
        if (!line) continue;
        const normalized = normalizeNarrationLine(line);
        const key = `${show.theme.voice}:${normalized}`;
        byKey.set(key, { key, line: normalized, showId: show.id, voice: show.theme.voice });
      }
    }
  }
  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}
