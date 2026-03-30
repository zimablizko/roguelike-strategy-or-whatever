---
name: test-game-smoke
description: Launch the local Excalibur/Vite game, walk the startup and preparation-to-gameplay flow, check for runtime errors, and fix obvious breakage. Use when Codex needs to smoke-test this repo in the browser, verify scene transitions, investigate startup/gameplay regressions, or reproduce bugs by running the game locally.
---

# Test the Local Game

Smoke-test the game by running the dev server, opening the local page, walking the main scene transition, and fixing breakage when errors appear.

This repo now includes a Playwright smoke harness for the core startup and preparation-to-gameplay flow. Prefer the automated harness first. Fall back to manual live-browser checking only when the automated path is unavailable or insufficient for the bug.

## Use the Bundled Resources

- Use `scripts/start-dev-session.ps1` to start or reuse the Vite dev server and wait for the local page to respond.
- Read `references/scene-flow.md` before testing. It captures the repo-specific flow, debug-mode behavior, save-slot pitfalls, and the intro popup that can block gameplay input.
- Prefer `npm run test:smoke` for the default smoke path. Use `npm run test:smoke:headed` when you need to watch the browser interaction live.

## Workflow

### 1. Verify the Expected Entry Path

Confirm the current app entry path before testing:

- `package.json`
- `vite.config.js`
- `src/_common/config.ts`
- `src/game.ts`

In this repo, `npm run dev` uses Vite on port `3000`, and dev mode starts at the `preparation` scene because `CONFIG.DEBUG` is enabled.

### 2. Run the Automated Smoke Harness

Run:

```powershell
npm run test:smoke
```

This uses Playwright with Microsoft Edge on port `3001`, starts Vite automatically, clears the game save slot localStorage key for a clean run, verifies the app reaches `preparation`, and then verifies it reaches `gameplay` without recorded runtime issues.

On a passing run, the harness also writes step screenshots into that test run's output folder under `test-results/`, including:

- `step-1-splash.png`
- `step-2-preparation.png`
- `step-3-gameplay.png`

If you need to inspect the interaction visually, run:

```powershell
npm run test:smoke:headed
```

Playwright writes pass and failure artifacts to `test-results/` and summary output to `playwright-report/`.

### 3. Start a Manual Local Session When Needed

Run:

```powershell
C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File .\.agents\skills\test-game-smoke\scripts\start-dev-session.ps1
```

If opening a browser is appropriate in the current environment, run:

```powershell
C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File .\.agents\skills\test-game-smoke\scripts\start-dev-session.ps1 -OpenBrowser
```

The script resolves the repo root, starts `npm run dev` only if the requested port is not already serving the app, waits for the page to respond, and prints the URL plus log file paths.

If port `3000` is already occupied or you want an isolated test run, override it:

```powershell
C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File .\.agents\skills\test-game-smoke\scripts\start-dev-session.ps1 -Port 3002
```

### 4. Walk the Smoke Path Manually

Use the repo-specific expectations from `references/scene-flow.md`.

Default smoke path:

1. Open the URL reported by the launcher script, typically `http://localhost:3000/`.
2. If the Excalibur loader/logo splash appears, skip it.
3. Confirm the preparation screen renders without visible/runtime errors.
4. If the selected slot is occupied, switch to an empty slot or delete the old save before continuing.
5. Press `Enter` to start or continue into gameplay.
6. If the intro lore popup appears, close it with `Begin Reign` or `Esc`.
7. Confirm the gameplay HUD, map, and top-level controls render without errors.

### 5. Investigate Failures Precisely

When the run fails, capture:

- The scene where it failed
- The exact action that triggered it
- The exact error text or observable broken behavior

Start with the narrowest relevant code path:

- Boot failures: `src/main.ts`, `src/game.ts`, asset loading, and scene registration
- Preparation failures: `src/scenes/InitializationScene.ts`
- Gameplay failures: `src/scenes/GameplayScene.ts`
- UI-specific failures: the view or popup named in the stack trace or broken interaction
- Data/save issues: `src/managers/SaveManager.ts` and the affected manager

Fix the smallest defensible root cause first, then rerun the same smoke path.

### 6. Re-verify and Build

After a fix:

1. Repeat `npm run test:smoke`.
2. If the failure is not covered well by the automated flow, repeat the same manual smoke path that previously failed.
3. Run `npm run build` to catch type or bundle regressions before stopping.

## Troubleshooting

- If the detached launcher fails with `spawn EPERM` in a constrained environment, rerun the same command with elevated permissions or start `npm run dev -- --host localhost --port <port>` in the foreground.
- If Playwright reaches `preparation` but not `gameplay`, inspect `window.__gameTestState` and any retained failure artifacts in `test-results/`.

## Output Expectations

When reporting results:

- State whether the game reached `preparation`, `gameplay`, or both
- State what you actually observed versus inferred
- Call out any remaining unverified browser-console details if tooling limits prevented direct inspection
