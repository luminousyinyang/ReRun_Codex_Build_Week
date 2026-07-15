# Design system

## Reference hierarchy

Use `ReRun Player.dc.html` as the behavioral source of truth: power, ingest, recap, scene/beat, consequence, rewind, commercial, cliffhanger, remote, captions, and mute. Use `ReRun-print-9ti603.dc.html` for richer screen treatment and layout polish. The supplied concept board is exploratory, not a competing interaction contract.

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| CRT black | `#0A0A12` | tube and application background |
| phosphor green | `#33FF66` | OSD text and enabled utility controls |
| test-card amber | `#FFB000` | primary actions, active beats, warm highlight |
| broadcast blue | `#1B4FD8` | system/loading states |
| signal red | `#E5484D` | recording dot, error/consequence accent |
| walnut | `#5C3A21` | cabinet and remote body |

Typography: **VT323** for OSD/utility labels, **Righteous** (used sparingly) for title cards, and **Space Grotesk** for body/interface copy. Keep sufficient contrast; scanlines and glow are decorative layers, never the only indicator of state.

## Layout

- Desktop: TV centered in a dim room, remote docked to the right and always available.
- Mobile: TV is full width; remote becomes a bottom thumb-zone bar with pause, rewind, channel, and call-in controls.
- Scene UI: subtitles remain clear over imagery; beat options use large, separate targets; never place critical controls only inside animation.
- Scene art: use original, richly layered 16:9 bitmap scenes with a deliberately calmer/darker lower third for captions. `public/assets/scenes/` is the P0 visual pack; generation prompts must prohibit visible text, logos, third-party characters, and imitation of named shows.

## Motion and sound

Use CRT bloom on power-on, a brief static burst on channel change, VHS tracking during rewind, and restrained applause/buzzer feedback. Scene art may use a slow camera settle only. Respect `prefers-reduced-motion`: remove static, pans, and distortion while preserving the state transition. Sound is additive; captions and visible state changes carry all essential feedback.

### Scene performance layers

Do not treat a generated background as an animated show. A P0 scene may stack four deterministic local layers: a clean background plate, transparent character pose assets, lightweight atmosphere (spores/light motes), and a state-aware camera/reaction treatment. Narrative scenes alternate between an idle and explaining pose; beats hold a steadier performance; wrong-answer outcomes may add a short camera jolt and alarm treatment. The player must freeze these decorative loops when paused and respect reduced-motion preferences. Do not make learning progress depend on an animation completing.

## Error language

Use diegetic but clear system copy: “Technical difficulties - this episode could not be generated. Watch the bundled demo instead.” Do not use a themed wrapper to obscure the action the learner must take.
