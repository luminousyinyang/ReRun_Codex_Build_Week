import { z } from "zod";
import type { ShowTheme } from "@/lib/theme";
import { showThemeSchema } from "@/lib/theme";

export const sceneArtRequestSchema = z.object({
  scene: z.object({ id: z.string().min(1).max(80), type: z.string().min(1).max(40), background: z.string().min(1).max(600), visualMoment: z.string().max(600).optional() }),
  theme: showThemeSchema,
  referenceDataUrl: z.string().max(8_000_000).optional(),
});

export type SceneArtRequest = z.infer<typeof sceneArtRequestSchema>;

export function buildSceneArtPrompt(scene: { id: string; background: string; type: string; visualMoment?: string }, theme: ShowTheme) {
  return [
    theme.promptFragments.imageStylePrefix,
    `Scene ${scene.id}, purpose: ${scene.type}. Setting: ${scene.background}. Create a distinct composition for this exact scene, with a new camera angle, prop focus, and staging not repeated elsewhere in the episode.`,
    scene.visualMoment ? `Depict this instructional moment through objects and action: ${scene.visualMoment}.` : "",
    "Use solid flat color fills, hard boundaries, a single simple upper-left light source, and only essential environmental detail.",
    theme.promptFragments.exclusions,
  ].join(" ");
}

export function makeSceneArtKey(request: Pick<SceneArtRequest, "scene" | "theme">) {
  return JSON.stringify({ scene: request.scene, theme: { id: request.theme.id, artStyle: request.theme.artStyle, palette: request.theme.palette } });
}
