type HostReaction = "celebrate" | "retry" | null;

type CharacterRigProps = {
  idle: string;
  talk: string;
  retry: string;
  narrating: boolean;
  reaction?: HostReaction;
  prompting?: boolean;
};

/** The supplied flat-cel plates include their own facial acting, so their pose
 * changes remain clean at every display size without a fragile face overlay.
 * While speaking the host holds its open-mouth plate and nods on a talking
 * cadence — a second, independently drawn mouth plate flickered because its
 * linework differs from the talk plate across the whole body, not just the lips. */
export function CharacterRig({ idle, talk, retry, narrating, reaction = null, prompting = false }: CharacterRigProps) {
  const retrying = reaction === "retry";

  return (
    <div className={`character-rig ${narrating ? "is-speaking" : ""} ${retrying ? "is-retrying" : ""} ${reaction === "celebrate" ? "is-celebrating" : ""} ${prompting ? "is-prompting" : ""}`}>
      <img src={retrying ? retry : idle} alt="" className="character-pose character-idle" />
      <img src={talk} alt="" className="character-pose character-talk" />
    </div>
  );
}
