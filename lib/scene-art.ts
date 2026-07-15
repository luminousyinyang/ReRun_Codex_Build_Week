import { z } from "zod";
import type { ShowTheme } from "@/lib/theme";
import { showThemeSchema } from "@/lib/theme";

export const sceneArtRequestSchema = z.object({
  scene: z.object({ id: z.string().min(1).max(80), type: z.string().min(1).max(40), background: z.string().min(1).max(600) }),
  theme: showThemeSchema,
  referenceDataUrl: z.string().max(8_000_000).optional(),
});

export type SceneArtRequest = z.infer<typeof sceneArtRequestSchema>;

export function buildSceneArtPrompt(scene: { background: string; type: string }, theme: ShowTheme) {
  return [
    theme.promptFragments.imageStylePrefix,
    `Scene purpose: ${scene.type}. Setting: ${scene.background}.`,
    "Use solid flat color fills, hard boundaries, a single simple upper-left light source, and only essential environmental detail.",
    theme.promptFragments.exclusions,
  ].join(" ");
}

export function makeSceneArtKey(request: Pick<SceneArtRequest, "scene" | "theme">) {
  return JSON.stringify({ scene: request.scene, theme: { id: request.theme.id, artStyle: request.theme.artStyle, palette: request.theme.palette } });
}
