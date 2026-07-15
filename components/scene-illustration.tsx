import type { Scene } from "@/lib/episode";
import { CharacterRig } from "@/components/character-rig";

type SceneIllustrationProps = {
  scene: Scene;
  narrating?: boolean;
  reaction?: "celebrate" | "retry" | null;
  questionReady?: boolean;
  visualOverride?: string;
};

const visualFallbacks = {
  sunlight: "/assets/scenes-v3/sunlight-vault-v3.jpg",
  vault: "/assets/scenes-v3/atp-vault-v3.jpg",
  commercial: "/assets/scenes-v3/review-break-v3.jpg",
  cliffhanger: "/assets/scenes-v3/calvin-storm-v3.jpg",
} as const;

const hostPlates = {
  idle: "/assets/motion/professor-paws-flat-idle.png",
  talk: "/assets/motion/professor-paws-flat-talk.png",
  retry: "/assets/motion/professor-paws-flat-retry.png",
};

function resolveVisual(scene: Scene) {
  if (scene.visualAsset) return scene.visualAsset;
  if (scene.type === "commercial") return visualFallbacks.commercial;
  if (scene.type === "cliffhanger") return visualFallbacks.cliffhanger;
  if (scene.type === "branch_outcome" || /vault|canister|energy/i.test(scene.background)) return visualFallbacks.vault;
  return visualFallbacks.sunlight;
}

export function SceneIllustration({ scene, narrating = false, reaction = null, questionReady = false, visualOverride }: SceneIllustrationProps) {
  const visual = visualOverride ?? resolveVisual(scene);
  const performance = scene.type === "cliffhanger" ? undefined : hostPlates;
  const shot = scene.beat ? "decision" : scene.type === "commercial" ? "review" : scene.type === "branch_outcome" ? "consequence" : scene.type === "cliffhanger" ? "storm" : /vault|canister|energy/i.test(scene.background) ? "discovery" : "teaching";

  return (
    <div className={`generated-scene generated-scene-${scene.type} shot-${shot} ${performance ? "has-performance" : ""}`} aria-hidden="true">
      <img src={visual} alt="" className="scene-backdrop" />
      <img src={visual} alt="" className="scene-image" />
      <div className="scene-depth-slice scene-depth-sky"><img src={visual} alt="" /></div>
      <div className="scene-depth-slice scene-depth-mid"><img src={visual} alt="" /></div>
      <div className="scene-depth-slice scene-depth-foreground-plate"><img src={visual} alt="" /></div>
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
