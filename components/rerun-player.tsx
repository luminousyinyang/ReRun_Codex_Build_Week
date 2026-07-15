"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { demoEpisode, type EpisodeSpec, type Scene } from "@/lib/episode";
import { SceneIllustration } from "@/components/scene-illustration";
import { defaultTheme, showThemePresets, type ShowTheme, type ThemeInput } from "@/lib/theme";

type Screen = "off" | "boot" | "static" | "ingest" | "standby" | "recap" | "episode" | "guide";

function findScene(episode: EpisodeSpec, id: string) {
  return episode.scenes.find((scene) => scene.id === id) ?? episode.scenes[0];
}

async function streamSceneArt(scene: Scene, theme: ShowTheme, referenceDataUrl: string | undefined, onImage: (url: string) => void) {
  const response = await fetch("/api/scene-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scene: { id: scene.id, type: scene.type, background: scene.background }, theme, referenceDataUrl }),
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
      const payload = JSON.parse(data) as { dataUrl?: string };
      if ((name === "preview" || name === "final") && payload.dataUrl) {
        onImage(payload.dataUrl);
        if (name === "final") final = payload.dataUrl;
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
  const [rewindLevel, setRewindLevel] = useState(0);
  const [ratings, setRatings] = useState<boolean[]>([]);
  const [captions, setCaptions] = useState(true);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [answeringOption, setAnsweringOption] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [themeInput, setThemeInput] = useState<ThemeInput>({ kind: "preset", id: defaultTheme.id });
  const [customVibe, setCustomVibe] = useState("");
  const [themeNotice, setThemeNotice] = useState("");
  const [narration, setNarration] = useState<"idle" | "loading" | "playing" | "fallback" | "complete">("idle");
  const [beatRevealed, setBeatRevealed] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [visuals, setVisuals] = useState<Record<string, string>>({});
  const audioCache = useRef(new Map<string, string>());
  const narrationTimer = useRef<number | null>(null);
  const fallbackDeadline = useRef(0);
  const fallbackRemaining = useRef(0);
  const resumeFallback = useRef<(() => void) | null>(null);

  const scene = useMemo(() => findScene(episode, sceneId), [episode, sceneId]);
  const accuracy = ratings.length ? Math.round((ratings.filter(Boolean).length / ratings.length) * 100) : null;
  const visibleLine = rewindLevel >= 2 && scene.simplerAgain ? scene.simplerAgain : rewindLevel >= 1 && scene.simpler ? scene.simpler : scene.line;
  const activeTheme = episode.theme ?? defaultTheme;

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
    const timer = window.setTimeout(() => setScreen("ingest"), reduceMotion ? 0 : 360);
    return () => window.clearTimeout(timer);
  }, [screen, muted]);

  useEffect(() => {
    if (screen !== "standby") return;
    const timer = window.setTimeout(() => setScreen("recap"), 850);
    return () => window.clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== "episode" || !visibleLine) {
      setNarration("idle");
      return;
    }
    let cancelled = false;
    let audio: HTMLAudioElement | null = null;
    setBeatRevealed(false);
    setNarration("loading");

    const finish = () => {
      if (cancelled) return;
      setNarration("complete");
      if (scene.beat) {
        setBeatRevealed(true);
        return;
      }
      if (!scene.next || scene.type === "cliffhanger") return;
      narrationTimer.current = window.setTimeout(() => {
        if (!cancelled) {
          setSceneId(scene.next!);
          setRewindLevel(0);
          setPaused(false);
        }
      }, 850);
    };

    const scheduleFallback = (delay: number) => {
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

    const playNarration = async () => {
      try {
        const cacheKey = `${activeTheme.id}:${visibleLine}`;
        let source = audioCache.current.get(cacheKey);
        if (!source) {
          const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: visibleLine, instructions: activeTheme.voiceInstruction }),
          });
          if (!response.ok) throw new Error("Narration unavailable");
          source = URL.createObjectURL(await response.blob());
          audioCache.current.set(cacheKey, source);
        }
        if (cancelled) return;
        audio = new Audio(source);
        audio.muted = muted;
        audio.onended = finish;
        audio.onerror = useFallback;
        setAudioElement(audio);
        await audio.play();
        if (!cancelled) setNarration("playing");
      } catch {
        useFallback();
      }
    };
    void playNarration();

    return () => {
      cancelled = true;
      if (narrationTimer.current !== null) window.clearTimeout(narrationTimer.current);
      narrationTimer.current = null;
      resumeFallback.current = null;
      if (audio) {
        audio.onended = null;
        audio.pause();
      }
      setAudioElement(null);
    };
  }, [screen, scene.id, visibleLine, activeTheme.id, activeTheme.voiceInstruction]);

  useEffect(() => {
    if (audioElement) {
      audioElement.muted = muted;
      if (paused) audioElement.pause();
      else if (narration === "playing") void audioElement.play().catch(() => undefined);
    }
    if (paused && narration === "fallback" && narrationTimer.current !== null) {
      window.clearTimeout(narrationTimer.current);
      narrationTimer.current = null;
      fallbackRemaining.current = Math.max(200, fallbackDeadline.current - Date.now());
    } else if (!paused && narration === "fallback" && narrationTimer.current === null) {
      resumeFallback.current?.();
    }
  }, [audioElement, muted, narration, paused]);

  useEffect(() => () => {
    for (const source of audioCache.current.values()) URL.revokeObjectURL(source);
  }, []);

  useEffect(() => {
    if (episode.courseId !== "live-notes" || !episode.theme) return;
    let cancelled = false;
    const candidates = episode.scenes.filter((candidate) => candidate.type !== "recap");
    const render = async (candidate: Scene, reference?: string) => streamSceneArt(candidate, episode.theme!, reference, (url) => {
      if (!cancelled) setVisuals((current) => ({ ...current, [candidate.id]: url }));
    });
    void (async () => {
      try {
        const styleKey = candidates[0] ? await render(candidates[0]) : undefined;
        const queue = candidates.slice(1);
        await Promise.all(Array.from({ length: Math.min(2, queue.length) }, async () => {
          while (queue.length) {
            const candidate = queue.shift();
            if (candidate) await render(candidate, styleKey);
          }
        }));
      } catch {
        // Local art remains visible; a live render should never interrupt playback.
      }
    })();
    return () => { cancelled = true; };
  }, [episode]);

  function power() {
    setScreen((current) => current === "off" ? "boot" : "off");
    setNotice("");
  }

  function loadDemo() {
    setEpisode(demoEpisode);
    setSceneId("recap");
    setRecap("");
    setRecapFeedback("");
    setRatings([]);
    setRewindLevel(0);
    setAnsweringOption(null);
    setVisuals({});
    setThemeNotice("");
    setScreen("recap");
    setNotice("Demo course loaded. No API key required.");
  }

  async function generateEpisode() {
    if (notes.trim().length < 80) {
      setNotice("Paste a little more material (at least 80 characters), or load the demo course.");
      return;
    }
    setLiveLoading(true);
    setNotice("The network is shaping your notes into an episode...");
    try {
      const selectedTheme = themeInput.kind === "custom" ? { kind: "custom" as const, vibe: customVibe } : themeInput;
      const response = await fetch("/api/episode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: notes, themeInput: selectedTheme }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Episode unavailable");
      setEpisode(result.episode);
      setThemeNotice(result.themeNotice ?? "");
      setVisuals({});
      setSceneId("recap");
      setRecap("");
      setRecapFeedback("");
      setRatings([]);
      setRewindLevel(0);
      setAnsweringOption(null);
      setScreen("recap");
      setNotice("Your notes are now on air.");
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : "Live generation is unavailable"} Watch the bundled demo instead.`);
    } finally {
      setLiveLoading(false);
    }
  }

  function checkRecap() {
    const answers = scene.recap?.[0]?.answers ?? [];
    const correct = answers.some((answer) => recap.toLowerCase().includes(answer.toLowerCase()));
    setRecapFeedback(correct ? "Correct - roll tape!" : `Close. The answer is ${answers[0] ?? "in the episode"}.`);
  }

  function startEpisode() {
    setSceneId(scene.next ?? "s1");
    setScreen("episode");
    setNotice("");
    setAnsweringOption(null);
    setBeatRevealed(false);
  }

  function advance() {
    if (scene.next) {
      setSceneId(scene.next);
      setRewindLevel(0);
      setPaused(false);
      setBeatRevealed(false);
    }
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
    if (!option || !scene.beat || answeringOption) return;
    setAnsweringOption(optionId);
    setRatings((current) => [...current.slice(-9), option.isCorrect]);
    setNotice(option.isCorrect ? "Applause! The show rolls on." : "The show follows that logic for one beat...");
    window.setTimeout(() => {
      setSceneId(option.isCorrect ? scene.beat!.onCorrect : scene.beat!.onIncorrect);
      setRewindLevel(0);
      setPaused(false);
      setBeatRevealed(false);
      setAnsweringOption(null);
    }, option.isCorrect ? 420 : 520);
  }

  function rewind() {
    if (!scene.simpler) {
      setNotice("This scene has no simpler take. Try the next question instead.");
      return;
    }
    setRewindLevel((level) => Math.min(2, level + 1));
    setNotice("VHS rewind - same fact, simpler take.");
  }

  const isBeat = Boolean(scene.beat);
  const isOutcome = scene.type === "branch_outcome";
  const isCommercial = scene.type === "commercial";
  const isCliffhanger = scene.type === "cliffhanger";

  return (
    <main className="room" style={{ "--theme-primary": activeTheme.palette[1], "--theme-accent": activeTheme.palette[3] ?? activeTheme.palette[0], "--theme-ink": activeTheme.palette.at(-1) } as CSSProperties}>
      <div className="room-glow" aria-hidden="true" />
      <section className="tv-wrap" aria-label="ReRun interactive television">
        <div className="tv-cabinet">
          <div className="tv-screen">
            {screen === "off" && <div className="screen-center off-screen"><p>Your notes are about to go on air</p><span className="power-light" /><span>PRESS POWER</span></div>}
            {screen === "boot" && <div className="boot-screen" aria-label="Television powering on"><i className="boot-line" /></div>}
            {screen === "static" && <div className="static-screen" aria-label="Broadcast signal tuning" />}
            {screen === "ingest" && <div className="ingest-screen"><ScreenHeader right="NO SIGNAL - REC" /><div className="ingest-body"><p className="eyebrow">CH 00</p><h1>Feed me your material.</h1><fieldset className="theme-picker"><legend>Choose your original show</legend><div className="theme-options">{showThemePresets.map((theme) => <button type="button" key={theme.id} className={themeInput.kind === "preset" && themeInput.id === theme.id ? "is-selected" : ""} onClick={() => { setThemeInput({ kind: "preset", id: theme.id }); setCustomVibe(""); }}>{theme.name}</button>)}</div><label className="custom-vibe">Or describe an original vibe<input value={customVibe} onFocus={() => setThemeInput({ kind: "custom", vibe: customVibe })} onChange={(event) => { setCustomVibe(event.target.value); setThemeInput({ kind: "custom", vibe: event.target.value }); }} placeholder="e.g. wry suburban cartoon, warm flat colors" maxLength={300} /></label></fieldset><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Paste short study notes here..." aria-label="Study notes" /><div className="ingest-actions"><button onClick={loadDemo} className="secondary">Load demo course</button><button onClick={generateEpisode} disabled={liveLoading} className="primary">{liveLoading ? "ON AIR..." : "Generate episode"}</button></div><p className="quiet">Live generation is optional. The demo needs no API key.</p>{themeNotice && <p className="theme-notice">{themeNotice}</p>}</div></div>}
            {screen === "standby" && <div className="screen-center standby-screen"><p>PLEASE STAND BY</p><span>TONIGHT&apos;S EPISODE IS IN PRODUCTION</span></div>}
            {screen === "recap" && <div className="recap-screen"><ScreenHeader right="PREVIOUSLY ON..." /><div className="recap-body"><p className="eyebrow">WARM-UP BEFORE WE ROLL TAPE</p><h2>{episode.title}</h2><label>{scene.recap?.[0]?.prompt}<input value={recap} onChange={(event) => setRecap(event.target.value)} placeholder="your answer" /></label>{recapFeedback && <p className="feedback">{recapFeedback}</p>}<div className="ingest-actions"><button className="secondary" onClick={checkRecap}>Check</button><button className="primary" onClick={startEpisode}>Now airing - CH 03</button></div></div></div>}
            {screen === "episode" && <div className={`episode-screen ${paused ? "is-paused" : ""} ${isBeat && beatRevealed && !paused ? "has-question" : ""} ${answeringOption ? "is-answering" : ""}`}><ScreenHeader right={isCommercial ? "COMMERCIAL BREAK" : "THE TOON BLOCK"} /><div className={`scene-art scene-${scene.type}`}><SceneIllustration scene={scene} narrating={narration === "playing" || narration === "fallback"} visualOverride={visuals[scene.id]} /></div><div className={`scene-copy ${isOutcome ? "has-refutation" : ""}`}><p className="speaker">{scene.speaker}</p>{captions && <p className="caption">{visibleLine}</p>}{isOutcome && <p className="refutation">↺ {scene.refutation}</p>}</div>{paused && <aside className="deep-dive"><p>PAUSED - DEEP DIVE</p><strong>{scene.deepDive ?? "Stay with the current scene, then answer the next beat."}</strong><button onClick={() => setPaused(false)}>Resume show</button></aside>}{isBeat && beatRevealed && !paused && <><div className="question-wash" aria-hidden="true" /><section className={`beat-card ${isCommercial ? "commercial" : ""}`} role="dialog" aria-modal="true" aria-labelledby={`question-${scene.id}`}><p>{isCommercial ? "SKIP THIS AD - answer a review question" : "SIGNAL LOCKED — THE SHOW NEEDS YOU"}</p><h2 id={`question-${scene.id}`}>{scene.beat!.question}</h2><div className="options">{scene.beat!.options.map((option, index) => <button key={option.id} autoFocus={index === 0} className={answeringOption === option.id ? "is-selected" : ""} disabled={Boolean(answeringOption)} onClick={() => choose(option.id)}><span>{String.fromCharCode(65 + index)}</span><b>{option.text}</b>{answeringOption === option.id && <em>LOCKED IN</em>}</button>)}</div></section></>}{!isBeat && !isCliffhanger && !paused && <button onClick={advance} className="continue">{narration === "loading" || narration === "playing" || narration === "fallback" ? "Skip line" : isOutcome ? "Rewind & retry" : "Continue"} ▶</button>}{isCliffhanger && <section className="cliffhanger"><p>TO BE CONTINUED</p><h2>{episode.cliffhanger.teaser}</h2><span>Next episode airs in {episode.cliffhanger.airsAfterHours} hours</span><button onClick={() => setScreen("guide")}>See TV guide</button></section>}<p className="ai-voice-note">AI-generated narration · captions carry all essential feedback</p></div>}
            {screen === "guide" && <div className="guide-screen"><ScreenHeader right="SPACED REVIEW LINEUP" /><div className="guide-body"><p className="eyebrow">TV GUIDE</p><h2>Next on ReRun</h2><div className="guide-row"><b>CH 03</b><span>{episode.title}</span><i>WATCHED</i></div><div className="guide-row"><b>CH 03</b><span>{episode.cliffhanger.teaser}</span><i>+{episode.cliffhanger.airsAfterHours}h</i></div><div className="guide-row locked"><b>CH 07</b><span>The Buzz-In</span><i>COMING SOON</i></div><button className="primary" onClick={loadDemo}>Watch again</button></div></div>}
            {notice && <p className="notice" role="status">{notice}</p>}
          </div>
        </div>
      </section>
      <aside className="remote" aria-label="Remote control"><div className="remote-brand"><b>ReRun</b><span>NETWORK</span></div><button className="power" onClick={power} aria-label={screen === "off" ? "Power on television" : "Power off television"}>⏻</button><div className="ratings"><span>RATINGS</span><strong>{accuracy === null ? "---" : `${accuracy}%`}</strong><div>{[1,2,3,4,5].map((pip) => <i key={pip} className={pip <= Math.ceil((accuracy ?? 0) / 20) ? "on" : ""} />)}</div></div><div className="remote-grid"><button onClick={() => setPaused(true)}>Pause</button><button onClick={rewind}>◀◀ RWD</button><button onClick={() => setNotice("Fast-forward unlocks with P1 mastery checks.")}>FFWD</button><button onClick={() => setNotice("CH 07 and CH 11 are scheduled for P1.")}>CH ▲▼</button></div><button className="callin" onClick={() => setNotice("Call-in is a P1 Socratic feature. The host will never reveal an answer.")}>☎ Call-in</button><div className="remote-footer"><button onClick={() => setCaptions((value) => !value)}>CC {captions ? "ON" : "OFF"}</button><button onClick={() => setMuted((value) => !value)}>{muted ? "🔇" : "🔊"}</button></div></aside>
      <p className="build-note">Education demo • retrieval practice, feedback, adaptive re-explanation • no account required</p>
    </main>
  );
}

function ScreenHeader({ right }: { right: string }) {
  return <header className="screen-header"><span>CH 03</span><span>{right}</span></header>;
}
