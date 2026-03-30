# GitHub Copilot Instructions for Roguelike Strategy Game

## Project Overview

This is a roguelike strategy game built with **Excalibur.js** game engine and bundled with **Vite**. The project uses TypeScript and follows a **Manager-based** architectural pattern with dedicated UI views.

## Tech Stack

- **Game Engine**: Excalibur.js v0.32.0
- **Build Tool**: Vite v7.3.1
- **Language**: TypeScript v5.9.3
- **Module System**: ES Modules
- **Target**: ES2020

## Project Structure

```
src/
├── _common/
│   ├── buildings-sprites.ts # Building sprite mappings
│   ├── config.ts            # Game configuration constants
│   ├── icons.ts             # Icon definitions
│   ├── math.ts              # Shared math/utility functions (clamp, randomInt, etc.)
│   ├── random.ts            # Seedable PRNG for reproducible randomness
│   ├── resources.ts         # Asset loading (images, sprites)
│   ├── text.ts              # Shared text utilities (measureTextWidth, wrapText)
│   └── models/              # TypeScript type/interface definitions
│       ├── building-manager.models.ts
│       ├── buildings.models.ts
│       ├── game-setup.models.ts
│       ├── game.models.ts
│       ├── log.models.ts
│       ├── map.models.ts
│       ├── military.models.ts
│       ├── politics.models.ts
│       ├── random-events.models.ts
│       ├── rare-resource.models.ts
│       ├── research-manager.models.ts
│       ├── researches.models.ts
│       ├── resource.models.ts
│       ├── ruler-traits.models.ts
│       ├── ruler.models.ts
│       ├── save.models.ts
│       ├── state.models.ts
│       ├── tooltip.models.ts
│       ├── turn.models.ts
│       └── ui.models.ts
├── data/
│   ├── buildings/           # Building definitions & passive income
│   ├── gameSetup/           # Game setup: lore, map sizes, ruler names, state names
│   ├── military/            # Unit definitions, commands, statuses, settings
│   ├── politicalRequests/   # Political entities & request definitions
│   ├── randomEvents/        # Random event definitions & settings
│   ├── rareResources/       # Rare resource definitions
│   ├── researches/          # Research definitions & tech trees
│   └── traits/              # Ruler trait definitions
├── managers/
│   ├── BuildingManager.ts   # Building placement and management
│   ├── GameLogManager.ts    # Game log/event history
│   ├── GameManager.ts       # Top-level manager that owns sub-managers
│   ├── MapManager.ts        # Procedural map generation and storage
│   ├── MilitaryManager.ts   # Military units and combat
│   ├── PoliticsManager.ts   # Political system and requests
│   ├── RandomEventManager.ts # Random event triggers
│   ├── ResearchManager.ts   # Research/tech tree progression
│   ├── ResourceManager.ts   # Player resource state and operations
│   ├── RulerManager.ts      # Ruler data (name, age, traits)
│   ├── SaveManager.ts       # Save/load game state
│   ├── StateManager.ts      # State data, technologies
│   └── TurnManager.ts       # Turn lifecycle and passive income
├── scenes/
│   ├── GameOverScene.ts     # Game over screen
│   ├── GameplayScene.ts     # Main gameplay scene
│   ├── index.ts             # Scene exports
│   ├── InitializationScene.ts
│   └── MainMenu.ts          # Main menu screen
├── ui/
│   ├── constants/           # Z-layer constants
│   ├── css/                 # Stylesheets
│   ├── elements/            # Reusable UI elements (buttons, popups, lists)
│   ├── logs/                # Game log UI components
│   ├── popups/              # Specific popup implementations
│   ├── tooltip/             # Tooltip system
│   ├── utils/               # UI utilities
│   └── views/               # HUD views (map, resources, turns, buildings)
├── game.ts                  # Game initialization and configuration
└── main.ts                  # Application entry point
```

## Development Commands

