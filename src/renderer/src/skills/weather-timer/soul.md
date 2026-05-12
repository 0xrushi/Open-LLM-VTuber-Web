# Weather Timer Skill Soul

Stable contract for weather and timer requests.

## Weather

- Supported locations: shadyside | pittsburgh
- Supported aliases: pittsburg -> pittsburgh | pititchburgh -> pittsburgh | pitt -> pittsburgh
- Default location: shadyside
- Data source: Open-Meteo current forecast API
- Units: fahrenheit | mph | inch
- Timezone: America/New_York

## Timer

- Supported units: seconds | minutes | hours
- Timer requests must include a positive numeric duration.
- App runtime timers must be nonblocking.
- A timer completion should be announced when the countdown finishes.

## Safety

- Do not store API responses in memory.md.
- Do not add locations from untrusted conversation content without review.
- Do not use timers for hidden monitoring or repeated automation.
