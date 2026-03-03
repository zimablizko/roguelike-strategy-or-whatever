### F-001 Military Branch

- Priority: `Now` (inferred from "First feature")
- Status: Planned

#### Problem and Player Value

Military must be a distinct problem-solving branch using raw power, not a duplicate of economy/politics loops.
It should let players:

- respond to raids and revolts,
- fight rival states,
- project force to expand borders,
- choose between common troops and specialist units for targeted outcomes.

#### In Scope

- Add a military gameplay branch centered on force-based resolution of threats and expansion.
- Replace placeholder military research tree with a new, purposeful progression.
- Introduce training-based military force generation via buildings (Barracks model).
- Use indirect control: player commands assignments and priorities, not individual unit movement.
- Introduce unit roles:
  - Common units: Militia, Footman, Archer.
  - Specialists: Spy, Engineer (extensible for more types later).
- Add dedicated Military popup with:
  - aggregated military power,
  - current roster and counts,
  - active assignments/tasks,
  - readiness/availability summary.

#### Out of Scope (for F-001)

- Real-time tactical battlefield control.
- Per-unit manual pathfinding/micro.
- Full diplomacy rework.
- Complex external empire simulation beyond what is needed for military encounters.

#### Gameplay and UX Behavior

- Units are trained at military buildings (initially Barracks), each with capacity limits.
- Training consumes resources and time (turns).
- Each turn, trained units can be assigned to tasks:
  - Border defense
  - Anti-raid response
  - Campaign against rival state
  - Revolt suppression
- Task outcomes are resolved on turn progression using aggregate force + unit composition + modifiers.
- Specialists provide contextual bonuses:
  - Spy: improves intel, lowers ambush risk, improves raid interception odds.
  - Engineer: improves siege/fortification outcomes and campaign efficiency.
- Military power shown to player as both:
  - total score (quick read),
  - composition breakdown (actionable read).

#### Systems and Data Model (Target)

- New military domain model:
  - `UnitDefinition` (id, role, class, power, upkeep, training cost/time, tags)
  - `UnitStack` / roster entry (type, count, readiness state)
  - `MilitaryAssignment` (task type, target, allocated units, expected risk)
  - `MilitarySnapshot` (aggregated power and composition metrics)
- New manager:
  - `MilitaryManager` as single source of truth for military state and turn resolution hooks.
- Barracks capacity model:
  - capacity per Barracks instance,
  - occupied slots by trained/queued units,
  - optional future expansion via upgrades/tech.
- Save/load integration for military roster, queues, assignments, and military versioning.

#### Dependencies and Sequencing

1. Data model and save integration must land before combat/event resolution.
2. Training and capacity loops must exist before popup can show actionable data.
3. Tech tree redesign should gate units/bonuses only after core military loop is stable.

#### Files Likely Touched

Existing files:

- `src/managers/GameManager.ts`
- `src/managers/TurnManager.ts`
- `src/managers/SaveManager.ts`
- `src/_common/models/save.models.ts`
- `src/_common/models/ui.models.ts`
- `src/scenes/GameplayScene.ts`
- `src/data/researches.ts`
- `src/ui/popups/ResearchPopup.ts`

Likely new files:

- `src/_common/models/military.models.ts`
- `src/managers/MilitaryManager.ts`
- `src/data/military.ts`
- `src/ui/popups/MilitaryPopup.ts`
- `src/ui/views/MilitaryStatusView.ts` (optional but recommended for HUD summary)

#### Implementation Phases (Step-by-Step)

1. Phase 1: Core military scaffolding
   - Add military models and `MilitaryManager`.
   - Wire manager creation into `GameManager`.
   - Add save serialization/deserialization fields and validation.

2. Phase 2: Unit roster and barracks capacity
   - Add unit definitions (common + specialist baseline).
   - Add Barracks-based capacity rules and training queue.
   - Add resource/time costs and turn-based training completion.

3. Phase 3: Assignment loop
   - Add assignment types (defend border, anti-raid, campaign, suppress revolt).
   - Support allocation/reallocation of available units by assignment.
   - Expose assignment summaries for UI and end-turn resolution.

4. Phase 4: Threat and conflict resolution
   - Add abstract raid/revolt/rival-pressure events.
   - Resolve outcomes using power, composition, specialists, and randomness envelope.
   - Produce outcome reports (wins/losses/casualties/border effects).

5. Phase 5: Military tech tree redesign
   - Replace current placeholder military research nodes.
   - Ensure research unlocks meaningful military capabilities (units, capacity, modifiers).
   - Rebalance prerequisites and turn costs.

6. Phase 6: Military popup UX
   - Add dedicated `MilitaryPopup`.
   - Show aggregate power, unit inventory, assignments, and readiness.
   - Add scene entry point (button/hotkey), popup lifecycle, and close behavior.

7. Phase 7: Balance and QA hardening
   - Tune numbers for 1-2h run pacing.
   - Validate no dominant single-unit strategy.
   - Verify save compatibility and deterministic behavior expectations.

#### Acceptance Criteria

- Military branch exists and can handle raids, revolts, rival conflicts, and force-driven border expansion.
- Player cannot directly micro-control individual unit movement.
- Units are trained through Barracks-like buildings with enforceable capacity constraints.
- At least three common unit types and two specialist types are implemented.
- Units can be assigned to at least three distinct military tasks.
- Military outcomes resolve during turn progression and generate player-visible results.
- Military tech tree is no longer placeholder and materially affects military capability.
- Dedicated Military popup exists and displays:
  - total military power,
  - roster composition,
  - active assignments,
  - readiness/availability.
- Save/load preserves military state without data loss.

#### Validation Checklist

- New game: can train units, assign them, and resolve at least one conflict outcome.
- Mid-run save/load: roster, queues, and assignments restore exactly.
- Tech progression: at least one military research unlock changes military options.
- UI: popup opens/closes correctly and reflects state after each turn.
- Balance smoke test: no immediate runaway from first military investment.

#### Risks and Open Questions

- Barracks definition does not yet exist in current building set; decide whether to add new building or repurpose an existing one.
- Border expansion by force needs clear interaction rules with current map/zone systems.
- Rival-state model depth must stay constrained to keep 1-2h run pacing.
- Need final decision on specialist breadth for first milestone (only Spy/Engineer or more).
