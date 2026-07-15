import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { demoEpisode, episodeBaseSchema, episodeSchema, type EpisodeSpec } from "@/lib/episode";
import { defaultTheme, getPresetTheme, normalizeCustomVoiceDirection, showThemeSchema, themeInputSchema, type ShowTheme } from "@/lib/theme";

const MAX_CHARS = 12_000;

function cleanTitle(value: string) {
  return value.replace(/[^a-zA-Z0-9 ,:;'-]/g, "").trim().slice(0, 62) || "Your Study Session";
}

function episodeFromLiveNotes(title: string, theme: ShowTheme): EpisodeSpec {
  const episode = structuredClone(demoEpisode);
  episode.episodeId = `live-${Date.now()}`;
  episode.courseId = "live-notes";
  episode.title = `${title}: The Retrieval Broadcast`;
  episode.theme = theme;
  episode.cast[0].persona = theme.hostPersona;
  episode.scenes[0].recap![0].prompt = "Type one key term from your material to prime the episode:";
  episode.scenes[0].recap![0].answers = ["study"];
  episode.scenes[1].line = "Your notes are on air. We start by turning one important idea into an active question.";
  return episodeSchema.parse(episode);
}

const ipTerms = /\b(family guy|disney|pixar|marvel|star wars|pokemon|simpsons|south park|studio ghibli|dreamworks)\b/gi;

async function resolveTheme(client: OpenAI, input: unknown): Promise<{ theme: ShowTheme; notice?: string }> {
  const parsed = themeInputSchema.safeParse(input ?? { kind: "preset", id: defaultTheme.id });
  if (!parsed.success) throw new Error("Choose a preset theme or describe a short original-show vibe.");
  if (parsed.data.kind === "preset") return { theme: getPresetTheme(parsed.data.id) };

  const blockedTerms = Array.from(new Set(parsed.data.vibe.match(ipTerms) ?? []));
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.6",
    input: [
      { role: "system", content: "Turn a requested show vibe into an original, classroom-safe visual theme. Keep only genre, medium, era, palette, tone, and generic host archetype. Remove show, studio, brand, character, artist, and real-person references. Never imitate a named work. Return the ShowTheme schema exactly; choose origin custom; supply adjective-only prompt text; set safety sanitized true, moderationPassed true, and list stripped terms in blockedTerms." },
      { role: "user", content: parsed.data.vibe },
    ],
    text: { format: zodTextFormat(showThemeSchema, "rerun_theme") },
  });
  const draft = response.output_parsed ? showThemeSchema.parse(response.output_parsed) : null;
  if (!draft) throw new Error("The custom show vibe could not be normalized.");
  const moderation = await client.moderations.create({ model: "omni-moderation-latest", input: JSON.stringify(draft.promptFragments) });
  if (moderation.results.some((result) => result.flagged)) throw new Error("Choose a different original show description, or use a preset theme.");
  const theme = showThemeSchema.parse({
    ...draft,
    id: `custom-${Date.now()}`,
    origin: "custom",
    ...normalizeCustomVoiceDirection(draft),
    safety: { sanitized: true, moderationPassed: true, blockedTerms: Array.from(new Set([...blockedTerms, ...draft.safety.blockedTerms])) },
  });
  return { theme, notice: blockedTerms.length ? `We made your own original show and removed: ${blockedTerms.join(", ")}.` : `Your original show, ${theme.name}, is ready for air.` };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 80) return NextResponse.json({ error: "Please provide at least 80 characters of study material." }, { status: 400 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: `Keep live input under ${MAX_CHARS.toLocaleString()} characters for this Build Week prototype.` }, { status: 413 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Live generation is not configured on this deployment." }, { status: 503 });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { theme, notice } = await resolveTheme(client, body?.themeInput);
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: [
        {
          role: "system",
          content: `You are ReRun's classroom-safe showrunner. Turn only the supplied educational study material into one EpisodeSpec v1 JSON object. Follow the schema exactly. Use CH 03 and toon only. Include recap, narrative, at least two MCQ beats plus plausible misconception branches, a commercial review, and a cliffhanger. Questions must be answerable from supplied material; incorrect branches must be supportive and factually corrective. No real people, copyrighted characters, unsafe content, markdown, or claims beyond the source. Theme direction: ${theme.promptFragments.episodeStyleLine} Host persona: ${theme.hostPersona}.`,
        },
        { role: "user", content: text },
      ],
      text: { format: zodTextFormat(episodeBaseSchema, "rerun_episode") },
    });
    const rawEpisode = response.output_parsed ? episodeSchema.parse(response.output_parsed) : episodeFromLiveNotes(cleanTitle(text.split(/\n|\.|!|\?/)[0]), theme);
    const episode = episodeSchema.parse({ ...rawEpisode, theme, cast: rawEpisode.cast.map((member, index) => index === 0 ? { ...member, persona: theme.hostPersona } : member) });
    return NextResponse.json({ episode, theme, themeNotice: notice, generatedWith: "GPT-5.6" });
  } catch (error) {
    console.error("episode-generation-failed", error instanceof Error ? error.message : "unknown-error");
    return NextResponse.json({ error: "The live episode could not be generated right now." }, { status: 502 });
  }
}
