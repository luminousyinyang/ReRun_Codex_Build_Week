import type { Scene } from "@/lib/episode";

type SceneIllustrationProps = { scene: Scene };

const visualFallbacks = {
  sunlight: "/assets/scenes-v2/sunlight-vault-v2.png",
  vault: "/assets/scenes-v2/atp-vault-v2.png",
  commercial: "/assets/scenes-v2/review-break-v2.png",
  cliffhanger: "/assets/scenes-v2/calvin-storm-v2.png",
} as const;

const performancePlates: Record<string, { idle: string; talk: string }> = {
  s1: {
    idle: "/assets/motion/professor-paws-v2.png",
    talk: "/assets/motion/professor-paws-v2.png",
  },
  s2: {
    idle: "/assets/motion/professor-paws-v2.png",
    talk: "/assets/motion/professor-paws-v2.png",
  },
  "s2-outcome": {
    idle: "/assets/motion/professor-paws-v2.png",
    talk: "/assets/motion/professor-paws-v2.png",
  },
  "s2-variant": {
    idle: "/assets/motion/professor-paws-v2.png",
    talk: "/assets/motion/professor-paws-v2.png",
  },
  s3: {
    idle: "/assets/motion/professor-paws-v2.png",
    talk: "/assets/motion/professor-paws-v2.png",
  },
  s4: {
    idle: "/assets/motion/professor-paws-v2.png",
    talk: "/assets/motion/professor-paws-v2.png",
  },
  "s4-outcome": {
    idle: "/assets/motion/professor-paws-v2.png",
    talk: "/assets/motion/professor-paws-v2.png",
  },
  "s4-variant": {
    idle: "/assets/motion/professor-paws-v2.png",
    talk: "/assets/motion/professor-paws-v2.png",
  },
  commercial: {
    idle: "/assets/motion/professor-paws-v2.png",
    talk: "/assets/motion/professor-paws-v2.png",
  },
};

const defaultHost = {
  idle: "/assets/motion/professor-paws-v2.png",
  talk: "/assets/motion/professor-paws-v2.png",
};

function resolveVisual(scene: Scene) {
  if (scene.visualAsset) return scene.visualAsset;
  if (scene.type === "commercial") return visualFallbacks.commercial;
  if (scene.type === "cliffhanger") return visualFallbacks.cliffhanger;
  if (scene.type === "branch_outcome" || /vault|canister|energy/i.test(scene.background)) return visualFallbacks.vault;
  return visualFallbacks.sunlight;
}

export function SceneIllustration({ scene }: SceneIllustrationProps) {
  const visual = resolveVisual(scene);
  const performance = performancePlates[scene.id] ?? (scene.type === "cliffhanger" ? undefined : defaultHost);
  const shot = scene.beat ? "decision" : scene.type === "commercial" ? "review" : scene.type === "branch_outcome" ? "consequence" : scene.type === "cliffhanger" ? "storm" : /vault|canister|energy/i.test(scene.background) ? "discovery" : "teaching";

  return (
    <div className={`generated-scene generated-scene-${scene.type} shot-${shot} ${performance ? "has-performance" : ""}`} aria-hidden="true">
      <img src={visual} alt="" className="scene-backdrop" />
      <img src={visual} alt="" className="scene-image" />
      <div className="scene-light-rays"><i /><i /><i /></div>
      <div className="scene-haze"><i /><i /><i /></div>
      <div className="scene-vignette" />
      <div className="scene-particles">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      {performance && (
        <div className="character-rig">
          <img src={performance.idle} alt="" className="character-pose character-idle" />
          <img src={performance.talk} alt="" className="character-pose character-talk" />
        </div>
      )}
      {scene.type === "cliffhanger" && <div className="scene-storm"><i /><i /></div>}
      {scene.type === "branch_outcome" && <div className="scene-alarm" />}
    </div>
  );
}
