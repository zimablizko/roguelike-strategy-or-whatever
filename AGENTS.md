# Project Patterns

## Architecture

- Keep gameplay state in managers. `GameplayScene` composes managers and UI, but should not become the source of truth for resources, turns, buildings, politics, military, or random events.
- Treat managers as authoritative owners of their domain data:
  - `ResourceManager` for resource state and mutations.
  - `TurnManager` for turn flow, date/focus progression, upkeep, and end-turn resolution.
  - `BuildingManager` for building definitions, placement, action availability, and building-side map effects.
  - `RandomEventManager`, `PoliticsManager`, `MilitaryManager`, `GameLogManager` for their own systems.
- Prefer extending an existing manager over introducing parallel state in a scene or popup.

## Data-Driven Content

- Add content through definition files in `src/data/` whenever the feature is fundamentally declarative.
- Buildings, researches, random events, political requests, market offers, and similar content should remain data-driven.
- Keep behavior attached to definitions only when the repo already follows that pattern for the feature. Example: building actions and random event outcomes are definition-driven.

## State And Rendering

- Follow the repo’s version-counter pattern for hot UI paths.
- Managers expose version getters such as `getResourcesVersion()`, `getTurnVersion()`, `getVersion()`, `getBuildingsVersion()`.
- Views and popups should cache the last seen versions and skip rebuilding when nothing relevant changed.
- Prefer `getAllResourcesRef()` / read-only refs for polling-heavy UI instead of cloning state every frame.

## UI Composition

- Reuse existing UI primitives instead of inventing one-off controls:
  - `ScreenButton` for clickable buttons.
  - `ActionElement` for action rows with tooltip support.
  - `ScreenPopup` for modal/pop-up shells.
  - `TooltipProvider` for all hover tooltips.
- Keep visual structure consistent with existing HUD and popup patterns.
- For custom Excalibur UI, build graphics with `graphics.use(...)` / `GraphicsGroup` and keep layout math local to the component.
- Clean up tooltip owners on `pointerleave`, `prekill`, or popup teardown.

## Tooltip Rules

- Use `src/ui/tooltip/TooltipResourceSection.ts` for every tooltip that shows resource movement.
- Resource spend must render under a `Costs` section.
- Resource gain must render under a `Gains` section.
- If the interaction spends Focus, include Focus in the same `Costs` section.
- Keep resource rows in the standard format: icon, minimal gap, amount.
- For `Costs`, amount text is white when affordable, otherwise red with `(-X)` for the missing amount.
- For `Gains`, amount text is green.
- Do not hand-roll tooltip resource rows with custom colors, icon spacing, or ad hoc text formatting.
- Non-resource tooltip rows such as time, cooldown, training, skill checks, or reputation can stay as normal tooltip outcomes.

## Resource And Focus Practices

- Mutate resources only through `ResourceManager`.
- Mutate focus only through `TurnManager` or the explicit focus bridge patterns already used by systems like politics and random events.
- Do not duplicate affordability logic in UI if a manager already exposes a status/check method. UI should ask the manager, then render the result.
- If an action or decision spends Focus and resources, represent both in the tooltip and spend them through the proper manager methods during execution.

## Buildings And Actions

- Building definitions live in `src/data/buildings/`.
- Passive income belongs in `buildingPassiveIncome.ts` when it is static/data-driven.
- Building action availability, placement checks, and execution should flow through `BuildingManager`.
- For action buttons in the selected-building panel, keep using `ActionElement` and manager-derived availability/status.
- Work modes are part of the established building UI pattern. Extend the existing mode systems rather than creating separate ad hoc controls.

## Random Events And Requests

- Random event definitions should stay in `src/data/randomEvents/`, with presentation and resolution flowing through `RandomEventManager`.
- Political requests should keep using `PoliticsManager` plus tooltip outcomes assembled in UI from manager/definition data.
- If an event or request has resource or focus effects, feed those into the shared tooltip resource-section helper instead of embedding the effect only in descriptive prose.

## Scenes

- `GameplayScene` is an orchestrator. It wires managers, popups, overlays, and HUD elements together.
- Avoid pushing domain logic into scenes when a manager can own it.
- Scene-local state is appropriate for UI flow, popup visibility, selection, temporary placement mode, and similar orchestration concerns.

## Files And Utilities

- Shared types belong in `src/_common/models/`.
- Shared helpers belong in `src/_common/` or feature-local helper files if they are not broadly reusable.
- Derive types from definitions where the repo already does that, such as `StateBuildingId`.

## Verification

- After structural UI or type changes, run `npm run build`.
- If a change touches interaction flow, also prefer a quick in-game smoke check when practical.
