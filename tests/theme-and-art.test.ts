import { describe, expect, it } from "vitest";
import { demoEpisode, episodeSchema } from "@/lib/episode";
import { buildSceneArtPrompt, makeSceneArtKey, sceneArtRequestSchema } from "@/lib/scene-art";
import { defaultTheme, getPresetTheme, showThemePresets } from "@/lib/theme";

describe("theme and art contracts", () => {
  it("keeps the demo episode valid with a normalized theme", () => {
    expect(episodeSchema.parse(demoEpisode).theme?.id).toBe(defaultTheme.id);
  });

  it("ships ten safe original preset themes", () => {
    expect(showThemePresets).toHaveLength(10);
    expect(getPresetTheme("unknown-theme").id).toBe(defaultTheme.id);
    expect(showThemePresets.every((theme) => theme.safety.sanitized && theme.safety.moderationPassed)).toBe(true);
  });

  it("builds a constrained flat-cel art prompt and stable cache key", () => {
    const scene = demoEpisode.scenes[1];
    const request = sceneArtRequestSchema.parse({ scene: { id: scene.id, type: scene.type, background: scene.background }, theme: defaultTheme });
    const prompt = buildSceneArtPrompt(request.scene, request.theme);
    expect(prompt).toContain("solid flat color fills");
    expect(prompt).toContain("No real people");
    expect(makeSceneArtKey(request)).toBe(makeSceneArtKey(request));
  });
});
