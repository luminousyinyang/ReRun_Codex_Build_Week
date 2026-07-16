import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFile = promisify(execFileCallback);
const MAX_VIDEO_BYTES = 180 * 1024 * 1024;

/** Browsers create the canvas capture as WebM reliably. ffmpeg performs the
 * final local H.264/AAC transcode so the learner receives a QuickTime-ready
 * MP4 instead of Safari's malformed browser-recorded MP4. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const video = form?.get("video");
  if (!(video instanceof File) || !video.size) return NextResponse.json({ error: "A rendered WebM video is required." }, { status: 400 });
  if (video.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "This video is too large to encode locally." }, { status: 413 });

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rerun-video-"));
  const input = path.join(directory, "broadcast.webm");
  const output = path.join(directory, "broadcast.mp4");
  try {
    await fs.writeFile(input, Buffer.from(await video.arrayBuffer()));
    await execFile("/opt/homebrew/bin/ffmpeg", [
      "-y", "-i", input,
      "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output,
    ], { maxBuffer: 1_000_000 });
    const encoded = await fs.readFile(output);
    return new NextResponse(encoded, {
      headers: {
        "content-type": "video/mp4",
        "content-disposition": "attachment; filename=rerun-show.mp4",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "The MP4 encoder could not finish this show." }, { status: 500 });
  } finally {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
