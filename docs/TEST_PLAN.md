# Test plan

## Automated checks

| Layer | Cases | Acceptance |
| --- | --- | --- |
| Schema | bundled fixture parses; unknown scene type, duplicate ID, missing route, multiple correct choices, and unsafe/invalid branch fail with useful diagnostics | only a validated `EpisodeSpec` reaches the player |
| Beat engine | correct answer advances; incorrect answer shows consequence; variant re-ask loops until correct; commercial advances only when correct | no dead ends or accidental bypasses |
| Rewind | first and second levels select simpler copy; failed live rewind retains original copy | factual content is never blank or replaced by error text |
| Demo integration | no environment variables; complete fixture path end to end | no external network request is required |
| API boundaries | input length/type checks, structured response parsing, repair retry, unavailable state | raw model output and secrets never reach client |

## Accessibility and visual checks

- Navigate the entire demo with keyboard only; verify a visible focus indicator and logical order.
- Check captions, mute, error states, and answer feedback without audio.
- Test 320px mobile width and desktop layouts; remote controls remain visible and usable.
- Test `prefers-reduced-motion`; static, panning, and VHS effects stop while state changes remain understandable.
- Run automated contrast/accessibility checks and manually inspect amber/green/red use against CRT black.

## Manual judge-flow test

1. Fresh clone, no `.env.local`.
2. Install, start, and build using the README instructions.
3. Complete every judge-guide step in a fresh browser profile.
4. Confirm demo mode has no account, API key, or wait dependency.
5. Test the deployed URL on desktop and mobile.
6. Compare README, video script, Devpost description, and `CODEX_LOG.md` to the shipped behavior; remove or correct every unverified claim.

## Release gate

Do not deploy or submit with a failing schema test, broken wrong-answer path, inaccessible primary control, or a live-mode error that does not lead to demo mode.
