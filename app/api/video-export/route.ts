import { execFile as execFileCallback } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFile = promisify(execFileCallback);
const MAX_VIDEO_BYTES = 180 * 1024 * 1024;
const FFMPEG_CANDIDATES = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"];

function ffmpegCommand() {
  const configured = process.env.FFMPEG_PATH?.trim();
  if (configured) return configured;
  return FFMPEG_CANDIDATES.find((candidate) => existsSync(candidate)) ?? "ffmpeg";
}

function originalVideoResponse(bytes: Uint8Array<ArrayBuffer>, video: File) {
  const isMp4 = video.type.includes("mp4");
  const extension = isMp4 ? "mp4" : "webm";
  return new NextResponse(bytes, {
    headers: {
      "content-type": isMp4 ? "video/mp4" : "video/webm",
      "content-disposition": `attachment; filename=rerun-show.${extension}`,
      "cache-control": "no-store",
      "x-rerun-video-format": "source-fallback",
    },
  });
}

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
  const source = new Uint8Array(await video.arrayBuffer());
  try {
    await fs.writeFile(input, source);
    await execFile(ffmpegCommand(), [
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
  } catch (error) {
    // A WebM recorded in the browser is already a valid downloadable video.
    // Returning it keeps export useful on machines without a local ffmpeg
    // binary (and on deployments where native encoders are unavailable).
    console.warn("video-export-falling-back-to-source", error instanceof Error ? error.message : "unknown-error");
    return originalVideoResponse(source, video);
  } finally {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
