# Scene Flow Reference

Read this file before running the smoke test. It documents the repo-specific startup path that matters for reproducible testing.

## Current Entry Behavior

- `npm run dev` starts Vite on `http://localhost:3000/` via `vite.config.js`.
- In dev mode, `src/_common/config.ts` sets `DEBUG` from `import.meta.env.DEV`.
- `src/game.ts` uses that flag to start the app in the `preparation` scene instead of `main-menu`.

Implication: the default dev smoke test should expect the preparation screen first, not the main menu.

## Preparation Scene Expectations

Relevant file: `src/scenes/InitializationScene.ts`

- `Enter` queues either a new game or continue flow for the selected slot, then transitions to `gameplay`.
- `Delete` clears the selected save slot.
- `1`, `2`, and `3` switch save slots.
- The screen title is `New Campaign Preparation`.

Important pitfall: save slots persist in browser `localStorage` under `roguelike_strategy_save_slots_v1`. If slot `1` is already used, pressing `Enter` continues that save instead of starting a fresh campaign.

## Gameplay Entry Expectations

Relevant file: `src/scenes/GameplayScene.ts`

- A fresh game opens an introduction popup before normal gameplay interaction.
- That popup is implemented in `src/ui/popups/IntroductionLorePopup.ts`.
- The popup closes via the `Begin Reign` button, and `Esc` also closes the top popup through `GameplayScene.closeTopPopup()`.

Implication: if the map and HUD are visible but input feels blocked, dismiss the intro popup before treating it as a regression.

## Useful Gameplay Hotkeys

- `Space`: end turn
- `S`: state popup
- `X`: ruler popup
- `R`: research popup
- `T`: military popup
- `H`: log popup
- `M`: menu popup
- `D`: debug popup
- `Esc`: close the top popup or cancel placement

## Where to Start Debugging

- Boot/startup failure: `src/main.ts`, `src/game.ts`, `src/_common/resources.ts`
- Preparation-only failure: `src/scenes/InitializationScene.ts`
- Gameplay-only failure: `src/scenes/GameplayScene.ts`
- Save/load oddities: `src/managers/SaveManager.ts`
