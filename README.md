# Indonesian Retirement Planning

A retirement planning application tailored to the Indonesian context.

## Development workflow

`main` is the canonical, stable branch. Product work is never committed
directly to `main`; each stage is developed on its own feature branch created
from the latest accepted `main`, reviewed, and then merged back.

| Stage | Branch                                   |
| ----- | ---------------------------------------- |
| 1     | `feature/stage-1-foundation`             |
| 2     | `feature/stage-2-financial-profile`      |
| 3     | `feature/stage-3-cost-projection`        |
| 4     | `feature/stage-4-retirement-simulation`  |
| 5     | `feature/stage-5-scenario-planning`      |
| 6     | `feature/stage-6-ai-advisor`             |
| 7     | `feature/stage-7-production-polish`      |

Feature branches are never chained: each one starts from `main` after the
previous stage has been merged.
