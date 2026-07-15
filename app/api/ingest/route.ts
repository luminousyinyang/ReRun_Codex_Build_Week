import { NextResponse } from "next/server";

const MAX_CHARS = 12_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 80) return NextResponse.json({ error: "Please provide at least 80 characters of study material." }, { status: 400 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: `Keep live input under ${MAX_CHARS.toLocaleString()} characters for this Build Week prototype.` }, { status: 413 });
  return NextResponse.json({ sourceText: text, titleHint: text.split(/\n|\.|!|\?/)[0].slice(0, 72) });
}
