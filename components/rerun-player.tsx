"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { demoEpisode, demoShows, episodeSchema, type DemoShow, type EpisodeSpec, type Scene } from "@/lib/episode";
import { SceneIllustration } from "@/components/scene-illustration";
import { defaultTheme, showThemePresets, type ShowTheme, type ThemeInput } from "@/lib/theme";
import { bundledDemoAudioFile } from "@/lib/demo-audio-manifest";
import { MAX_STUDY_CHARS, MIN_STUDY_CHARS } from "@/lib/limits";
import { loadLiveEpisodeArt, saveLiveEpisodeArt } from "@/lib/live-art-cache";

type Screen = "off" | "boot" | "static" | "home" | "ingest" | "standby" | "artwork" | "recap" | "episode" | "guide";
type Narration = "idle" | "loading" | "playing" | "fallback" | "complete";
type NarrationTransport = "audio" | "speech" | "timer" | null;
type PlayerBeat = NonNullable<Scene["beat"]> & {
  /** Optional v1 additions. Kept optional so older live episodes still play. */
  simplerQuestion?: string;
  explanation?: string;
};

type WrongAttempt = {
  count: number;
  correctAnswer: string;
  explanation: string;
};

type StoredEpisode = {
  episode: unknown;
  savedAt: number;
};

type ArtProgress = {
  ready: number;
  total: number;
  failed: number;
};

type AudioBus = {
  context: AudioContext;
  master: GainNode;
  ambient: GainNode;
  interval: number | null;
  oscillators: OscillatorNode[];
};

const GENERATED_EPISODES_CACHE_KEY = "rerun.generated-episodes.v2";
const GENERATED_EPISODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ART_RENDER_CONCURRENCY = 4;
const FILE_ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.pptx,.csv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm";

function channelLabel(channel: number) {
  return `CH ${String(channel).padStart(2, "0")}`;
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function playTone(context: AudioContext, destination: AudioNode, frequency: number, duration: number, gainAmount: number, type: OscillatorType = "sine") {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(gainAmount, context.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration + 0.02);
}

function startAudioBed(current: AudioBus | null, muted: boolean) {
  if (current) return current;
  const context = getAudioContext();
  if (!context) return null;
  const master = context.createGain();
  const ambient = context.createGain();
  master.gain.value = muted ? 0.0001 : 0.34;
  ambient.gain.value = 0.055;
  ambient.connect(master).connect(context.destination);
  const oscillators = [55, 82.4].map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(ambient);
    oscillator.start();
    return oscillator;
  });
  const motif = () => {
    if (context.state === "closed") return;
    [220, 277.18, 329.63].forEach((frequency, index) => window.setTimeout(() => playTone(context, ambient, frequency, 0.32, 0.07), index * 125));
  };
  motif();
  return { context, master, ambient, interval: window.setInterval(motif, 6_800), oscillators };
}

function stopAudioBed(bus: AudioBus | null) {
  if (!bus) return;
  if (bus.interval !== null) window.clearInterval(bus.interval);
  bus.oscillators.forEach((oscillator) => oscillator.stop());
  void bus.context.close();
}

function findScene(episode: EpisodeSpec, id: string) {
  return episode.scenes.find((scene) => scene.id === id) ?? episode.scenes[0];
}

/** Older generated episodes could incorrectly aim a correct answer at their
 * own retry branch. Recover by taking the next non-corrective story scene;
 * new episodes are rejected server-side before this fallback is needed. */
