import { z } from "zod";

const themeStyleSchema = z.object({
  medium: z.string().min(1),
  linework: z.string().min(1),
  shading: z.string().min(1),
  descriptors: z.array(z.string().min(1)).min(1),
});

export const showThemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  origin: z.enum(["preset", "custom"]),
  artStyle: themeStyleSchema,
  palette: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).min(3).max(6),
  tone: z.string().min(1),
  era: z.string().min(1),
  hostPersona: z.string().min(1),
  voiceInstruction: z.string().min(1),
  promptFragments: z.object({
    episodeStyleLine: z.string().min(1),
    imageStylePrefix: z.string().min(1),
    exclusions: z.string().min(1),
  }),
  safety: z.object({
    sanitized: z.boolean(),
    blockedTerms: z.array(z.string()),
    moderationPassed: z.boolean(),
  }),
});

export type ShowTheme = z.infer<typeof showThemeSchema>;

export const themeInputSchema = z.union([
  z.object({ kind: z.literal("preset"), id: z.string().min(1) }),
  z.object({ kind: z.literal("custom"), vibe: z.string().trim().min(3).max(300) }),
]);

export type ThemeInput = z.infer<typeof themeInputSchema>;

const exclusions = "No real people, named shows, studios, brands, characters, logos, text, watermarks, signatures, photorealism, 3D render, CGI, gradients, airbrushed blends, visible brush strokes, or hyperdetail.";

function preset(id: string, name: string, medium: string, tone: string, hostPersona: string, palette: string[]): ShowTheme {
  const descriptors = ["simplified shapes", "large flat color areas", "confident uniform outlines", "purposeful empty space"];
  return {
    id,
    name,
    origin: "preset",
    artStyle: { medium, linework: "consistent dark-teal ink outlines", shading: "two hard-edged cel-shadow steps", descriptors },
    palette,
    tone,
    era: "original animated broadcast",
    hostPersona,
    voiceInstruction: "Speak clearly, warmly, and with the playful confidence of a classroom TV host.",
    promptFragments: {
      episodeStyleLine: `Original ${name} educational show: ${tone}; ${hostPersona}.`,
      imageStylePrefix: `Original 2D animated educational background in ${medium}; ${descriptors.join(", ")}; limited palette ${palette.join(", ")}; no characters; leave lower-left open for the host and center-right open for captions.`,
      exclusions,
    },
    safety: { sanitized: true, blockedTerms: [], moderationPassed: true },
  };
}

export const showThemePresets: ShowTheme[] = [
  preset("retro-sci-fi", "Retro Sci-Fi Broadcast", "retro-futurist flat cel art with halftone accents", "dry, curious, and PG", "a deadpan android news anchor", ["#10233F", "#3E8A8C", "#F5E9CE", "#E0A24B", "#D65A4A"]),
  preset("suburban-primetime", "Suburban Primetime", "flat vector cartoon art with thick outlines", "wry, gently satirical, and PG", "a frazzled know-it-all suburban dad-narrator", ["#F7D7A8", "#4B89B4", "#F1AA4B", "#D65A4A", "#2A2E45"]),
  preset("cozy-preschool", "Cozy Preschool Corner", "soft crayon and felt-cutout art", "warm and encouraging", "a cheerful tortoise mentor in a cardigan", ["#F5E9CE", "#8BBF9F", "#F3B96B", "#8CB8D8", "#56413A"]),
  preset("power-squad", "Saturday-Morning Power Squad", "bold cel animation with graphic action lines", "heroic and high-energy", "a color-coded team captain", ["#14213D", "#FCA311", "#E63946", "#4CC9F0", "#F1FAEE"]),
  preset("neon-quest", "Neon Anime Quest", "original expressive anime-inspired line art", "adventurous and heartfelt", "a determined young explorer", ["#15152B", "#55DDE0", "#F7B801", "#F18701", "#E94F37"]),
  preset("clay-workshop", "Claymation Workshop", "handmade stop-motion clay forms", "quirky and inventive", "a goggled tinkering inventor", ["#F6E7CB", "#D67D4B", "#7BB7A4", "#5B4B8A", "#342E37"]),
  preset("arcade", "8-Bit Arcade", "pixel-art sprites and crisp CRT shapes", "playful and retro", "a pixel robot quizmaster", ["#111827", "#22C55E", "#FACC15", "#38BDF8", "#F472B6"]),
  preset("paper-theater", "Paper Cut-Out Theater", "construction-paper collage", "whimsical and storybook", "a paper-puppet narrator", ["#F4E4C1", "#D95D39", "#5B8E7D", "#E6B655", "#2F4858"]),
  preset("gouache", "Storybook Gouache", "flat gouache shapes with restrained texture", "calm and curious", "a wise animal librarian", ["#F8F0DF", "#7798AB", "#C9B458", "#CE796B", "#384B3F"]),
  preset("noir", "Noir Detective Toon", "high-contrast cartoon noir", "moody, witty, and classroom-safe", "a trench-coated animal gumshoe", ["#161A1D", "#D4C5A9", "#657B83", "#B9504E", "#E6B450"]),
];

export const defaultTheme = showThemePresets[0];

export function getPresetTheme(id: string) {
  return showThemePresets.find((theme) => theme.id === id) ?? defaultTheme;
}
