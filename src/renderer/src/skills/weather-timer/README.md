# Weather Timer Skill

This skill provides app-local weather and one-shot timer behavior.

Runtime code:

- `src/open_llm_vtuber/skills/weather_timer/skill.py`

Identity files:

- `soul.md`: stable tool contract and safety boundaries.
- `user.md`: response style and working preferences.
- `memory.md`: curated durable facts.

Weather uses Open-Meteo for current conditions. Timers are queued asynchronously by the backend conversation path so the app does not block while counting down.
