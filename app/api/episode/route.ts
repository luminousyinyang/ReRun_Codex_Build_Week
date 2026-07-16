import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { episodeResponseSchema, episodeSchema, validateLiveEpisode } from "@/lib/episode";
import { defaultTheme, getPresetTheme, normalizeCustomVoiceDirection, showThemeSchema, themeInputSchema, type ShowTheme } from "@/lib/theme";

const MAX_CHARS = 12_000;

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
          content: `You are ReRun's classroom-safe showrunner. Turn only the supplied educational study material into one EpisodeSpec v1 JSON object. Follow the schema exactly. Use CH 03 and toon only.

Produce a tight three-act episode of about 14 to 18 scenes: one opening recap, one short narrative setup per act, and one terminal cliffhanger. Teach exactly three learning objectives drawn from the source. Include at least three primary MCQ beats and a final cumulative MCQ that integrates all three objectives. Questions must be answerable from supplied material. Do not include a commercial break, and do not add filler transition scenes that merely restate what was just said.

Teach each concept in full the FIRST time you assess it: attach 3–5 short teach steps to that same scene. Each step has one idea and a role of hook, define, analogy, example, contrast, or recap; use onScreen for durable terms or formulas. The player presents these steps before the question. A later MCQ that only re-tests an already-taught concept must NOT repeat the teaching — give a brief cue and go straight to the question. teachesConcepts must name every objective key in reviewsConcepts. The scene's line is a short instructional summary or transition, not game-show patter; deepDive adds mechanism, simpler uses a genuinely different analogy, and simplerAgain gives the smallest accurate model. All four must be materially different. If assessmentKind is compute, include at least three workedExample steps before the question, including an example with a formula and values DIFFERENT from the values in the assessed question. Refutations reinforce instruction already provided; they must never be the learner's first explanation.

Every MCQ beat must include a genuinely easier, differently worded simplerQuestion; an integer difficulty from 1 through 5; and reviewsConcepts containing only this episode's learning-objective concept keys. Every incorrect route must go to a branch_outcome with a supportive, factual refutation, then route back to that same beat for its simplified retry. Options must have unique ids and distinct answer text, with exactly one correct answer. Every route must resolve to a scene id and the recap must be able to reach the terminal cliffhanger.

Begin with a scene whose id is "recap" and type is "recap". Its one recap prompt must ask the learner to retrieve a specific key term or short phrase from the supplied material, and its answers must include that exact source term or phrase; never use generic answers such as "study", "notes", or "material". All teaching fields must stay grounded in the supplied material. No real people, copyrighted characters, unsafe content, markdown, or claims beyond the source. Theme direction: ${theme.promptFragments.episodeStyleLine} Host persona: ${theme.hostPersona}.`,
        },
        { role: "user", content: text },
      ],
      text: { format: zodTextFormat(episodeResponseSchema, "rerun_episode") },
    });
    if (!response.output_parsed) throw new Error("Live generation returned no structured episode.");
    const rawEpisode = validateLiveEpisode(response.output_parsed, text);
    const episode = episodeSchema.parse({ ...rawEpisode, theme, cast: rawEpisode.cast.map((member, index) => index === 0 ? { ...member, persona: theme.hostPersona } : member) });
    return NextResponse.json({ episode, theme, themeNotice: notice, generatedWith: "GPT-5.6" });
  } catch (error) {
    console.error("episode-generation-failed", error instanceof Error ? error.message : "unknown-error");
    return NextResponse.json({ error: "The live episode could not be generated right now." }, { status: 502 });
  }
}
