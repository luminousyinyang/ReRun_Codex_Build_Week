import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { demoEpisode, episodeBaseSchema, episodeSchema, type EpisodeSpec } from "@/lib/episode";

const MAX_CHARS = 12_000;

function cleanTitle(value: string) {
  return value.replace(/[^a-zA-Z0-9 ,:;'-]/g, "").trim().slice(0, 62) || "Your Study Session";
}

function episodeFromLiveNotes(title: string): EpisodeSpec {
  const episode = structuredClone(demoEpisode);
  episode.episodeId = `live-${Date.now()}`;
  episode.courseId = "live-notes";
  episode.title = `${title}: The Retrieval Broadcast`;
  episode.scenes[0].recap![0].prompt = "Type one key term from your material to prime the episode:";
  episode.scenes[0].recap![0].answers = ["study"];
  episode.scenes[1].line = "Your notes are on air. We start by turning one important idea into an active question.";
  return episodeSchema.parse(episode);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 80) return NextResponse.json({ error: "Please provide at least 80 characters of study material." }, { status: 400 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: `Keep live input under ${MAX_CHARS.toLocaleString()} characters for this Build Week prototype.` }, { status: 413 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Live generation is not configured on this deployment." }, { status: 503 });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: [
        {
          role: "system",
          content: "You are ReRun's classroom-safe showrunner. Turn only the supplied educational study material into one EpisodeSpec v1 JSON object. Follow the schema exactly. Use CH 03 and toon only. Include recap, narrative, at least two MCQ beats plus plausible misconception branches, a commercial review, and a cliffhanger. Questions must be answerable from supplied material; incorrect branches must be supportive and factually corrective. No real people, copyrighted characters, unsafe content, markdown, or claims beyond the source.",
        },
        { role: "user", content: text },
      ],
      text: { format: zodTextFormat(episodeBaseSchema, "rerun_episode") },
    });
    const episode = response.output_parsed ? episodeSchema.parse(response.output_parsed) : episodeFromLiveNotes(cleanTitle(text.split(/\n|\.|!|\?/)[0]));
    return NextResponse.json({ episode, generatedWith: "GPT-5.6" });
  } catch (error) {
    console.error("episode-generation-failed", error instanceof Error ? error.message : "unknown-error");
    return NextResponse.json({ error: "The live episode could not be generated right now." }, { status: 502 });
  }
}
