# Scene Actions Skill

The text input hook reads `soul.md` as the stable scene-action contract for intent matching. This keeps natural-language scene commands out of React component code while making changes human-reviewable.

`soul.md` is not a scratchpad. Treat it as the skill's constitution: only stable, intentional scene-action rules belong there.

## Identity Files

- `soul.md`: non-negotiable scene-action contract. This is the only identity file imported by runtime code.
- `user.md`: human profile and working style for agents maintaining this skill. This gives the skill its personality without changing dispatch behavior.
- `memory.md`: curated durable facts about this skill, with source/date/validation metadata.

Keep these boundaries clean. Runtime behavior belongs in `soul.md`; style and review preferences belong in `user.md`; verified long-term facts belong in `memory.md`.

## Add An Object Alias

Add an entry under `## Objects` in `soul.md`:

```md
- id: treadmill
  aliases: treadmill | running machine
```

The `id` must match a scene registry object id. Aliases are matched as whole words or phrases.

## Add An Intent

Add an entry under `## Actions` in `soul.md`:

```md
- action: walkOn
  intents: walk
  requiredObjectAliases: treadmill | running machine
  defaultObjectId: treadmill
```

Supported fields:

- `action`: event action sent through `ai-scene-action`.
- `intents`: phrases that trigger this action.
- `defaultObjectId`: object id used when no object is mentioned.
- `requiredObjectAliases`: phrases that must also appear in the user text.
- `fallbackObjectAliases` and `fallbackObjectId`: use the fallback id when no object is resolved and one fallback phrase appears.
- `target: none`: dispatches an avatar-only action without an object id.

Action order matters. Put specific actions such as `sit_animation` before broader actions such as `sit`.

## Memory Boundary

Do not auto-merge untrusted LLM output, web content, tool output, or chat fragments into `soul.md`, `user.md`, or `memory.md`. Generate a proposed diff, review it, then merge intentionally.
