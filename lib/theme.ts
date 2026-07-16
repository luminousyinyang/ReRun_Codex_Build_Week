import { z } from "zod";

/** Built-in Speech API voices supported by the configured gpt-4o-mini-tts route. */
export const supportedTtsVoices = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

export const ttsVoiceSchema = z.enum(supportedTtsVoices);
export type TtsVoice = z.infer<typeof ttsVoiceSchema>;

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
  voice: ttsVoiceSchema,
  voiceInstruction: z.string().min(1).max(600),
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

const exclusions = "No real people, named shows, studios, brands, characters, logos, text, readable or pseudo-text, glyphs, letterforms, labels, watermarks, signatures, photorealism, 3D render, CGI, gradients, airbrushed blends, visible brush strokes, or hyperdetail.";

function preset(
  id: string,
  name: string,
  medium: string,
  tone: string,
  hostPersona: string,
  palette: string[],
  voice: TtsVoice,
  voiceInstruction: string,
): ShowTheme {
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
    voice,
    voiceInstruction,
    promptFragments: {
      episodeStyleLine: `Original ${name} educational show: ${tone}; ${hostPersona}.`,
      imageStylePrefix: `Original 2D animated educational background in ${medium}; ${descriptors.join(", ")}; limited palette ${palette.join(", ")}; no characters; leave lower-left open for the host and center-right open for captions.`,
      exclusions,
    },
    safety: { sanitized: true, blockedTerms: [], moderationPassed: true },
  };
}

export const showThemePresets: ShowTheme[] = [
  preset("retro-sci-fi", "Retro Sci-Fi Broadcast", "retro-futurist flat cel art with halftone accents", "dry, curious, and PG", "a deadpan android news anchor", ["#10233F", "#3E8A8C", "#F5E9CE", "#E0A24B", "#D65A4A"], "cedar", "Deliver a measured, dryly curious retro-future broadcast. Keep the deadpan anchor confident, crisp, and classroom-clear; add small pauses for discovery, never robotic distortion."),
  preset("suburban-primetime", "Suburban Primetime", "flat vector cartoon art with thick outlines", "wry, gently satirical, and PG", "a frazzled know-it-all suburban dad-narrator", ["#F7D7A8", "#4B89B4", "#F1AA4B", "#D65A4A", "#2A2E45"], "coral", "Sound like a quick-thinking neighborhood host keeping a busy lesson on track. Use warm, wry energy and conversational emphasis, while making every factual point unhurried and easy to follow."),
  preset("cozy-preschool", "Cozy Preschool Corner", "soft crayon and felt-cutout art", "warm and encouraging", "a cheerful tortoise mentor in a cardigan", ["#F5E9CE", "#8BBF9F", "#F3B96B", "#8CB8D8", "#56413A"], "sage", "Speak slowly and reassuringly like a patient story-time mentor. Celebrate curiosity, soften corrections, and leave clean pauses after key ideas for a learner to think."),
  preset("power-squad", "Saturday-Morning Power Squad", "bold cel animation with graphic action lines", "heroic and high-energy", "a color-coded team captain", ["#14213D", "#FCA311", "#E63946", "#4CC9F0", "#F1FAEE"], "marin", "Lead with bright team-captain momentum and bold, uplifting emphasis. Keep the pace energetic but articulate, especially when introducing a question or correcting a misconception."),
  preset("neon-quest", "Neon Anime Quest", "original expressive anime-inspired line art", "adventurous and heartfelt", "a determined young explorer", ["#15152B", "#55DDE0", "#F7B801", "#F18701", "#E94F37"], "ballad", "Perform an earnest original adventure serial: focused, hopeful, and emotionally present. Build gentle suspense before questions, then explain scientific details with calm precision."),
  preset("clay-workshop", "Claymation Workshop", "handmade stop-motion clay forms", "quirky and inventive", "a goggled tinkering inventor", ["#F6E7CB", "#D67D4B", "#7BB7A4", "#5B4B8A", "#342E37"], "fable", "Use an inventive workshop-host voice with playful surprise and tactile enthusiasm. Make experiments sound approachable, but slow down for definitions and the final answer."),
  preset("arcade", "8-Bit Arcade", "pixel-art sprites and crisp CRT shapes", "playful and retro", "a pixel robot quizmaster", ["#111827", "#22C55E", "#FACC15", "#38BDF8", "#F472B6"], "ash", "Announce the lesson like a friendly arcade challenge: precise, playful, and lightly rhythmic. Give each choice a clean beat, but avoid synthetic sound effects or character imitation."),
  preset("paper-theater", "Paper Cut-Out Theater", "construction-paper collage", "whimsical and storybook", "a paper-puppet narrator", ["#F4E4C1", "#D95D39", "#5B8E7D", "#E6B655", "#2F4858"], "shimmer", "Tell the lesson with a gentle handmade-theater cadence: whimsical, expressive, and easy to understand. Treat each concept as a small story turn, then land the explanation plainly."),
  preset("gouache", "Storybook Gouache", "flat gouache shapes with restrained texture", "calm and curious", "a wise animal librarian", ["#F8F0DF", "#7798AB", "#C9B458", "#CE796B", "#384B3F"], "nova", "Use a calm librarian-guide delivery with quiet wonder and careful diction. Let important terms breathe, and make corrections feel like a helpful new chapter rather than a scolding."),
  preset("noir", "Noir Detective Toon", "high-contrast cartoon noir", "moody, witty, and classroom-safe", "a trench-coated animal gumshoe", ["#161A1D", "#D4C5A9", "#657B83", "#B9504E", "#E6B450"], "onyx", "Deliver an original classroom-safe mystery narration: low-key, observant, and lightly witty. Keep clues and scientific explanations intelligible; never become threatening, grim, or impersonate a known detective."),
];

export const defaultTheme = showThemePresets[0];

const naturalNarrationFallback = showThemePresets.find((theme) => theme.id === "suburban-primetime")!;

export function getPresetTheme(id: string) {
  return showThemePresets.find((theme) => theme.id === id) ?? defaultTheme;
}

/** Saved shows from before themed narration may not carry a theme at all. Do
 * not turn those legacy shows into the default android presenter: use a warm,
 * natural host instead. The retro-sci-fi show remains dry and curious, but its
 * narration should still sound human rather than like a voice synthesizer. */
export function narrationThemeFor(theme?: ShowTheme) {
  const resolved = theme ?? naturalNarrationFallback;
  if (resolved.id !== "retro-sci-fi") return resolved;
  return {
    ...resolved,
    voice: "coral" as const,
    voiceInstruction: "Deliver a warm, natural human retro-future broadcast. Sound dryly curious and confident, with clear classroom pacing and small pauses for discovery. Never sound robotic, synthetic, monotone, or digitally distorted.",
  };
}

/**
 * Custom themes can choose only an approved built-in voice. The direction is
 * compiled from their normalized show metadata instead of trusting arbitrary
 * user-authored instructions.
 */
export function normalizeCustomVoiceDirection(theme: Pick<ShowTheme, "voice" | "tone" | "era" | "hostPersona">) {
  return {
    voice: theme.voice,
    voiceInstruction: `Perform as ${theme.hostPersona} in an original ${theme.era}. Keep the delivery ${theme.tone}. Speak clearly at a measured educational-show pace, use supportive emphasis for questions and corrections, and do not imitate any real person or named character.`,
  };
}
