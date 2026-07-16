import { afterEach, describe, expect, it, vi } from "vitest";

const execFile = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({ execFile }));

import { POST } from "@/app/api/video-export/route";

afterEach(() => {
  delete process.env.FFMPEG_PATH;
  vi.clearAllMocks();
});

describe("POST /api/video-export", () => {
  it("returns the browser-recorded WebM when a local encoder is unavailable", async () => {
    process.env.FFMPEG_PATH = "/not-installed/ffmpeg";
    execFile.mockImplementation((_command: string, _args: string[], _options: unknown, callback: (error: Error) => void) => callback(Object.assign(new Error("not found"), { code: "ENOENT" })));
    const form = new FormData();
    form.append("video", new File(["recorded-webm"], "broadcast.webm", { type: "video/webm" }));

    const response = await POST(new Request("http://localhost/api/video-export", { method: "POST", body: form }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/webm");
    expect(response.headers.get("x-rerun-video-format")).toBe("source-fallback");
    expect(await response.text()).toBe("recorded-webm");
  });
});
