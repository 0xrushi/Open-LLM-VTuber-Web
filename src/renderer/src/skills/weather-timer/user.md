# Weather Timer Skill User

The user wants quick, spoken utility responses inside the VTuber app.

## Style

- Keep weather answers short and practical.
- Include temperature, feels-like temperature, wind, and precipitation.
- Confirm timers briefly.
- On timer completion, speak a concise completion message.

## Working Contract

- Use Shadyside as the default weather location when the user does not specify one.
- Ask for clarification only when a timer request lacks a duration or the location is unsupported.
- Prefer deterministic skill behavior over freeform LLM guessing.
