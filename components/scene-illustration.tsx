import type { Scene } from "@/lib/episode";
import type { SyntheticEvent } from "react";
import { CharacterRig } from "@/components/character-rig";

type SceneIllustrationProps = {
  scene: Scene;
  narrating?: boolean;
  reaction?: "celebrate" | "retry" | null;
  questionReady?: boolean;
  visualOverride?: string;
  host?: { idle: string; talk: string; retry: string };
};

const visualFallbacks = {
  sunlight: "/assets/scenes-v3/sunlight-vault-v3.jpg",
  vault: "/assets/scenes-v3/atp-vault-v4.jpg",
  commercial: "/assets/scenes-v3/review-break-v3.jpg",
  cliffhanger: "/assets/scenes-v3/calvin-storm-v5.jpg",
} as const;

const hostPlates = {
  idle: "/assets/motion/professor-paws-flat-idle.png",
  talk: "/assets/motion/professor-paws-flat-talk.png",
  retry: "/assets/motion/professor-paws-flat-retry-v2.png",
};

function resolveVisual(scene: Scene) {
  // `visualAsset` is model-authored metadata for live episodes. Only trust a
  // known public asset path; labels such as `toon_vitamin_d_fact_cards` are not
  // URLs and would otherwise create a broken localhost image request.
  if (scene.visualAsset?.startsWith("/assets/")) return scene.visualAsset;
  if (scene.type === "commercial") return visualFallbacks.commercial;
  if (scene.type === "cliffhanger") return visualFallbacks.cliffhanger;
  if (scene.type === "branch_outcome" || /vault|canister|energy/i.test(scene.background)) return visualFallbacks.vault;
  return visualFallbacks.sunlight;
}

export function SceneIllustration({ scene, narrating = false, reaction = null, questionReady = false, visualOverride, host }: SceneIllustrationProps) {
  const fallbackVisual = resolveVisual(scene);
  const visual = visualOverride ?? fallbackVisual;
  const restoreFallback = (event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src.endsWith(fallbackVisual)) return;
    event.currentTarget.src = fallbackVisual;
  };
  const performance = scene.type === "cliffhanger" ? undefined : host ?? hostPlates;
  const shot = scene.beat ? "decision" : scene.type === "commercial" ? "review" : scene.type === "branch_outcome" ? "consequence" : scene.type === "cliffhanger" ? "storm" : /vault|canister|energy/i.test(scene.background) ? "discovery" : "teaching";

  return (
    <div className={`generated-scene generated-scene-${scene.type} shot-${shot} ${performance ? "has-performance" : ""}`} aria-hidden="true">
      <img src={visual} alt="" className="scene-backdrop" onError={restoreFallback} />
      <img src={visual} alt="" className="scene-image" onError={restoreFallback} />
      <div className="scene-depth-slice scene-depth-sky"><img src={visual} alt="" onError={restoreFallback} /></div>
      <div className="scene-depth-slice scene-depth-mid"><img src={visual} alt="" onError={restoreFallback} /></div>
      <div className="scene-depth-slice scene-depth-foreground-plate"><img src={visual} alt="" onError={restoreFallback} /></div>
      <div className="scene-foreground" />
      <div className="scene-light-rays"><i /><i /><i /></div>
      <div className="scene-haze"><i /><i /><i /></div>
      <div className="scene-vignette" />
      <div className="scene-particles">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      {performance && (
        <CharacterRig idle={performance.idle} talk={performance.talk} retry={performance.retry} narrating={narrating} reaction={reaction} prompting={questionReady} />
      )}
      {scene.type === "cliffhanger" && <div className="scene-storm"><i /><i /></div>}
      {scene.type === "branch_outcome" && <div className="scene-alarm" />}
    </div>
  );
}
