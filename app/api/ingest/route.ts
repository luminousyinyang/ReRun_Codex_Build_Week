import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import { MAX_AUDIO_VIDEO_BYTES, MAX_STUDY_CHARS, MAX_UPLOAD_FILES, MIN_STUDY_CHARS } from "@/lib/limits";

export const runtime = "nodejs";
export const maxDuration = 120;

const PLAIN = /\.(txt|md|markdown)$/i;
const DOCUMENT = /\.(pdf|docx|pptx|csv)$/i;
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const AUDIO_VIDEO = /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i;
const MOV = /\.mov$/i;

class IngestError extends Error {}

function extension(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function dataUrl(file: File) {
  return file.arrayBuffer().then((buffer) => `data:${file.type || "application/octet-stream"};base64,${Buffer.from(buffer).toString("base64")}`);
}

async function extractWithResponses(client: OpenAI, file: File, kind: "document" | "image") {
  const instruction = kind === "image"
    ? "Read this study image carefully. Transcribe every legible educational detail, including labels, definitions, formulas, examples, and diagrams in concise plain text."
    : "Extract the educational study material from this file. Preserve distinct concepts, definitions, formulas, examples, labels, and relationships in concise plain text.";
  const content = kind === "image"
    ? [{ type: "input_text", text: instruction }, { type: "input_image", image_url: await dataUrl(file), detail: "high" }]
    : [{ type: "input_text", text: instruction }, { type: "input_file", filename: file.name, file_data: await dataUrl(file) }];
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6",
    input: [{ role: "user", content }],
  } as never);
  return response.output_text.trim();
}

async function extractFile(client: OpenAI | null, file: File) {
  if (!file.name) throw new IngestError("One uploaded file is missing a filename.");
  if (MOV.test(file.name)) throw new IngestError(`${file.name}: .mov isn't supported — export it as mp4 or webm first.`);
  if (PLAIN.test(file.name)) return file.text();
  if (AUDIO_VIDEO.test(file.name)) {
    if (file.size > MAX_AUDIO_VIDEO_BYTES) throw new IngestError(`${file.name}: recordings must be under 25 MB — trim it or export audio only.`);
    if (!client) throw new IngestError("Reading recordings needs a live API key. Paste a transcript instead.");
    const transcription = await client.audio.transcriptions.create({
      file: await toFile(Buffer.from(await file.arrayBuffer()), file.name, { type: file.type || undefined }),
      model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    });
    return transcription.text.trim();
  }
  if (DOCUMENT.test(file.name) || IMAGE.test(file.name)) {
    if (!client) throw new IngestError("Reading PDFs, slides, and photos needs a live API key. Paste text notes instead.");
    return extractWithResponses(client, file, IMAGE.test(file.name) ? "image" : "document");
  }
  throw new IngestError(`${file.name}: supported files are PDF, slides, documents, photos, audio, video, and plain text.`);
}

async function condense(client: OpenAI | null, text: string) {
  if (text.length <= MAX_STUDY_CHARS) return { text, condensed: false };
  if (!client) return { text: text.slice(0, MAX_STUDY_CHARS), condensed: false, notice: "The pasted material was trimmed to 12,000 characters." };
  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: `Condense these study notes to at most ${MAX_STUDY_CHARS} characters. Keep every distinct concept, definition, formula, example, and relationship. Write plain study notes only.\n\n${text}`,
    });
    return { text: response.output_text.trim().slice(0, MAX_STUDY_CHARS), condensed: true };
  } catch {
    return { text: text.slice(0, MAX_STUDY_CHARS), condensed: false, notice: "The material was trimmed to 12,000 characters when condensation was unavailable." };
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) throw new IngestError("Add at least one file to read.");
    if (files.length > MAX_UPLOAD_FILES) throw new IngestError(`Add up to ${MAX_UPLOAD_FILES} files at a time.`);
    const needsApi = files.some((file) => !PLAIN.test(file.name));
    const client = needsApi && process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    const extracted = await Promise.all(files.map(async (file) => ({ name: file.name, text: await extractFile(client, file) })));
    const joined = extracted.map(({ name, text }) => `# ${name}\n${text.trim()}`).filter((entry) => entry.length > 4).join("\n\n").trim();
    if (joined.length < MIN_STUDY_CHARS) throw new IngestError("Those files didn't contain enough readable study material. Add notes or a clearer recording.");
    const result = await condense(client, joined);
    if (result.text.length < MIN_STUDY_CHARS) throw new IngestError("Those files didn't contain enough readable study material. Add notes or a clearer recording.");
    return NextResponse.json({ sourceText: result.text, manifest: extracted.map(({ name, text }) => ({ name, characters: text.length })), condensed: result.condensed, notice: result.notice });
  } catch (error) {
    if (error instanceof IngestError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("ingest-failed", error instanceof Error ? error.message : "unknown-error");
    return NextResponse.json({ error: "We couldn't read that file right now. Paste text notes instead." }, { status: 502 });
  }
}
