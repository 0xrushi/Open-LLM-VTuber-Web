# Weather Timer Skill Memory

Curated durable facts for the weather/timer skill.

## Durable Facts

- fact: The executable weather/timer skill is `src/open_llm_vtuber/skills/weather_timer/skill.py`.
  source: implementation
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: none

- fact: Weather currently supports `shadyside` and `pittsburgh`.
  source: `LOCATION_COORDS`
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: review when location needs change

- fact: Common Pittsburgh aliases include `pittsburg`, `pititchburgh`, and `pitt`.
  source: `LOCATION_ALIASES`
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: review when location parsing changes

- fact: Timer handling in the app is nonblocking; the CLI helper `countdown_timer` is blocking.
  source: implementation
  dateAdded: 2026-05-11
  lastValidated: 2026-05-11
  expiry: none

## Review Rule

Do not auto-append weather API outputs, tool logs, or arbitrary chat fragments to this file.
