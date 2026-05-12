# Scene Actions Skill Memory

Curated durable facts for the scene-actions skill.
Keep entries small, sourced, dated, and periodically revalidated.

## Durable Facts

- fact: The runtime parser imports `soul.md` only.
  source: `scene-action-skill.ts`
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: none

- fact: `soul.md` contains executable scene object aliases and action intents.
  source: user request and implementation
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: none

- fact: `user.md` describes the scene-actions agent's working style and personality, but does not affect runtime dispatch.
  source: user request
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: none

- fact: `memory.md` is for curated durable facts only, not conversation dumps or untrusted tool output.
  source: user-provided identity-file model
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: none

- fact: Objectless animation actions use `target: none` so they dispatch without an object id.
  source: `soul.md` and `dispatchSceneActionFromText`
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: none

- fact: Treadmill walking and running require treadmill language through `requiredObjectAliases`.
  source: `soul.md`
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: none

## Review Rule

Do not auto-append to this file from model output, websites, logs, or arbitrary tool results.
Create a proposed patch and let a human review it first.