function correctDestination(episode: EpisodeSpec, current: Scene) {
  const requested = current.beat?.onCorrect;
  if (!requested) return current.next ?? current.id;
  const target = episode.scenes.find((candidate) => candidate.id === requested);
  if (target?.type !== "branch_outcome") return target?.id ?? requested;
  const currentIndex = episode.scenes.findIndex((candidate) => candidate.id === current.id);
  return episode.scenes.slice(currentIndex + 1).find((candidate) => candidate.type !== "branch_outcome")?.id
    ?? target.next
    ?? target.id;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Answer options are authored with the correct choice first. Present them in a
 * per-scene deterministic order instead, so the answer isn't always "A" yet a
 * wrong-answer rewind to the same beat never reshuffles the choices.
 */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = items.slice();
  let state = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state + 0x6d2b79f5) | 0;
    let sample = Math.imul(state ^ (state >>> 15), 1 | state);
    sample = (sample + Math.imul(sample ^ (sample >>> 7), 61 | sample)) ^ sample;
    const random = ((sample ^ (sample >>> 14)) >>> 0) / 4294967296;
    const swap = Math.floor(random * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function waitForImage(url: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

async function streamSceneArt(scene: Scene, theme: ShowTheme, onImage: (url: string, isFinal: boolean) => void) {
  const response = await fetch("/api/scene-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scene: { id: scene.id, type: scene.type, background: scene.background, visualMoment: scene.line ?? scene.deepDive ?? "" }, theme }),
  });
  if (!response.ok || !response.body) throw new Error("Scene art unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const packets = buffer.split("\n\n");
    buffer = packets.pop() ?? "";
    for (const packet of packets) {
      const name = /^event: ([^\n]+)/m.exec(packet)?.[1];
      const data = /^data: (.+)$/m.exec(packet)?.[1];
      if (!data) continue;
      const payload = JSON.parse(data) as { dataUrl?: string; message?: string };
      if (name === "error") throw new Error(payload.message ?? "Scene art unavailable");
      // Image partials arrive far sooner than the final high-resolution render.
      // Only use one after the browser has decoded it, so the opening never
      // flashes a broken image while the final render continues in background.
      if (name === "preview" && payload.dataUrl && await waitForImage(payload.dataUrl)) {
        onImage(payload.dataUrl, false);
      }
      if (name === "final" && payload.dataUrl) {
        final = payload.dataUrl;
        onImage(payload.dataUrl, true);
      }
    }
    if (done) break;
  }
  if (!final) throw new Error("Scene art did not finish");
  return final;
}

export function ReRunPlayer() {
  const [screen, setScreen] = useState<Screen>("off");
  const [episode, setEpisode] = useState<EpisodeSpec>(demoEpisode);
  const [sceneId, setSceneId] = useState("recap");
  const [notes, setNotes] = useState("");
  const [recap, setRecap] = useState("");
  const [recapFeedback, setRecapFeedback] = useState("");
  const [recapAttempts, setRecapAttempts] = useState(0);
  const [rewindLevel, setRewindLevel] = useState(0);
  const [ratings, setRatings] = useState<boolean[]>([]);
  const [captions, setCaptions] = useState(true);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [answeringOption, setAnsweringOption] = useState<string | null>(null);
  const [wrongAttempt, setWrongAttempt] = useState<WrongAttempt | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [notice, setNotice] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [fileManifest, setFileManifest] = useState<Array<{ name: string; characters: number }>>([]);
  const [standbyStatus, setStandbyStatus] = useState("Casting your host…");
  const [themeInput, setThemeInput] = useState<ThemeInput>({ kind: "preset", id: defaultTheme.id });
  const [customVibe, setCustomVibe] = useState("");
  const [themeNotice, setThemeNotice] = useState("");
  const [lastPresetTheme, setLastPresetTheme] = useState(defaultTheme.id);
  const [narration, setNarration] = useState<Narration>("idle");
  const [beatRevealed, setBeatRevealed] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [hostReaction, setHostReaction] = useState<"celebrate" | "retry" | null>(null);
  const [visuals, setVisuals] = useState<Record<string, string>>({});
  const [sceneCut, setSceneCut] = useState(false);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [rewindPlayback, setRewindPlayback] = useState(false);
  const [generatedEpisodes, setGeneratedEpisodes] = useState<EpisodeSpec[]>([]);
  const [generatedEpisodesLoaded, setGeneratedEpisodesLoaded] = useState(false);
  const [artProgress, setArtProgress] = useState<ArtProgress>({ ready: 0, total: 0, failed: 0 });
  const visualsRef = useRef<Record<string, string>>({});
  const audioCache = useRef(new Map<string, string>());
  const objectUrls = useRef(new Set<string>());
  const narrationTimer = useRef<number | null>(null);
  const fallbackDeadline = useRef(0);
  const fallbackRemaining = useRef(0);
  const resumeFallback = useRef<(() => void) | null>(null);
  const narrationTransport = useRef<NarrationTransport>(null);
  const speechUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const audioBus = useRef<AudioBus | null>(null);
  const previousSceneId = useRef<string | null>(null);
  const sceneCutTimer = useRef<number | null>(null);
  const autoplayTimer = useRef<number | null>(null);
  const autoplayDeadline = useRef(0);
  const autoplayRemaining = useRef(1_600);
  const preserveRewindForScene = useRef<string | null>(null);
  const skipTeachForScene = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const savedAtByEpisodeId = useRef(new Map<string, number>());

  const scene = useMemo(() => findScene(episode, sceneId), [episode, sceneId]);
  const activeDemoShow = useMemo(() => demoShows.find((show) => show.episode.episodeId === episode.episodeId), [episode.episodeId]);
  const bundledSceneArt = activeDemoShow ? (scene.type === "narrative" || scene.type === "cliffhanger" ? activeDemoShow.art.teaching : activeDemoShow.art.challenge) : undefined;
  const accuracy = ratings.length ? Math.round((ratings.filter(Boolean).length / ratings.length) * 100) : null;
  const lessonUnits = useMemo(() => [
    ...(scene.teach ?? []).map((step) => ({ ...step, phase: "teach" as const })),
    ...(scene.workedExample ?? []).map((step) => ({ ...step, phase: "worked-example" as const })),
    ...(scene.line ? [{ role: "recap" as const, text: scene.line, onScreen: undefined, phase: "summary" as const }] : []),
  ], [scene]);
  const activeLesson = lessonUnits[lessonIndex];
  const rewindLine = rewindLevel >= 2 && scene.simplerAgain ? scene.simplerAgain : scene.simpler;
  const visibleLine = rewindPlayback && rewindLine ? rewindLine : activeLesson?.text;
  const hasMoreLesson = lessonIndex < lessonUnits.length - 1;
  const displayedBeat = scene.beat as PlayerBeat | undefined;
  const displayedOptions = useMemo(
    () => scene.beat ? seededShuffle(scene.beat.options, hashString(`${episode.episodeId}:${scene.id}`)) : [],
    [episode.episodeId, scene.id, scene.beat],
  );
  const displayedQuestion = rewindLevel > 0 && displayedBeat?.simplerQuestion ? displayedBeat.simplerQuestion : displayedBeat?.question;
  const activeTheme = episode.theme ?? defaultTheme;
  const isDemoEpisode = Boolean(activeDemoShow);
  const guideEpisodes = useMemo(() => {
    if (activeDemoShow) {
      const currentIndex = demoShows.findIndex((show) => show.id === activeDemoShow.id);
      return [...demoShows.slice(currentIndex + 1), ...demoShows.slice(0, currentIndex)]
        .map((show) => ({ id: show.id, title: show.title, kind: "demo" as const, show }));
    }
    return generatedEpisodes
      .filter((candidate) => candidate.episodeId !== episode.episodeId)
      .map((candidate) => ({ id: candidate.episodeId, title: candidate.title, kind: "generated" as const, episode: candidate }));
  }, [activeDemoShow, episode.episodeId, generatedEpisodes]);

  useEffect(() => {
    try {
      const cached = JSON.parse(window.localStorage.getItem(GENERATED_EPISODES_CACHE_KEY) ?? window.localStorage.getItem("rerun.generated-episodes.v1") ?? "[]") as unknown;
      if (Array.isArray(cached)) {
        const now = Date.now();
        setGeneratedEpisodes(cached.flatMap((candidate) => {
          const record = candidate && typeof candidate === "object" && "episode" in candidate
            ? candidate as Partial<StoredEpisode>
            : { episode: candidate, savedAt: now };
          const savedAt = typeof record.savedAt === "number" ? record.savedAt : now;
          const parsed = episodeSchema.safeParse(record.episode);
          if (!parsed.success || parsed.data.courseId.startsWith("demo-") || now - savedAt > GENERATED_EPISODE_TTL_MS) return [];
          savedAtByEpisodeId.current.set(parsed.data.episodeId, savedAt);
          return [parsed.data];
        }));
      }
    } catch {
      // A malformed old cache should never prevent the player from opening.
    } finally {
      setGeneratedEpisodesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!generatedEpisodesLoaded) return;
    try {
      const now = Date.now();
      window.localStorage.setItem(GENERATED_EPISODES_CACHE_KEY, JSON.stringify(generatedEpisodes.map((savedEpisode) => ({
        episode: savedEpisode,
        savedAt: savedAtByEpisodeId.current.get(savedEpisode.episodeId) ?? now,
      }))));
    } catch {
      // The episode remains available for this session if browser storage is full.
    }
  }, [generatedEpisodes, generatedEpisodesLoaded]);

  useEffect(() => {
    const skipTeach = skipTeachForScene.current === scene.id;
    setLessonIndex(skipTeach ? Math.max(0, lessonUnits.length - 1) : 0);
    if (skipTeach) skipTeachForScene.current = null;
    setRewindPlayback(false);
    if (preserveRewindForScene.current === scene.id) {
      preserveRewindForScene.current = null;
    } else {
      setRewindLevel(0);
    }
    setBeatRevealed(false);
  }, [scene.id, lessonUnits.length]);

  useEffect(() => {
    if (screen !== "boot") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setScreen("static"), reduceMotion ? 0 : 200);
    return () => window.clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== "static") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playStaticBurst();
    const timer = window.setTimeout(() => setScreen("home"), reduceMotion ? 0 : 360);
    return () => window.clearTimeout(timer);
  }, [screen, muted]);

  useEffect(() => {
    if (screen !== "standby") return;
    const statuses = ["Casting your host…", "Writing Act 2…", "Placing the cliffhanger…", "Tuning the broadcast…"];
    let index = 0;
    setStandbyStatus(statuses[index]);
    const timer = window.setInterval(() => {
      index = (index + 1) % statuses.length;
      setStandbyStatus(statuses[index]);
    }, 2_100);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== "episode") {
      stopAudioBed(audioBus.current);
      audioBus.current = null;
      return;
    }
    audioBus.current = startAudioBed(audioBus.current, muted);
    void audioBus.current?.context.resume();
  }, [screen]);

  useEffect(() => {
    if (audioBus.current) {
      audioBus.current.master.gain.setTargetAtTime(muted ? 0.0001 : 0.34, audioBus.current.context.currentTime, 0.025);
    }
  }, [muted]);

  useEffect(() => {
    if (screen !== "episode") {
      previousSceneId.current = null;
      return;
    }
    if (previousSceneId.current && previousSceneId.current !== sceneId) {
      setSceneCut(true);
      if (!muted && audioBus.current) {
        const { context, master } = audioBus.current;
        playTone(context, master, 880, 0.07, 0.1, "square");
        window.setTimeout(() => playTone(context, master, 390, 0.09, 0.08, "triangle"), 35);
      }
      if (sceneCutTimer.current !== null) window.clearTimeout(sceneCutTimer.current);
      sceneCutTimer.current = window.setTimeout(() => setSceneCut(false), 165);
    }
    previousSceneId.current = sceneId;
  }, [screen, sceneId, muted]);

  useEffect(() => {
    if (screen !== "episode" || !visibleLine) {
      setNarration("idle");
      return;
    }
    let cancelled = false;
    let audio: HTMLAudioElement | null = null;
    let utterance: SpeechSynthesisUtterance | null = null;
    setBeatRevealed(false);
    setNarration("loading");

    const finish = () => {
      if (cancelled) return;
      setNarration("complete");
      if (scene.beat && !rewindPlayback && !hasMoreLesson) {
        setBeatRevealed(true);
      }
    };

    const scheduleFallback = (delay: number) => {
      narrationTransport.current = "timer";
      fallbackRemaining.current = delay;
      fallbackDeadline.current = Date.now() + delay;
      narrationTimer.current = window.setTimeout(finish, delay);
    };
    const useFallback = () => {
      if (cancelled) return;
      setNarration("fallback");
      const dwell = Math.max(1_800, Math.min(7_000, visibleLine.length * 42 + 900));
      resumeFallback.current = () => scheduleFallback(Math.max(200, fallbackRemaining.current));
      scheduleFallback(dwell);
    };

    const useBrowserSpeech = () => {
      if (cancelled || muted || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        useFallback();
        return;
      }
      utterance = new SpeechSynthesisUtterance(visibleLine);
      speechUtterance.current = utterance;
      narrationTransport.current = "speech";
      utterance.lang = "en-US";
      utterance.rate = 0.96;
      utterance.pitch = 0.9;
      utterance.onend = finish;
      utterance.onerror = useFallback;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setNarration("fallback");
    };

    const playNarration = async () => {
      try {
        const cacheKey = `${activeTheme.id}:${visibleLine}`;
        let source = audioCache.current.get(cacheKey);
        if (!source) {
          const isBundledDemo = episode.courseId.startsWith("demo-");
          const bundledFilename = isBundledDemo ? bundledDemoAudioFile(activeTheme.voice, visibleLine) : undefined;
          if (bundledFilename) {
            const bundledSource = `/assets/audio/${bundledFilename}`;
            const bundledResponse = await fetch(bundledSource, { method: "HEAD" });
            if (bundledResponse.ok) source = bundledSource;
          }
          // A demo must be fully local: use its checked-in MP3 when present,
          // otherwise move straight to the browser/silent fallback instead of
          // making a doomed API request in a no-key profile.
          if (!source && isBundledDemo) {
            useBrowserSpeech();
            return;
          }
          if (!source) {
            const response = await fetch("/api/tts", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ text: visibleLine, voice: activeTheme.voice, instructions: activeTheme.voiceInstruction }),
            });
            if (!response.ok) throw new Error("Narration unavailable");
            source = URL.createObjectURL(await response.blob());
            objectUrls.current.add(source);
          }
          audioCache.current.set(cacheKey, source);
        }
        if (cancelled) return;
        audio = new Audio(source);
        narrationTransport.current = "audio";
        audio.muted = muted;
        audio.onended = finish;
        audio.onerror = useBrowserSpeech;
        setAudioElement(audio);
        await audio.play();
        if (!cancelled) setNarration("playing");
      } catch {
        useBrowserSpeech();
      }
    };
    void playNarration();

    return () => {
      cancelled = true;
      if (narrationTimer.current !== null) window.clearTimeout(narrationTimer.current);
      narrationTimer.current = null;
      resumeFallback.current = null;
      narrationTransport.current = null;
      if (audio) {
        audio.onended = null;
        audio.pause();
      }
      if (utterance && speechUtterance.current === utterance) {
        utterance.onend = null;
        utterance.onerror = null;
        window.speechSynthesis.cancel();
        speechUtterance.current = null;
      }
      setAudioElement(null);
    };
  }, [screen, scene.id, visibleLine, activeTheme.id, activeTheme.voice, activeTheme.voiceInstruction, episode.episodeId, muted, rewindPlayback, hasMoreLesson]);

  useEffect(() => {
    if (audioElement) {
      audioElement.muted = muted;
      if (paused) audioElement.pause();
      else if (narration === "playing") void audioElement.play().catch(() => undefined);
    }
    if (narrationTransport.current === "speech" && "speechSynthesis" in window) {
      if (paused) window.speechSynthesis.pause();
      else window.speechSynthesis.resume();
    }
    if (paused && narration === "fallback" && narrationTimer.current !== null) {
      window.clearTimeout(narrationTimer.current);
      narrationTimer.current = null;
      fallbackRemaining.current = Math.max(200, fallbackDeadline.current - Date.now());
    } else if (!paused && narration === "fallback" && narrationTimer.current === null) {
      resumeFallback.current?.();
    }
  }, [audioElement, muted, narration, paused]);

  // Autoplay may move through authored teaching units, but it never crosses an
  // assessment, feedback outcome, commercial answer, or cliffhanger boundary.
  useEffect(() => {
    const canAutoplay = screen === "episode"
      && autoplay
      && !paused
      && narration === "complete"
      && !rewindPlayback
      && (hasMoreLesson || (scene.type === "narrative" && Boolean(scene.next)));

    if (!canAutoplay) {
      if (autoplayTimer.current !== null) window.clearTimeout(autoplayTimer.current);
      autoplayTimer.current = null;
      if (screen !== "episode" || !autoplay || (!hasMoreLesson && scene.type !== "narrative") || narration !== "complete") {
        autoplayRemaining.current = 1_600;
      }
      return;
    }

    const delay = Math.max(0, autoplayRemaining.current);
    autoplayDeadline.current = Date.now() + delay;
    autoplayTimer.current = window.setTimeout(() => {
      autoplayTimer.current = null;
      autoplayRemaining.current = 1_600;
      if (hasMoreLesson) {
        setLessonIndex((current) => current + 1);
      } else if (scene.next) {
        setSceneId(scene.next);
        setRewindLevel(0);
        setBeatRevealed(false);
        setHostReaction(null);
      }
    }, delay);

    return () => {
      if (autoplayTimer.current !== null) {
        window.clearTimeout(autoplayTimer.current);
        autoplayTimer.current = null;
        // React runs this cleanup before the paused effect re-runs, so this
        // captures the exact remainder instead of restarting the 1.6s dwell.
        autoplayRemaining.current = Math.max(0, autoplayDeadline.current - Date.now());
      }
    };
  }, [autoplay, narration, paused, scene.id, scene.next, scene.type, screen, hasMoreLesson, rewindPlayback]);

  // A rewind is a short explanatory detour, not a second transport the learner
  // must operate. Once that narration is over, return to the same beat with
  // its simpler question selected.
  useEffect(() => {
    if (screen !== "episode" || !rewindPlayback || narration !== "complete") return;
    const nextSceneId = findScene(episode, sceneId).next;
    setRewindPlayback(false);
    if (nextSceneId) {
      preserveRewindForScene.current = nextSceneId;
      setSceneId(nextSceneId);
    }
    setPaused(false);
    setBeatRevealed(false);
    setHostReaction(null);
  }, [episode, narration, rewindPlayback, sceneId, screen]);

  useEffect(() => {
    if (!hostReaction || scene.type === "branch_outcome") return;
    const timer = window.setTimeout(() => setHostReaction(null), 900);
    return () => window.clearTimeout(timer);
  }, [hostReaction, scene.id, scene.type]);

  useEffect(() => () => {
    for (const source of objectUrls.current) URL.revokeObjectURL(source);
    stopAudioBed(audioBus.current);
    if (sceneCutTimer.current !== null) window.clearTimeout(sceneCutTimer.current);
  }, []);

  useEffect(() => {
    // A model can author any non-demo courseId. Generated shows are identified
    // by not being one of the bundled demo courses, so fresh art always starts.
    if (episode.courseId.startsWith("demo-") || !episode.theme) return;
    let cancelled = false;
    const candidates = episode.scenes.filter((candidate) => candidate.type !== "recap");
    const savedAt = savedAtByEpisodeId.current.get(episode.episodeId) ?? Date.now();
    const preflight = screen === "artwork";
    const render = async (candidate: Scene) => streamSceneArt(candidate, episode.theme!, (url, isFinal) => {
      if (cancelled) return;
      const nextVisuals = { ...visualsRef.current, [candidate.id]: url };
      visualsRef.current = nextVisuals;
      setVisuals(nextVisuals);
      // Keep only completed art for the seven-day replay cache. A partial is a
      // fast on-screen preview, not an asset we want to restore tomorrow.
      if (isFinal) void saveLiveEpisodeArt(episode.episodeId, candidate.id, savedAt, url).catch(() => undefined);
    });
    void (async () => {
      // Restore completed art before rendering anything. On a replay this keeps
      // the show visually intact immediately and avoids new image API calls.
      const storedVisuals: Record<string, string> = await loadLiveEpisodeArt(episode.episodeId, candidates.map((candidate) => candidate.id), GENERATED_EPISODE_TTL_MS).catch(() => ({}));
      if (cancelled) return;
      visualsRef.current = storedVisuals;
      setVisuals(storedVisuals);
      const cachedSceneIds = new Set(candidates.filter((candidate) => storedVisuals[candidate.id]).map((candidate) => candidate.id));
      setArtProgress({ ready: cachedSceneIds.size, total: candidates.length, failed: 0 });

      let firstFailure: unknown;
      const queue = candidates.filter((candidate) => !storedVisuals[candidate.id]);
      await Promise.all(Array.from({ length: Math.min(ART_RENDER_CONCURRENCY, queue.length) }, async () => {
        while (queue.length) {
          const candidate = queue.shift();
          if (!candidate) continue;
          try {
            await render(candidate);
            if (!cancelled) setArtProgress((current) => ({ ...current, ready: current.ready + 1 }));
          } catch (error) {
            firstFailure ??= error;
            if (!cancelled) setArtProgress((current) => ({ ...current, failed: current.failed + 1 }));
          }
        }
      }));
      if (firstFailure && !cancelled) {
        const detail = firstFailure instanceof Error ? firstFailure.message : "please try this episode again.";
        setNotice(`Some original scene art could not be drawn: ${detail}`);
      }
      if (preflight && !cancelled) setScreen("recap");
    })().catch((error) => {
      if (!cancelled) setNotice(`Original scene art is unavailable: ${error instanceof Error ? error.message : "please try this episode again."}`);
    });
    return () => { cancelled = true; };
  }, [episode]);

  function power() {
    setScreen((current) => current === "off" ? "boot" : "off");
    setNotice("");
  }

  function loadEpisode(nextEpisode: EpisodeSpec, notice: string) {
    setEpisode(nextEpisode);
    setSceneId("recap");
    setRecap("");
    setRecapFeedback("");
    setRecapAttempts(0);
    setRatings([]);
    setRewindLevel(0);
    setAnsweringOption(null);
    setWrongAttempt(null);
    setAnswerRevealed(false);
    setHostReaction(null);
    // A show paused before the learner left it must not carry that pause (and its
    // half-started narration) into the next show they open.
    setPaused(false);
    visualsRef.current = {};
    setVisuals({});
    setArtProgress({ ready: 0, total: nextEpisode.scenes.filter((candidate) => candidate.type !== "recap").length, failed: 0 });
    setThemeNotice("");
    setScreen(nextEpisode.courseId.startsWith("demo-") ? "recap" : "artwork");
    setNotice(notice);
  }

  function goHome() {
    setPaused(false);
    setAnsweringOption(null);
    setAnswerRevealed(false);
    setWrongAttempt(null);
    setHostReaction(null);
    setScreen("home");
  }

  function loadDemo(show: DemoShow = demoShows[0]) {
    loadEpisode(show.episode, `${show.title} loaded. No API key required.`);
  }

  function loadCachedEpisode(cachedEpisode: EpisodeSpec) {
    loadEpisode(cachedEpisode, `${cachedEpisode.title} loaded from your saved episodes.`);
  }

  async function generateEpisode() {
    if (notes.trim().length < MIN_STUDY_CHARS) {
      setNotice("Paste a little more material (at least 80 characters), or load the demo course.");
      return;
    }
    setLiveLoading(true);
    setNotice("");
    setScreen("standby");
    try {
      const selectedTheme = themeInput.kind === "custom" && customVibe.trim().length >= 3
        ? { kind: "custom" as const, vibe: customVibe.trim() }
        : { kind: "preset" as const, id: lastPresetTheme };
      const response = await fetch("/api/episode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: notes, themeInput: selectedTheme }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Episode unavailable");
      setEpisode(result.episode);
      savedAtByEpisodeId.current.set(result.episode.episodeId, Date.now());
      setGeneratedEpisodes((current) => [
        result.episode,
        ...current.filter((candidate) => candidate.episodeId !== result.episode.episodeId),
      ]);
      setThemeNotice(result.themeNotice ?? "");
      visualsRef.current = {};
      setVisuals({});
      setArtProgress({ ready: 0, total: result.episode.scenes.filter((candidate: Scene) => candidate.type !== "recap").length, failed: 0 });
      setSceneId("recap");
      setRecap("");
      setRecapFeedback("");
      setRecapAttempts(0);
      setRatings([]);
      setRewindLevel(0);
      setAnsweringOption(null);
      setWrongAttempt(null);
      setAnswerRevealed(false);
      setHostReaction(null);
      setScreen("artwork");
      setNotice("Your notes are now on air.");
    } catch (error) {
      setScreen("ingest");
      setNotice(`${error instanceof Error ? error.message : "Live generation is unavailable"} Watch the bundled demo instead.`);
    } finally {
      setLiveLoading(false);
    }
  }

  function checkRecap() {
    const answers = scene.recap?.[0]?.answers ?? [];
    const correct = answers.some((answer) => recap.toLowerCase().includes(answer.toLowerCase()));
    if (correct) {
      setRecapFeedback("Correct — roll tape!");
      return;
    }
    setRecapAttempts((attempts) => {
      const next = attempts + 1;
      setRecapFeedback(next >= 2 ? `That one was ${answers[0] ?? "in the episode"}. Keep it in mind as the show begins.` : "Not quite — think back to the last episode and try once more.");
      return next;
    });
  }

  function startEpisode() {
    // This runs directly from the learner's click, preserving browser audio
    // permission for the no-key ambience and the first scene-cut cue.
    audioBus.current = startAudioBed(audioBus.current, muted);
    void audioBus.current?.context.resume();
    setSceneId(scene.next ?? "s1");
    setScreen("episode");
    setNotice("");
    setPaused(false);
    setAnsweringOption(null);
    setBeatRevealed(false);
    setWrongAttempt(null);
    setAnswerRevealed(false);
    setHostReaction(null);
  }

  function advance() {
    if (screen !== "episode") return;
    if (scene.next) {
      if (scene.type === "branch_outcome") {
        preserveRewindForScene.current = scene.next;
        skipTeachForScene.current = scene.next;
        setRewindLevel(1);
      } else {
        setRewindLevel(0);
      }
      setSceneId(scene.next);
      setPaused(false);
      setBeatRevealed(false);
      setHostReaction(null);
      setAnswerRevealed(false);
    }
  }

  function continueLesson() {
    if (screen !== "episode") return;
    if (hasMoreLesson) {
      setLessonIndex((current) => current + 1);
      return;
    }
    advance();
  }

  function playStaticBurst() {
    if (muted || typeof window === "undefined" || !window.AudioContext) return;
    const context = new window.AudioContext();
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.24), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    noise.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 780;
    gain.gain.setValueAtTime(0.11, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
    noise.connect(filter).connect(gain).connect(context.destination);
    noise.start();
    noise.stop(context.currentTime + 0.24);
    window.setTimeout(() => void context.close(), 320);
  }

  function choose(optionId: string) {
    const option = scene.beat?.options.find((candidate) => candidate.id === optionId);
    if (!option || !scene.beat || answeringOption || answerRevealed) return;
    setAnsweringOption(optionId);
    setRatings((current) => [...current.slice(-9), option.isCorrect]);
    // The next scene carries the learner-facing feedback. A transient status bar
    // here is redundant and can cover the transport at smaller TV viewports.
    setNotice("");
    if (!option.isCorrect) {
      const incorrectCount = (wrongAttempt?.count ?? 0) + 1;
      if (incorrectCount >= 2) {
        const correctOption = scene.beat.options.find((candidate) => candidate.isCorrect)!;
        const correctiveScene = findScene(episode, scene.beat.onIncorrect);
        setWrongAttempt({
          count: incorrectCount,
          correctAnswer: correctOption.text,
          explanation: displayedBeat?.explanation ?? correctiveScene.refutation ?? `“${correctOption.text}” is the correct answer.`,
        });
        setAnswerRevealed(true);
        return;
      }
      setWrongAttempt((current) => ({
        count: (current?.count ?? 0) + 1,
        correctAnswer: scene.beat!.options.find((candidate) => candidate.isCorrect)!.text,
        explanation: displayedBeat?.explanation ?? findScene(episode, scene.beat!.onIncorrect).refutation ?? "Review the corrective feedback, then try the simpler take.",
      }));
    } else {
      setWrongAttempt(null);
    }

    window.setTimeout(() => {
      setSceneId(option.isCorrect ? correctDestination(episode, scene) : scene.beat!.onIncorrect);
      setHostReaction(option.isCorrect ? "celebrate" : "retry");
      setRewindLevel(0);
      setPaused(false);
      setBeatRevealed(false);
      setAnsweringOption(null);
    }, option.isCorrect ? 420 : 520);
  }

  function continueWithAnswer() {
    if (!scene.beat || !answerRevealed) return;
    setSceneId(correctDestination(episode, scene));
    setRewindLevel(0);
    setBeatRevealed(false);
    setAnsweringOption(null);
    setAnswerRevealed(false);
    setWrongAttempt(null);
    setHostReaction(null);
  }

  function rewind() {
    if (screen !== "episode") return;
    if (!scene.simpler && !displayedBeat?.simplerQuestion) {
      setNotice("This scene has no simpler take. Try the next question instead.");
      return;
    }
    setRewindLevel((level) => Math.min(2, level + 1));
    if (beatRevealed) {
      return;
    }
    setRewindPlayback(true);
    setBeatRevealed(false);
  }

  async function ingestFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    if (!selected.length) return;
    const unsupportedMov = selected.find((file) => /\.mov$/i.test(file.name));
    if (unsupportedMov) {
      setNotice(`${unsupportedMov.name} is a .mov file. Export it as mp4 or webm, then try again.`);
      return;
    }
    setExtracting(true);
    setNotice("");
    try {
      const form = new FormData();
      selected.forEach((file) => form.append("files", file));
      const response = await fetch("/api/ingest", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We couldn't read those files.");
      setNotes(result.sourceText);
      setFileManifest(result.manifest ?? []);
      setNotice(result.notice ?? (result.condensed ? "Your files were condensed to fit the episode format." : "Study material is ready to edit."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "We couldn't read those files.");
    } finally {
      setExtracting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const isBeat = Boolean(scene.beat);
  const isOutcome = scene.type === "branch_outcome";
  const isCommercial = scene.type === "commercial";
  const isCliffhanger = scene.type === "cliffhanger";
  const playbackReady = screen === "episode";

  return (
    <main className="room" style={{ "--theme-primary": activeTheme.palette[1], "--theme-accent": activeTheme.palette[3] ?? activeTheme.palette[0], "--theme-ink": activeTheme.palette.at(-1) } as CSSProperties}>
      <div className="room-glow" aria-hidden="true" />
      <section className="tv-wrap" aria-label="ReRun interactive television">
        <div className="tv-cabinet">
          <div className="tv-screen">
            {screen === "off" && <div className="screen-center off-screen"><p>Your notes are about to go on air</p><span className="power-light" /><span>PRESS POWER</span></div>}
            {screen === "boot" && <div className="boot-screen" aria-label="Television powering on"><i className="boot-line" /></div>}
            {screen === "static" && <div className="static-screen" aria-label="Broadcast signal tuning" />}
            {screen === "home" && <HomeScreen onSelect={loadDemo} savedEpisodes={generatedEpisodes} onSelectSaved={loadCachedEpisode} onGenerate={() => setScreen("ingest")} />}
            {screen === "ingest" && <div className="ingest-screen"><ScreenHeader channel={3} right="CREATE A NEW EPISODE" /><div className="ingest-body"><p className="eyebrow">YOUR NOTES · ON AIR</p><h1>Feed me your material.</h1><fieldset className="theme-picker"><legend>Choose your original show</legend><div className="theme-options">{showThemePresets.map((theme) => <button type="button" key={theme.id} className={lastPresetTheme === theme.id && (!customVibe.trim() || themeInput.kind === "preset") ? "is-selected" : ""} onClick={() => { setThemeInput({ kind: "preset", id: theme.id }); setLastPresetTheme(theme.id); setCustomVibe(""); }}>{theme.name}</button>)}</div><label className="custom-vibe">Or describe an original vibe<input value={customVibe} onFocus={() => setThemeInput({ kind: "custom", vibe: customVibe })} onChange={(event) => { setCustomVibe(event.target.value); setThemeInput({ kind: "custom", vibe: event.target.value }); }} placeholder="e.g. wry suburban cartoon, warm flat colors" maxLength={300} /></label></fieldset><input ref={fileInput} className="file-input" type="file" accept={FILE_ACCEPT} multiple onChange={(event) => void ingestFiles(event.target.files ?? [])} /><button type="button" className="file-dropzone" onClick={() => fileInput.current?.click()} disabled={extracting}>＋ {extracting ? "READING FILES..." : "Add PDF / slides / photo / recording"}</button><p className="quiet">PDF, PPTX, DOCX, photos, audio, video, and text files. .mov: export as mp4 or webm.</p><textarea value={notes} maxLength={MAX_STUDY_CHARS} onChange={(event) => setNotes(event.target.value)} placeholder="Paste short study notes here, or add files above..." aria-label="Study notes" /><div className="notes-meta"><span>{notes.length.toLocaleString()}/{MAX_STUDY_CHARS.toLocaleString()} characters · {MIN_STUDY_CHARS} minimum</span>{fileManifest.map((file) => <span key={file.name}>{file.name} → {file.characters.toLocaleString()} characters</span>)}</div><div className="ingest-actions"><button onClick={() => setScreen("home")} className="secondary">← Back home</button><button onClick={generateEpisode} disabled={liveLoading || extracting} className="primary">{liveLoading ? "ON AIR..." : "Generate episode"}</button></div><p className="quiet">Live generation is optional. Five themed demo shows need no API key.</p>{themeNotice && <p className="theme-notice">{themeNotice}</p>}</div></div>}
            {screen === "standby" && <div className="screen-center standby-screen"><p>PLEASE STAND BY</p><span>TONIGHT&apos;S EPISODE IS IN PRODUCTION</span><strong>{standbyStatus}</strong></div>}
            {screen === "artwork" && <div className="screen-center standby-screen"><p>ILLUSTRATING THE FULL BROADCAST</p><span>{artProgress.ready}/{artProgress.total} ORIGINAL BACKGROUNDS READY</span><strong>{artProgress.failed ? `${artProgress.failed} scene${artProgress.failed === 1 ? "" : "s"} will use the backup set.` : "Saving every scene for your 7-day replay…"}</strong></div>}
            {screen === "recap" && <div className="recap-screen"><ScreenHeader channel={episode.channel} right="PREVIOUSLY ON..." /><div className="recap-body"><p className="eyebrow">WARM-UP BEFORE WE ROLL TAPE</p><h2>{episode.title}</h2><label>{scene.recap?.[0]?.prompt}<input value={recap} onChange={(event) => setRecap(event.target.value)} placeholder="your answer" /></label>{recapFeedback && <p className="feedback">{recapFeedback}</p>}<div className="ingest-actions"><button className="secondary" onClick={checkRecap}>Check</button><button className="primary" onClick={startEpisode}>▶ Roll the episode</button></div></div></div>}
            {screen === "episode" && <div className={`episode-screen ${paused ? "is-paused" : ""} ${isBeat && beatRevealed && !paused ? "has-question" : ""} ${answeringOption ? "is-answering" : ""}`}><ScreenHeader channel={episode.channel} right={isCommercial ? "COMMERCIAL BREAK" : "THE TOON BLOCK"} action={{ label: "Exit show", onClick: goHome }} /><div className={`scene-art scene-${scene.type}`}><SceneIllustration scene={scene} narrating={narration === "playing" || narration === "fallback"} reaction={hostReaction} questionReady={isBeat && beatRevealed && !paused} visualOverride={visuals[scene.id] ?? bundledSceneArt} host={activeDemoShow?.art.host} /></div><div className={`scene-cut ${sceneCut ? "is-active" : ""}`} aria-hidden="true" /><div className="scene-copy"><p className="speaker">{scene.speaker}</p>{captions && !(isBeat && beatRevealed && !paused) && <p className="caption">{visibleLine}</p>}</div>{paused && <aside className="deep-dive"><p>PAUSED - DEEP DIVE</p><strong>{scene.deepDive ?? "Stay with the current scene, then answer the next beat."}</strong><button onClick={() => setPaused(false)}>Resume show</button></aside>}{isBeat && beatRevealed && !paused && <><div className="question-wash" aria-hidden="true" /><section className={`beat-card ${isCommercial ? "commercial" : ""}`} role="dialog" aria-modal="true" aria-labelledby={`question-${scene.id}`}><p>{answerRevealed ? "ANSWER REVEALED — TAKE THE CORRECT ROUTE" : isCommercial ? "SKIP THIS AD - answer a review question" : "SIGNAL LOCKED — THE SHOW NEEDS YOU"}</p><h2 id={`question-${scene.id}`}>{displayedQuestion}</h2><div className="options">{displayedOptions.map((option, index) => {
              const isSelected = answeringOption === option.id;
              const showCorrect = answerRevealed && option.isCorrect;
              return <button key={option.id} autoFocus={index === 0} className={isSelected || showCorrect ? `is-selected ${option.isCorrect ? "is-correct" : "is-wrong"}` : ""} disabled={Boolean(answeringOption) || answerRevealed} onClick={() => choose(option.id)}><span>{String.fromCharCode(65 + index)}</span><b>{option.text}</b>{isSelected && !answerRevealed && <em>ANSWER LOCKED</em>}{showCorrect && <em>CORRECT ANSWER</em>}</button>;
            })}</div>{answerRevealed && <div className="answer-reveal" role="status"><strong>{wrongAttempt?.correctAnswer} is correct.</strong><span>{wrongAttempt?.explanation}</span><button className="continue-with-answer" onClick={continueWithAnswer}>Continue with answer ▶</button></div>}</section></>}{(isOutcome ? narration === "complete" : !rewindPlayback) && (!isBeat || !beatRevealed) && !isCliffhanger && !paused && <button onClick={continueLesson} className="continue">{isOutcome ? "Rewind & retry" : narration === "loading" || narration === "playing" || narration === "fallback" ? "Skip line" : hasMoreLesson ? "Next clue" : "Continue"} ▶</button>}{isCliffhanger && <section className="cliffhanger"><p>TO BE CONTINUED</p><h2>{episode.cliffhanger.teaser}</h2><span>Next episode airs in {episode.cliffhanger.airsAfterHours} hours</span><button onClick={() => setScreen("guide")}>See TV guide</button></section>}<p className="ai-voice-note">Narration available without an API key · captions carry all essential feedback</p></div>}
            {screen === "guide" && <div className="guide-screen"><ScreenHeader channel={episode.channel} right={isDemoEpisode ? "DEMO PLAYLIST" : "YOUR SAVED EPISODES"} /><div className="guide-body"><p className="eyebrow">TV GUIDE</p><h2>Next on ReRun</h2><div className="guide-row"><b>{channelLabel(episode.channel)}</b><span>{episode.title}</span><i>WATCHED</i></div>{guideEpisodes.map((entry, index) => <button key={entry.id} className="guide-row guide-row-action" onClick={() => entry.kind === "demo" ? loadDemo(entry.show) : loadCachedEpisode(entry.episode)}><b>{channelLabel(entry.kind === "demo" ? entry.show.episode.channel : entry.episode.channel)}</b><span>{entry.title}</span><i>{index === 0 ? "WATCH NEXT" : "WATCH"}</i></button>)}{!isDemoEpisode && guideEpisodes.length === 0 && <div className="guide-empty"><p>No other saved episode is waiting.</p><button className="primary" onClick={() => setScreen("ingest")}>Generate a new episode</button></div>}<div className="guide-actions"><button className="primary" onClick={() => isDemoEpisode && activeDemoShow ? loadDemo(activeDemoShow) : loadCachedEpisode(episode)}>Watch again</button><button className="secondary" onClick={goHome}>← Return home</button></div></div></div>}
            {notice && <p className="notice" role="status">{notice}</p>}
          </div>
        </div>
      </section>
      <aside className="remote" aria-label="Remote control"><div className="remote-brand"><b>ReRun</b><span>NETWORK</span></div><button className="power" onClick={power} aria-label={screen === "off" ? "Power on television" : "Power off television"}>⏻</button><div className="ratings"><span>ANSWER ACCURACY</span><strong>{accuracy === null ? "---" : `${accuracy}%`}</strong><div>{[1,2,3,4,5].map((pip) => <i key={pip} className={pip <= Math.ceil((accuracy ?? 0) / 20) ? "on" : ""} />)}</div></div><div className="remote-grid"><button onClick={() => setPaused((value) => !value)} disabled={!playbackReady} aria-pressed={paused}>{paused ? "▶ Play" : "❚❚ Pause"}</button><button onClick={rewind} disabled={!playbackReady}>◀◀ RWD</button><button onClick={continueLesson} disabled={!playbackReady}>▶▶ FFWD</button><button onClick={() => setAutoplay((value) => !value)} disabled={!playbackReady} aria-pressed={autoplay}>AUTO {autoplay ? "ON" : "OFF"}</button></div><div className="remote-footer"><button onClick={() => setCaptions((value) => !value)}>CC {captions ? "ON" : "OFF"}</button><button onClick={() => setMuted((value) => !value)}>{muted ? "🔇" : "🔊"}</button></div></aside>
      <p className="build-note">Education demo • retrieval practice, feedback, adaptive re-explanation • no account required</p>
    </main>
  );
}

function canonicalCut(episode: EpisodeSpec) {
  const scenes: Scene[] = [];
  const visited = new Set<string>();
  let current = episode.scenes.find((scene) => scene.id === "recap")?.next;
  while (current && !visited.has(current) && scenes.length < episode.scenes.length) {
    const scene = findScene(episode, current);
    visited.add(scene.id);
    if (scene.type !== "branch_outcome") scenes.push(scene);
    current = scene.beat?.onCorrect ?? scene.next ?? undefined;
  }
  return scenes;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A scene image could not be loaded for export."));
    image.src = source;
  });
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function sceneNarration(scene: Scene) {
  return scene.line ?? scene.beat?.question ?? "";
}

async function downloadGeneratedShowVideo(episode: EpisodeSpec, onProgress: (message: string) => void) {
  const scenes = canonicalCut(episode);
  const artwork = await loadLiveEpisodeArt(episode.episodeId, scenes.map((scene) => scene.id), GENERATED_EPISODE_TTL_MS);
  if (scenes.some((scene) => !artwork[scene.id])) throw new Error("Finish illustrating this show before downloading its video.");

  onProgress("Preparing video scenes…");
  const [hostIdle, hostTalk, ...sceneImages] = await Promise.all([
    loadImage("/assets/motion/professor-paws-flat-idle.png"),
    loadImage("/assets/motion/professor-paws-flat-talk.png"),
    ...scenes.map((scene) => loadImage(artwork[scene.id])),
  ]);
  const canvas = document.createElement("canvas");
  // Render at 1080p while keeping the broadcast layout in a convenient 720p
  // coordinate space. This avoids the soft host plate that resulted from
  // recording a 720p canvas and then encoding it again as MP4.
  const logicalWidth = 1280;
  const logicalHeight = 720;
  const renderScale = 1.5;
  canvas.width = logicalWidth * renderScale;
  canvas.height = logicalHeight * renderScale;
  const context = canvas.getContext("2d");
  if (!context || !canvas.captureStream || typeof MediaRecorder === "undefined") throw new Error("This browser cannot render a video export.");
  context.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const audioContext = new AudioContext();
  const voiceTheme = episode.theme ?? defaultTheme;
  onProgress("Generating narration track…");
  const narration = await Promise.all(scenes.map(async (scene) => {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: sceneNarration(scene), voice: voiceTheme.voice, instructions: voiceTheme.voiceInstruction }),
    });
    if (!response.ok) return undefined;
    return audioContext.decodeAudioData(await response.arrayBuffer());
  }));
  // Safari occasionally reports an invalid MP3 duration after decoding. Bound
  // each beat by its caption length so one malformed audio header can never
  // turn a one-minute episode into a multi-day video timeline.
  const sceneDurations = narration.map((audio, index) => {
    const estimated = Math.max(3_200, Math.min(8_500, sceneNarration(scenes[index]).length * 46 + 1_250));
    const decoded = audio && Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration < 20
      ? audio.duration * 1_000 + 750
      : estimated;
    return Math.max(3_200, Math.min(8_500, decoded));
  });
  const sceneStarts = sceneDurations.reduce<number[]>((starts, duration) => [...starts, (starts.at(-1) ?? 0) + duration], [0]).slice(0, -1);
  const totalDuration = sceneDurations.reduce((total, duration) => total + duration, 0);
  const audioDestination = audioContext.createMediaStreamDestination();
  const videoStream = canvas.captureStream(30);
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
  // Safari's MP4 MediaRecorder path can emit corrupted duration metadata for a
  // canvas stream. WebM preserves correct timestamps; MP4 remains a fallback
  // only for browsers without WebM recording support.
  const mimeType = ["video/webm;codecs=vp9", "video/webm", "video/mp4;codecs=avc1.42E01E"].find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 14_000_000 } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const complete = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  const startedAt = performance.now();

  const paint = () => {
    const elapsed = performance.now() - startedAt;
    const activeIndex = sceneStarts.findIndex((start, candidate) => elapsed < start + sceneDurations[candidate]);
    const index = activeIndex === -1 ? scenes.length - 1 : activeIndex;
    const scene = scenes[index];
    const image = sceneImages[index];
    const sceneElapsed = Math.max(0, elapsed - sceneStarts[index]);
    drawCover(context, image, logicalWidth, logicalHeight);
    context.fillStyle = "rgba(0, 4, 15, .26)";
    context.fillRect(0, 0, logicalWidth, logicalHeight);
    context.fillStyle = "#33ff66";
    context.font = "bold 34px monospace";
    context.fillText(channelLabel(episode.channel), 40, 54);
    context.textAlign = "right";
    context.fillText("THE TOON BLOCK", logicalWidth - 40, 54);
    context.textAlign = "left";
    const hostHeight = 370;
    const hostWidth = hostIdle.naturalWidth * (hostHeight / hostIdle.naturalHeight);
    const hostX = 42;
    const hostY = logicalHeight - hostHeight - 26;
    const isSpeaking = Boolean(narration[index]);
    // Match the player: the open-mouth plate is shown while the narration is
    // active, with a small speaking nod so the exported host is not static.
    const hostPlate = isSpeaking ? hostTalk : hostIdle;
    const nod = isSpeaking ? Math.sin(sceneElapsed / 145) * 3.5 : Math.sin(sceneElapsed / 920) * 1.5;
    const tilt = isSpeaking ? Math.sin(sceneElapsed / 285) * 0.012 : Math.sin(sceneElapsed / 1_200) * 0.003;
    context.save();
    context.translate(hostX + hostWidth / 2, hostY + hostHeight / 2 + nod);
    context.rotate(tilt);
    context.drawImage(hostPlate, -hostWidth / 2, -hostHeight / 2, hostWidth, hostHeight);
    context.restore();
    const caption = sceneNarration(scene);
    context.fillStyle = "rgba(0,0,0,.82)";
    context.fillRect(310, logicalHeight - 132, 900, 78);
    context.fillStyle = "#fff5e5";
    context.font = "31px sans-serif";
    const words = caption.split(/\s+/);
    let line = "";
    let y = logicalHeight - 98;
    for (const word of words) {
      const next = `${line}${line ? " " : ""}${word}`;
      if (context.measureText(next).width > 860 && line) { context.fillText(line, 334, y); line = word; y += 36; }
      else line = next;
    }
    context.fillText(line, 334, y);
    onProgress(`Rendering video ${index + 1}/${scenes.length}…`);
    if (elapsed < totalDuration) requestAnimationFrame(paint);
    else recorder.stop();
  };

  await audioContext.resume().catch(() => undefined);
  const audioStart = audioContext.currentTime + 0.12;
  narration.forEach((buffer, index) => {
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioDestination);
    source.start(audioStart + sceneStarts[index] / 1_000);
    source.stop(audioStart + (sceneStarts[index] + sceneDurations[index]) / 1_000);
  });
  recorder.start(1_000);
  requestAnimationFrame(paint);
  await complete;
  await audioContext.close();
  onProgress("Encoding high-quality MP4…");
  const intermediate = new Blob(chunks, { type: mimeType || "video/webm" });
  const form = new FormData();
  form.append("video", intermediate, "rerun-broadcast.webm");
  const encodedResponse = await fetch("/api/video-export", { method: "POST", body: form });
  if (!encodedResponse.ok) throw new Error((await encodedResponse.json().catch(() => ({ error: "MP4 encoding failed." }))).error);
  const url = URL.createObjectURL(await encodedResponse.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `${episode.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "rerun-show"}.mp4`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function SavedEpisodeThumbnail({ episode }: { episode: EpisodeSpec }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const firstSceneId = canonicalCut(episode)[0]?.id;
    if (!firstSceneId) return;
    void loadLiveEpisodeArt(episode.episodeId, [firstSceneId], GENERATED_EPISODE_TTL_MS)
      .then((artwork) => {
        if (!cancelled) setThumbnail(artwork[firstSceneId] ?? null);
      })
      .catch(() => {
        if (!cancelled) setThumbnail(null);
      });
    return () => { cancelled = true; };
  }, [episode]);

  return <span className="saved-episode-thumbnail">{thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <span>YOUR<br />SHOW</span>}<i>REPLAY ▶</i></span>;
}