- **Development server**: `npm run dev` (runs on port 3000)
- **Build**: `npm run build` (runs TypeScript compiler then Vite build)
- **Preview**: `npm run preview` (preview production build)
- **Deploy**: `npm run deploy` (build and deploy to GitHub Pages)

## Architecture Guidelines

### Manager Pattern

The project uses dedicated manager classes for game state:

1. **GameManager** — Top-level orchestrator that creates and owns all sub-managers
2. **BuildingManager** — Building placement and management
3. **GameLogManager** — Game log and event history
4. **MapManager** — Procedural map generation with Voronoi zones
5. **MilitaryManager** — Military units and combat
6. **PoliticsManager** — Political system and requests
7. **RandomEventManager** — Random event triggers
8. **ResearchManager** — Research/tech tree progression
9. **ResourceManager** — Single source of truth for player resources (gold, materials, food, population)
10. **RulerManager** — Ruler identity and stats (name, age, traits)
11. **SaveManager** — Save/load game state
12. **StateManager** — State data, technologies
13. **TurnManager** — Turn lifecycle, action points, passive income

### Shared Utilities

Common functions live in `src/_common/` to avoid duplication:

- `src/_common/math.ts` — `clamp()`, `randomInt()`
- `src/_common/random.ts` — Seedable PRNG (`SeededRandom`)
- `src/_common/text.ts` — `measureTextWidth()`, `wrapText()`

### Data-Driven Definitions

Game data is organized in `src/data/` subdirectories, each with an `index.ts` barrel export and a `helpers.ts` for related utilities:

- **buildings/** — Building definitions and passive income
- **gameSetup/** — Lore, map sizes, ruler names, state names/prehistory
- **military/** — Unit definitions, commands, statuses, settings
- **politicalRequests/** — Political entities and request definitions
- **randomEvents/** — Random event definitions and settings
- **rareResources/** — Rare resource definitions
- **researches/** — Research definitions and tech trees
- **traits/** — Ruler trait definitions

Type IDs are typically derived from definition object keys, so adding a new entry only requires editing the relevant data file.

### UI Architecture

- **Views** extend Excalibur `ScreenElement` and poll manager state in `onPreUpdate()`
- Dirty-checking uses version counters (e.g. `getBuildingsVersion()`, `getResourcesVersion()`) to skip re-renders
- `TooltipProvider` is a shared singleton per scene for tooltip rendering

### Coding Conventions

- **TypeScript**: Use strict type checking (enabled in tsconfig.json)
- **Imports**: Use named imports from Excalibur (e.g., `import { Actor, Color, vec } from 'excalibur'`)
- **Comments**: Use JSDoc comments for classes, functions, and complex logic
- **Vector Creation**: Use `vec(x, y)` helper from Excalibur
- **Color Creation**: Use `Color.Blue`, `Color.Red` constants or hex strings
- **Randomness**: Use `SeededRandom` from `src/_common/random.ts` — never call `Math.random()` directly

## Build Configuration

- **TypeScript**: Strict mode enabled, no unused locals/parameters allowed
- **Vite**: ES modules, bundler mode, development port 3000
- **Base Path**: Configured for GitHub Pages deployment (`/<repo-name>/`)

## Deployment

The project auto-deploys to GitHub Pages via GitHub Actions on pushes to main/master branch.

## Important Notes for Copilot

1. **Follow Manager pattern**: Keep game data in managers, UI in views
2. **Use shared utilities**: Import from `src/_common/` — do not duplicate `clamp`, `randomInt`, etc.
3. **Data-driven definitions**: Add new game data in the appropriate `src/data/<domain>/` subdirectory
4. **Use Excalibur APIs**: Don't reinvent what Excalibur provides (Actor, Scene, etc.)
5. **Type safety**: Use TypeScript types, avoid `any` when possible
6. **Use SeededRandom**: For all random number generation
7. **Version counters**: Use manager version numbers for dirty-checking in UI views
8. **No tests**: This project does not have a test suite configured yet
9. **Build before deploy**: Always run `npm run build` to ensure TypeScript compiles successfully
