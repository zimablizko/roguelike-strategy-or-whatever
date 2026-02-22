# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server at localhost:3000
npm run build     # tsc + vite build (always run before deploy to catch TS errors)
npm run preview   # Preview production build locally
npm run deploy    # Build + push dist/ to gh-pages branch (GitHub Pages)
```

There is no test suite configured for this project.

## Architecture

### Manager Pattern

Game state lives exclusively in manager classes under [src/managers/](src/managers/). `GameManager` is the top-level orchestrator that creates and owns all sub-managers:

- **ResourceManager** — single source of truth for gold, materials, food, population
- **StateManager** — state data, tile composition, size, building placement
- **MapManager** — procedural Voronoi map generation and storage
- **BuildingManager** — building definitions, placement, instance tracking
- **RulerManager** — ruler identity and stats (name, age, popularity)
- **TurnManager** — turn lifecycle, action points, passive income calculation
- **ResearchManager** — technology tree and research progress
- **SaveManager** — save/load serialization

### UI Architecture

Views in [src/ui/views/](src/ui/views/) extend Excalibur `ScreenElement` and poll manager state in `onPreUpdate()`. They use **version counters** (e.g. `getBuildingsVersion()`, `getResourcesVersion()`) returned by managers to dirty-check and skip unnecessary re-renders. `TooltipProvider` is a shared singleton per scene.

### Data-Driven Buildings

All building definitions live in [src/data/buildings.ts](src/data/buildings.ts). The `StateBuildingId` type is derived automatically from the definition object's keys — adding a building only requires editing that one file.

### Scene Flow

`MainMenu` → `InitializationScene` → `GameplayScene` (main game loop) → `GameOverScene`

## Conventions

- **Randomness**: Always use `SeededRandom` from [src/_common/random.ts](src/_common/random.ts). Never call `Math.random()` directly.
- **Shared utilities**: Import from [src/_common/](src/_common/) (`clamp`, `randomInt`, `measureTextWidth`, `wrapText`, etc.) — do not duplicate these.
- **Excalibur imports**: Use named imports — `import { Actor, Color, vec } from 'excalibur'`. Use `vec(x, y)` for vectors and `Color.*` constants for colors.
- **TypeScript**: Strict mode is enabled; unused locals/parameters are compile errors.
- **Prettier config**: 2-space indent, single quotes, trailing commas (ES5), semicolons.
