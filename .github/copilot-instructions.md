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
│   ├── config.ts          # Game configuration constants
│   ├── math.ts            # Shared math/utility functions (clamp, randomInt, etc.)
│   ├── random.ts          # Seedable PRNG for reproducible randomness
│   ├── resources.ts       # Asset loading (images, sprites)
│   └── text.ts            # Shared text utilities (measureTextWidth, wrapText)
├── data/
│   └── buildings.ts       # Building definitions data
├── managers/
│   ├── GameManager.ts     # Top-level manager that owns sub-managers
│   ├── MapManager.ts      # Procedural map generation and storage
│   ├── ResourceManager.ts # Player resource state and operations
│   ├── RulerManager.ts    # Ruler data (name, age, popularity)
│   ├── StateManager.ts    # State data, building placement, technologies
│   └── TurnManager.ts     # Turn lifecycle and passive income
├── scenes/
│   ├── GameOverScene.ts   # Game over screen
│   ├── GameplayScene.ts   # Main gameplay scene
│   ├── InitializationScene.ts
│   └── MainMenu.ts        # Main menu screen
├── ui/
│   ├── constants/         # Z-layer constants
│   ├── css/               # Stylesheets
│   ├── elements/          # Reusable UI elements (buttons, popups, lists)
│   ├── popups/            # Specific popup implementations
│   ├── tooltip/           # Tooltip system
│   ├── utils/             # UI utilities
│   └── views/             # HUD views (map, resources, turns, buildings)
├── game.ts                # Game initialization and configuration
└── main.ts                # Application entry point
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
2. **ResourceManager** — Single source of truth for player resources (gold, materials, food, population)
3. **StateManager** — State data, building definitions/placement, technologies
4. **MapManager** — Procedural map generation with Voronoi zones
5. **RulerManager** — Ruler identity and stats
6. **TurnManager** — Turn lifecycle, action points, passive income

### Shared Utilities

Common functions live in `src/_common/` to avoid duplication:
- `src/_common/math.ts` — `clamp()`, `randomInt()`
- `src/_common/random.ts` — Seedable PRNG (`SeededRandom`)
- `src/_common/text.ts` — `measureTextWidth()`, `wrapText()`

### Data-Driven Definitions

Building definitions live in `src/data/buildings.ts`. The `StateBuildingId` type is derived from the definitions object keys, so adding a building only requires editing one file.

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
3. **Data-driven buildings**: Add new buildings in `src/data/buildings.ts` only
4. **Use Excalibur APIs**: Don't reinvent what Excalibur provides (Actor, Scene, etc.)
5. **Type safety**: Use TypeScript types, avoid `any` when possible
6. **Use SeededRandom**: For all random number generation
7. **Version counters**: Use manager version numbers for dirty-checking in UI views
8. **No tests**: This project does not have a test suite configured yet
9. **Build before deploy**: Always run `npm run build` to ensure TypeScript compiles successfully
