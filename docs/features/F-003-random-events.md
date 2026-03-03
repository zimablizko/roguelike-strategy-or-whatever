### F-003 Random Events

- Priority: `Next` (inferred from sequence as next discussed feature)
- Status: Planned

#### Problem and Player Value

Runs need unpredictable narrative pressure beyond planned optimization loops.
Random events add replayability and force adaptation by presenting:

- contextual dilemmas,
- multiple choice outcomes,
- branch-specific consequences tied to player behavior.

#### In Scope

- At the beginning of a turn, roll chance to trigger a random event.
- When triggered, show a dedicated event popup with:
  - event title,
  - event description text,
  - several selectable options.
- Each option resolves with concrete consequences.
- Support conditional event availability based on run state and behavior.
- Include broad outcome types:
  - resources gain/loss,
  - units gain/loss,
  - buildings gain/loss/damage,
  - talents/curses hook (planned for later integration).
- Include at least one behavior-driven event chain example, such as:
  - excessive forest chopping -> "Forest Barbarian Invasion".

#### Out of Scope (for F-003)

- Full narrative quest engine.
- Large branching dialogue trees with long-term scripted storytelling.
- Cinematic sequences or custom one-off UI per event.
- Highly granular simulation of every consequence source.

#### Gameplay and UX Behavior

- Turn flow target:
  1. End current turn.
  2. Advance turn state.
  3. Roll event trigger for new turn start.
  4. If triggered, pause normal actions and show event popup.
  5. Player picks one option.
  6. Apply consequences immediately, then resume normal turn flow.
- Event popup should clearly show:
  - risk/reward intent per option (coarse preview),
  - disabled options and reason (if gated),
  - immediate result feedback after selection.
- Event spawn should be controlled by:
  - base chance,
  - weighted pools,
  - cooldown/no-repeat constraints,
  - condition predicates.

#### Systems and Data Model (Target)

- New random-event domain model:
  - `RandomEventDefinition` (id, title, text, weight, conditions, cooldown tags)
  - `RandomEventOption` (id, text, optional requirements, outcome payload)
  - `RandomEventOutcome` (resource/unit/building/talent/curse effects)
  - `RandomEventState` (history, cooldowns, per-run counters/signals)
- New manager:
  - `RandomEventManager` for selection, condition evaluation, and outcome application.
- Event signal tracking subsystem:
  - counters/flags used by condition predicates (for example forest tiles chopped this run).
- Save/load integration for event history, cooldowns, and tracked signals.

#### Dependencies and Sequencing

1. Event models + manager + save schema must land before UI implementation.
2. Turn manager must expose/consume a turn-start event hook.
3. Existing systems (resources, military, building, talents/curses later) must provide safe outcome application APIs.
4. Behavior signals (for example forest chopping) must be recorded where actions happen.

#### Files Likely Touched

Existing files:

- `src/managers/GameManager.ts`
- `src/managers/TurnManager.ts`
- `src/managers/SaveManager.ts`
- `src/_common/models/save.models.ts`
- `src/_common/models/turn.models.ts`
- `src/_common/models/ui.models.ts`
- `src/scenes/GameplayScene.ts`
- `src/managers/BuildingManager.ts`
- `src/data/buildings.ts`

Likely new files:

- `src/_common/models/random-events.models.ts`
- `src/managers/RandomEventManager.ts`
- `src/data/randomEvents.ts`
- `src/ui/popups/RandomEventPopup.ts`

#### Implementation Phases (Step-by-Step)

1. Phase 1: Core event scaffolding
   - Add event definitions, option schema, and outcome payload types.
   - Add `RandomEventManager` with weighted selection and condition filtering.
   - Add save/load fields for event state (history, cooldowns, signals).

2. Phase 2: Turn-start integration
   - Add turn-start trigger point after turn advancement.
   - Return pending event data from turn pipeline so scene can present popup.
   - Ensure event resolution blocks duplicate trigger during the same turn.

3. Phase 3: Popup and choice UX
   - Add `RandomEventPopup` with title, description, options, and close lifecycle.
   - Wire selection callbacks to resolve option outcomes.
   - Display concise result summary after choosing an option.

4. Phase 4: Outcome executor
   - Implement outcome handlers for resource changes first.
   - Add unit/building outcome handlers behind capability checks.
   - Add talent/curse outcomes as forward-compatible placeholder contracts.

5. Phase 5: Conditional events and signals
   - Introduce signal tracking (for example `forestTilesChopped`).
   - Add condition predicates and cooldown rules.
   - Implement "Forest Barbarian Invasion" as reference conditional event.

6. Phase 6: Balance and anti-frustration pass
   - Tune trigger rates and weight distribution.
   - Prevent excessive negative event streaks with guardrails.
   - Verify event cadence supports 1-2h run pacing.

#### Acceptance Criteria

- At turn start, random event chance is rolled and can trigger an event popup.
- Event popup shows title, description, and multiple options.
- Selecting an option applies deterministic consequence payloads for that choice.
- Conditional events can be gated by run state and behavior signals.
- At least one condition-driven event is implemented (forest over-chop example).
- Outcome types include at minimum resource effects, with hooks for units/buildings/talents/curses.
- Event history and cooldown state survive save/load correctly.

#### Validation Checklist

- Trigger test: events can fire at turn start and do not double-fire in one turn.
- UI test: popup blocks normal input, resolves choice, then unblocks correctly.
- Condition test: forest-chop threshold reliably enables invasion event.
- Persistence test: cooldown/history/signals restore after reload.
- Balance smoke test: event frequency and severity feel meaningful but not oppressive.

#### Risks and Open Questions

- Need final rule for whether event roll occurs before or after all other start-of-turn effects.
- Outcome conflicts may occur if events touch systems not yet implemented (units/talents/curses).
- Overly broad event pools can create noise; curation and weighting discipline is required.
- Need decision on whether some events are guaranteed once-per-run vs purely probabilistic.
