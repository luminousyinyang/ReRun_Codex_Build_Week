import type { Scene } from "@/lib/episode";

type SceneIllustrationProps = { scene: Scene };

const visualFallbacks = {
  sunlight: "/assets/scenes/sunlight-vault.png",
  vault: "/assets/scenes/atp-vault.png",
  commercial: "/assets/scenes/review-break.png",
  cliffhanger: "/assets/scenes/calvin-storm.png",
} as const;

function resolveVisual(scene: Scene) {
  if (scene.visualAsset) return scene.visualAsset;
  if (scene.type === "commercial") return visualFallbacks.commercial;
  if (scene.type === "cliffhanger") return visualFallbacks.cliffhanger;
  if (scene.type === "branch_outcome" || /vault|canister|energy/i.test(scene.background)) return visualFallbacks.vault;
  return visualFallbacks.sunlight;
}

export function SceneIllustration({ scene }: SceneIllustrationProps) {
  return (
    <div className={`generated-scene generated-scene-${scene.type}`} aria-hidden="true">
      <img src={resolveVisual(scene)} alt="" className="scene-image" />
      <div className="scene-vignette" />
      {scene.type === "branch_outcome" && <div className="scene-alarm" />}
    </div>
  );
}
