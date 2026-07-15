type CharacterRigProps = {
  idle: string;
  talk: string;
  narrating: boolean;
};

/**
 * The two supplied host plates already contain the intended facial poses.
 * Keep the rig intentionally simple: changing plates once per narration state
 * is considerably steadier than trying to place a procedural mouth over art
 * whose face moves between scenes.
 */
export function CharacterRig({ idle, talk, narrating }: CharacterRigProps) {
  return (
    <div className={`character-rig ${narrating ? "is-speaking" : ""}`}>
      <img src={idle} alt="" className="character-pose character-idle" />
      <img src={talk} alt="" className="character-pose character-talk" />
    </div>
  );
}
