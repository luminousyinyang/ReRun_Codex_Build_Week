"use client";

import { useEffect, useMemo, useState } from "react";
import { demoEpisode, type EpisodeSpec, type Scene } from "@/lib/episode";
import { SceneIllustration } from "@/components/scene-illustration";

type Screen = "off" | "ingest" | "standby" | "recap" | "episode" | "guide";

function findScene(episode: EpisodeSpec, id: string) {
  return episode.scenes.find((scene) => scene.id === id) ?? episode.scenes[0];
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
  const [notice, setNotice] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);

  const scene = useMemo(() => findScene(episode, sceneId), [episode, sceneId]);
  const accuracy = ratings.length ? Math.round((ratings.filter(Boolean).length / ratings.length) * 100) : null;
  const visibleLine = rewindLevel >= 2 && scene.simplerAgain ? scene.simplerAgain : rewindLevel >= 1 && scene.simpler ? scene.simpler : scene.line;

  useEffect(() => {
    if (screen !== "standby") return;
    const timer = window.setTimeout(() => setScreen("recap"), 850);
    return () => window.clearTimeout(timer);
  }, [screen]);

  function power() {
    setScreen((current) => current === "off" ? "ingest" : "off");
    setNotice("");
  }

  function loadDemo() {
    setEpisode(demoEpisode);
    setSceneId("recap");
    setRecap("");
    setRecapFeedback("");
    setRatings([]);
    setRewindLevel(0);
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
      const response = await fetch("/api/episode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: notes }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Episode unavailable");
      setEpisode(result.episode);
      setSceneId("recap");
      setRecap("");
      setRecapFeedback("");
      setRatings([]);
      setRewindLevel(0);
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
  }

  function advance() {
    if (scene.next) {
      setSceneId(scene.next);
      setRewindLevel(0);
      setPaused(false);
    }
  }

  function choose(optionId: string) {
    const option = scene.beat?.options.find((candidate) => candidate.id === optionId);
    if (!option || !scene.beat) return;
    setRatings((current) => [...current.slice(-9), option.isCorrect]);
    setNotice(option.isCorrect ? "Applause! The show rolls on." : "The show follows that logic for one beat...");
    window.setTimeout(() => {
      setSceneId(option.isCorrect ? scene.beat!.onCorrect : scene.beat!.onIncorrect);
      setRewindLevel(0);
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
    <main className="room">
      <div className="room-glow" aria-hidden="true" />
      <section className="tv-wrap" aria-label="ReRun interactive television">
        <div className="tv-cabinet">
          <div className="tv-screen">
            {screen === "off" && <div className="screen-center off-screen"><p>Your notes are about to go on air</p><span className="power-light" /><span>PRESS POWER</span></div>}
            {screen === "ingest" && <div className="ingest-screen"><ScreenHeader right="NO SIGNAL - REC" /><div className="ingest-body"><p className="eyebrow">CH 00</p><h1>Feed me your material.</h1><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Paste short study notes here..." aria-label="Study notes" /><div className="ingest-actions"><button onClick={loadDemo} className="secondary">Load demo course</button><button onClick={generateEpisode} disabled={liveLoading} className="primary">{liveLoading ? "ON AIR..." : "Generate episode"}</button></div><p className="quiet">Live generation is optional. The demo needs no API key.</p></div></div>}
            {screen === "standby" && <div className="screen-center standby-screen"><p>PLEASE STAND BY</p><span>TONIGHT&apos;S EPISODE IS IN PRODUCTION</span></div>}
            {screen === "recap" && <div className="recap-screen"><ScreenHeader right="PREVIOUSLY ON..." /><div className="recap-body"><p className="eyebrow">WARM-UP BEFORE WE ROLL TAPE</p><h2>{episode.title}</h2><label>{scene.recap?.[0]?.prompt}<input value={recap} onChange={(event) => setRecap(event.target.value)} placeholder="your answer" /></label>{recapFeedback && <p className="feedback">{recapFeedback}</p>}<div className="ingest-actions"><button className="secondary" onClick={checkRecap}>Check</button><button className="primary" onClick={startEpisode}>Now airing - CH 03</button></div></div></div>}
            {screen === "episode" && <div className={`episode-screen ${paused ? "is-paused" : ""}`}><ScreenHeader right={isCommercial ? "COMMERCIAL BREAK" : "THE TOON BLOCK"} /><div className={`scene-art scene-${scene.type}`}><SceneIllustration scene={scene} /></div><div className={`scene-copy ${isOutcome ? "has-refutation" : ""}`}><p className="speaker">{scene.speaker}</p>{captions && <p className="caption">{visibleLine}</p>}{isOutcome && <p className="refutation">↺ {scene.refutation}</p>}</div>{paused && <aside className="deep-dive"><p>PAUSED - DEEP DIVE</p><strong>{scene.deepDive ?? "Stay with the current scene, then answer the next beat."}</strong><button onClick={() => setPaused(false)}>Resume show</button></aside>}{isBeat && !paused && <section className={`beat-card ${isCommercial ? "commercial" : ""}`}><p>{isCommercial ? "SKIP THIS AD - answer a review question" : "THE SHOW NEEDS YOU"}</p><h2>{scene.beat!.question}</h2><div className="options">{scene.beat!.options.map((option, index) => <button key={option.id} onClick={() => choose(option.id)}><span>{String.fromCharCode(65 + index)}</span>{option.text}</button>)}</div></section>}{!isBeat && !isCliffhanger && !paused && <button onClick={advance} className="continue">{isOutcome ? "Rewind & retry" : "Continue"} ▶</button>}{isCliffhanger && <section className="cliffhanger"><p>TO BE CONTINUED</p><h2>{episode.cliffhanger.teaser}</h2><span>Next episode airs in {episode.cliffhanger.airsAfterHours} hours</span><button onClick={() => setScreen("guide")}>See TV guide</button></section>}</div>}
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