function HomeScreen({ onSelect, savedEpisodes, onSelectSaved, onGenerate }: { onSelect: (show: DemoShow) => void; savedEpisodes: EpisodeSpec[]; onSelectSaved: (episode: EpisodeSpec) => void; onGenerate: () => void }) {
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState("");
  const exportShow = async (episode: EpisodeSpec) => {
    setExportingId(episode.episodeId);
    setExportStatus("Preparing video…");
    try { await downloadGeneratedShowVideo(episode, setExportStatus); setExportStatus("Video downloaded."); }
    catch (error) { setExportStatus(error instanceof Error ? error.message : "Video export could not start."); }
    finally { setExportingId(null); }
  };
  return <div className="home-screen"><header className="home-marquee"><span className="home-brand">ReRun</span><span className="home-dial">TV GUIDE</span></header><div className="home-body"><p className="eyebrow">TONIGHT&apos;S LINEUP</p><h1>Pick a show, or make your own.</h1><div className="lineup">{demoShows.map((show) => <button key={show.id} type="button" className="lineup-card" style={{ "--show-primary": show.theme.palette[1], "--show-accent": show.theme.palette[3] ?? show.theme.palette[0] } as CSSProperties} onClick={() => onSelect(show)}><span className="lineup-art"><img src={show.art.teaching} alt="" loading="lazy" /><i className="lineup-topic">{show.topic}</i></span><span className="lineup-meta"><b>{show.title}</b><small>{channelLabel(show.episode.channel)} · {show.theme.name}</small></span><span className="lineup-badge">WATCH ▶</span></button>)}</div>{savedEpisodes.length > 0 && <section className="home-saved"><p className="eyebrow">YOUR RECENT EPISODES · SAVED FOR 7 DAYS</p><div className="lineup">{savedEpisodes.map((savedEpisode) => <div key={savedEpisode.episodeId} className="saved-episode-entry"><button type="button" className="lineup-card saved-episode-card" onClick={() => onSelectSaved(savedEpisode)}><SavedEpisodeThumbnail episode={savedEpisode} /><span className="lineup-meta"><b>{savedEpisode.title}</b><small>{channelLabel(savedEpisode.channel)} · Your generated show</small></span><span className="lineup-badge">WATCH ▶</span></button><button type="button" className="saved-download" disabled={exportingId !== null} onClick={() => void exportShow(savedEpisode)}>{exportingId === savedEpisode.episodeId ? exportStatus : "⇩ Download video"}</button></div>)}</div>{exportStatus && <p className="video-export-status" role="status">{exportStatus}</p>}</section>}<div className="home-create"><p className="eyebrow">OR PUT YOUR OWN NOTES ON AIR</p><button type="button" className="primary home-generate" onClick={onGenerate}>＋ Generate an episode from your notes — PDFs, slides, photos, and recordings welcome</button></div><p className="quiet">Five themed demo shows need no API key. Live generation is optional.</p></div></div>;
}

function ScreenHeader({ channel, right, action }: { channel: number; right: string; action?: { label: string; onClick: () => void } }) {
  return <header className="screen-header"><span>{channelLabel(channel)}</span><span className="screen-header-controls"><span>{right}</span>{action && <button type="button" className="exit-show" onClick={action.onClick}>{action.label}</button>}</span></header>;
}
