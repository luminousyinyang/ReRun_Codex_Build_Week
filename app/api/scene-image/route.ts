import { createHash } from "node:crypto";
import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import { buildSceneArtPrompt, makeSceneArtKey, sceneArtRequestSchema } from "@/lib/scene-art";

const MAX_CACHE_ENTRIES = 32;
const completed = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
const encoder = new TextEncoder();

function event(name: "preview" | "final" | "error", payload: Record<string, string>) {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function remember(key: string, value: string) {
  completed.delete(key);
  completed.set(key, value);
  if (completed.size > MAX_CACHE_ENTRIES) completed.delete(completed.keys().next().value as string);
}

function keyFor(request: Parameters<typeof makeSceneArtKey>[0]) {
  return createHash("sha256").update(makeSceneArtKey(request)).digest("hex");
}

async function referenceFile(dataUrl?: string) {
  if (!dataUrl) return undefined;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid style reference");
  return toFile(Buffer.from(match[2], "base64"), "style-reference.jpg", { type: `image/${match[1]}` });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = sceneArtRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A validated scene and safe theme are required." }, { status: 400 });
  const payload = parsed.data;
  if (!payload.theme.safety.sanitized || !payload.theme.safety.moderationPassed) {
    return NextResponse.json({ error: "Use a sanitized original show theme before requesting artwork." }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Live artwork is unavailable in demo mode." }, { status: 503 });

  const key = keyFor(payload);
  const cached = completed.get(key);
  if (cached) {
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(event("final", { key, dataUrl: cached })); controller.close(); } }), {
      headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (name: "preview" | "final" | "error", data: Record<string, string>) => controller.enqueue(event(name, { key, ...data }));
      let rejectFlight: ((reason: unknown) => void) | undefined;
      try {
        const pending = inFlight.get(key);
        if (pending) {
          send("preview", { message: "Using the in-progress scene render…" });
          send("final", { dataUrl: await pending });
          return;
        }

        let resolveFinal!: (value: string) => void;
        const finalPromise = new Promise<string>((resolve, reject) => { resolveFinal = resolve; rejectFlight = reject; });
        void finalPromise.catch(() => undefined);
        inFlight.set(key, finalPromise);
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const prompt = buildSceneArtPrompt(payload.scene, payload.theme);
        const reference = await referenceFile(payload.referenceDataUrl);
        const imageStream = reference
          ? await client.images.edit({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", image: reference, prompt: `${prompt} Match the reference image's palette and linework.`, quality: "low", size: "1536x1024", output_format: "jpeg", output_compression: 78, stream: true, partial_images: 2 })
          : await client.images.generate({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", prompt, quality: "low", size: "1536x1024", output_format: "jpeg", output_compression: 78, stream: true, partial_images: 2 });

        for await (const item of imageStream) {
          const dataUrl = `data:image/jpeg;base64,${item.b64_json}`;
          if (item.type.endsWith("partial_image")) send("preview", { dataUrl });
          else {
            remember(key, dataUrl);
            resolveFinal(dataUrl);
            send("final", { dataUrl });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Artwork could not be generated.";
        rejectFlight?.(error);
        send("error", { message });
      } finally {
        inFlight.delete(key);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" } });
}
