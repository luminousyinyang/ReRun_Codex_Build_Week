import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ttsVoiceSchema } from "@/lib/theme";

const inputSchema = z.object({
  text: z.string().trim().min(1).max(4_096),
  voice: ttsVoiceSchema.optional(),
  instructions: z.string().trim().max(600).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A short narration line is required." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Narration is unavailable in demo mode." }, { status: 503 });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await client.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: parsed.data.voice || "coral",
      instructions: parsed.data.instructions || "Speak clearly, warmly, and at a measured educational-show pace.",
      input: parsed.data.text,
      response_format: "mp3",
    });
    return new Response(speech.body, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("tts-generation-failed", error instanceof Error ? error.message : "unknown-error");
    return NextResponse.json({ error: "Narration could not be generated right now." }, { status: 502 });
  }
}
