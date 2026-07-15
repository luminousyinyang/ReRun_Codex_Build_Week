import type { Scene } from "@/lib/episode";
import { CharacterRig } from "@/components/character-rig";

type SceneIllustrationProps = { scene: Scene; narrating?: boolean; visualOverride?: string };

const visualFallbacks = {
  sunlight: "/assets/scenes-v3/sunlight-vault-v3.jpg",
  vault: "/assets/scenes-v3/atp-vault-v3.jpg",
  commercial: "/assets/scenes-v3/review-break-v3.jpg",
  cliffhanger: "/assets/scenes-v3/calvin-storm-v3.jpg",
} as const;

const performancePlates: Record<string, { idle: string; talk: string }> = {
  s1: {
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  s2: {
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  "s2-outcome": {
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  "s2-variant": {
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  s3: {
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  s4: {
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  "s4-outcome": {
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  "s4-variant": {
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  commercial: {
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
};

const defaultHost = {
  idle: "/assets/motion/professor-paws-idle.png",
  talk: "/assets/motion/professor-paws-talk.png",
};

function resolveVisual(scene: Scene) {
  if (scene.visualAsset) return scene.visualAsset;
  if (scene.type === "commercial") return visualFallbacks.commercial;
  if (scene.type === "cliffhanger") return visualFallbacks.cliffhanger;
  if (scene.type === "branch_outcome" || /vault|canister|energy/i.test(scene.background)) return visualFallbacks.vault;
  return visualFallbacks.sunlight;
}

export function SceneIllustration({ scene, narrating = false, visualOverride }: SceneIllustrationProps) {
  const visual = visualOverride ?? resolveVisual(scene);
  const performance = performancePlates[scene.id] ?? (scene.type === "cliffhanger" ? undefined : defaultHost);
  const shot = scene.beat ? "decision" : scene.type === "commercial" ? "review" : scene.type === "branch_outcome" ? "consequence" : scene.type === "cliffhanger" ? "storm" : /vault|canister|energy/i.test(scene.background) ? "discovery" : "teaching";

  return (
    <div className={`generated-scene generated-scene-${scene.type} shot-${shot} ${performance ? "has-performance" : ""}`} aria-hidden="true">
      <img src={visual} alt="" className="scene-backdrop" />
      <img src={visual} alt="" className="scene-image" />
      <div className="scene-foreground" />
      <div className="scene-light-rays"><i /><i /><i /></div>
      <div className="scene-haze"><i /><i /><i /></div>
      <div className="scene-vignette" />
      <div className="scene-particles">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      {performance && (
        <CharacterRig idle={performance.idle} talk={performance.talk} narrating={narrating} />
      )}
      {scene.type === "cliffhanger" && <div className="scene-storm"><i /><i /></div>}
      {scene.type === "branch_outcome" && <div className="scene-alarm" />}
    </div>
  );
}
