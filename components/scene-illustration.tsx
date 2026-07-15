import type { Scene } from "@/lib/episode";

type SceneIllustrationProps = { scene: Scene };

const visualFallbacks = {
  sunlight: "/assets/scenes/sunlight-vault.png",
  vault: "/assets/scenes/atp-vault.png",
  commercial: "/assets/scenes/review-break.png",
  cliffhanger: "/assets/scenes/calvin-storm.png",
} as const;

const performancePlates: Record<string, { plate: string; idle: string; talk: string }> = {
  s1: {
    plate: "/assets/motion/sunlight-vault-plate.png",
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  s2: {
    plate: "/assets/motion/atp-vault-plate.png",
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  "s2-outcome": {
    plate: "/assets/motion/atp-vault-plate.png",
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  "s2-variant": {
    plate: "/assets/motion/atp-vault-plate.png",
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  s3: {
    plate: "/assets/motion/atp-vault-plate.png",
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  s4: {
    plate: "/assets/motion/atp-vault-plate.png",
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  "s4-outcome": {
    plate: "/assets/motion/atp-vault-plate.png",
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  "s4-variant": {
    plate: "/assets/motion/atp-vault-plate.png",
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
  commercial: {
    plate: "/assets/motion/review-break-plate.png",
    idle: "/assets/motion/professor-paws-idle.png",
    talk: "/assets/motion/professor-paws-talk.png",
  },
};

function resolveVisual(scene: Scene) {
  if (scene.visualAsset) return scene.visualAsset;
  if (scene.type === "commercial") return visualFallbacks.commercial;
  if (scene.type === "cliffhanger") return visualFallbacks.cliffhanger;
  if (scene.type === "branch_outcome" || /vault|canister|energy/i.test(scene.background)) return visualFallbacks.vault;
  return visualFallbacks.sunlight;
}

export function SceneIllustration({ scene }: SceneIllustrationProps) {
  const performance = performancePlates[scene.id];

  return (
    <div className={`generated-scene generated-scene-${scene.type} ${performance ? "has-performance" : ""}`} aria-hidden="true">
      <img src={performance?.plate ?? resolveVisual(scene)} alt="" className="scene-image" />
      <div className="scene-vignette" />
      <div className="scene-particles">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
      {performance && (
        <div className="character-rig">
          <img src={performance.idle} alt="" className="character-pose character-idle" />
          <img src={performance.talk} alt="" className="character-pose character-talk" />
        </div>
      )}
      {scene.type === "branch_outcome" && <div className="scene-alarm" />}
    </div>
  );
}
