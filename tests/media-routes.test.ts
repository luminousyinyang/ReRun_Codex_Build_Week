import { afterEach, describe, expect, it, vi } from "vitest";
import { demoEpisode } from "@/lib/episode";
import { defaultTheme } from "@/lib/theme";

const { imageGenerate, imageEdit, speechCreate, toFile } = vi.hoisted(() => ({
  imageGenerate: vi.fn(),
  imageEdit: vi.fn(),
  speechCreate: vi.fn(),
  toFile: vi.fn(),
}));

vi.mock("openai", () => {
  class OpenAI {
    audio = { speech: { create: speechCreate } };
    images = { generate: imageGenerate, edit: imageEdit };
  }

  return { default: OpenAI, toFile };
});

import { POST as ttsPost } from "@/app/api/tts/route";
import { POST as sceneImagePost } from "@/app/api/scene-image/route";

const encoder = new TextEncoder();
let sceneNumber = 0;

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validScenePayload() {
  const scene = demoEpisode.scenes[0];
  sceneNumber += 1;
  return {
    scene: { id: `${scene.id}-test-${sceneNumber}`, type: scene.type, background: scene.background },
    theme: defaultTheme,
  };
}

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_TTS_MODEL;
  delete process.env.OPENAI_IMAGE_MODEL;
  vi.clearAllMocks();
});

describe("POST /api/tts", () => {
  it("rejects invalid narration input before trying the provider", async () => {
    const response = await ttsPost(jsonRequest("http://localhost/api/tts", { text: "   " }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "A short narration line is required." });
    expect(speechCreate).not.toHaveBeenCalled();
  });

  it("keeps the zero-key demo on its local narration fallback", async () => {
    const response = await ttsPost(jsonRequest("http://localhost/api/tts", { text: "Photosynthesis starts with sunlight." }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Narration is unavailable in demo mode." });
    expect(speechCreate).not.toHaveBeenCalled();
  });

  it("streams MP3 audio with the configured model when a key is available", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_TTS_MODEL = "test-voice-model";
    speechCreate.mockResolvedValue({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("fake-mp3"));
          controller.close();
        },
      }),
    });

    const response = await ttsPost(jsonRequest("http://localhost/api/tts", {
      text: "  Chlorophyll catches the sunlight.  ",
      voice: "sage",
      instructions: "Friendly and clear.",
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(await response.text()).toBe("fake-mp3");
    expect(speechCreate).toHaveBeenCalledWith({
      model: "test-voice-model",
      voice: "sage",
      instructions: "Friendly and clear.",
      input: "Chlorophyll catches the sunlight.",
      response_format: "mp3",
    });
  });
});

describe("POST /api/scene-image", () => {
  it("rejects unsafe themes and remains available without OpenAI in demo mode", async () => {
    const unsafe = validScenePayload();
    unsafe.theme = { ...unsafe.theme, safety: { sanitized: false, blockedTerms: ["named show"], moderationPassed: false } };
    const unsafeResponse = await sceneImagePost(jsonRequest("http://localhost/api/scene-image", unsafe));
    const noKeyResponse = await sceneImagePost(jsonRequest("http://localhost/api/scene-image", validScenePayload()));

    expect(unsafeResponse.status).toBe(400);
    await expect(unsafeResponse.json()).resolves.toEqual({ error: "Use a sanitized original show theme before requesting artwork." });
    expect(noKeyResponse.status).toBe(503);
    await expect(noKeyResponse.json()).resolves.toEqual({ error: "Live artwork is unavailable in demo mode." });
    expect(imageGenerate).not.toHaveBeenCalled();
  });

  it("de-duplicates concurrent requests and serves the completed JPEG from its session cache", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    let releaseFinal!: () => void;
    const finalReady = new Promise<void>((resolve) => { releaseFinal = resolve; });
    imageGenerate.mockImplementation(() => ({
      async *[Symbol.asyncIterator]() {
        yield { type: "image_generation.partial_image", b64_json: "preview-data" };
        await finalReady;
        yield { type: "image_generation.completed", b64_json: "final-data" };
      },
    }));

    const payload = validScenePayload();
    const first = await sceneImagePost(jsonRequest("http://localhost/api/scene-image", payload));
    expect(imageGenerate).toHaveBeenCalledTimes(1);
    const second = await sceneImagePost(jsonRequest("http://localhost/api/scene-image", payload));
    releaseFinal();

    const [firstEvents, secondEvents] = await Promise.all([first.text(), second.text()]);
    const cached = await sceneImagePost(jsonRequest("http://localhost/api/scene-image", payload));
    const cachedEvents = await cached.text();

    expect(imageGenerate).toHaveBeenCalledTimes(1);
    expect(firstEvents).toContain("event: preview");
    expect(firstEvents).toContain("data:image/jpeg;base64,final-data");
    expect(secondEvents).toContain("Using the in-progress scene render");
    expect(secondEvents).toContain("data:image/jpeg;base64,final-data");
    expect(cachedEvents).toContain("event: final");
    expect(cachedEvents).toContain("data:image/jpeg;base64,final-data");
    expect(cachedEvents).not.toContain("event: preview");
  });
});
