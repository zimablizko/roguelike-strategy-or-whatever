### F-002 AI-Controlled States

- Priority: `Next` (explicitly provided as next feature)
- Status: Planned

#### Problem and Player Value

The world should feel inhabited by multiple foreign states rather than a single isolated player state.
AI-controlled states create strategic context for:

- economic interactions,
- military conflicts,
- future political gameplay.

This increases replayability through varying neighbors, threats, and opportunities each run.

#### In Scope

- On game start, generate several foreign states controlled by AI (alongside player state).
- Represent foreign states as simulation entities with core stats and relationship state.
- Enable interactions across two immediate channels:
  - Economic
  - Military
- Reserve political interactions as planned extension points (not full implementation in this feature).
- Add dedicated Diplomacy popup listing discovered foreign states and their key info.
- Implement simple, robust AI evolution model (abstract, deterministic-friendly, low maintenance).

#### Out of Scope (for F-002)

- High-fidelity nation simulation (detailed demographics, granular settlement logistics, etc.).
- Complex treaty/legal frameworks.
- Fully realistic map-level border evolution for all AI states in v1.
- Deep autonomous tactical warfare between non-player states.

#### Gameplay and UX Behavior

- At run start, foreign states are initialized with varied archetypes (for example: trader, militarist, isolationist).
- Discovery model:
  - only discovered states appear in Diplomacy popup,
  - undiscovered states become visible through defined discovery triggers (to be finalized).
- Diplomacy popup displays, per discovered state:
  - name/archetype,
  - relation stance,
  - relative power/economic posture (coarse indicators),
  - available interaction actions (economic/military).
- AI states progress each turn via a lightweight simulation step:
  - update power/economy intent,
  - recalculate stance toward player,
  - emit possible events/opportunities (trade offer, pressure, border incident, etc.).

#### Systems and Data Model (Target)

- New foreign-state domain model:
  - `ForeignState` (id, name, archetype, stats, discovered flag)
  - `ForeignStateRelation` (stance, tension, trust, last interactions)
  - `ForeignStateSnapshot` (UI-facing aggregated data)
  - `DiplomaticAction` (trade/contact/threat/action envelope)
- New manager:
  - `ForeignStateManager` for generation, per-turn simulation, interaction handling, and query APIs.
- Discovery subsystem (minimal):
  - track discovered vs undiscovered states,
  - expose methods to reveal states from events/interactions.
- Save/load integration for foreign states, relations, and discovery progress.

#### Dependencies and Sequencing

1. Foreign-state data and save schema must be in place first.
2. Turn hook must run simulation before diplomacy UI can show meaningful changes.
3. Military and economy systems should read shared foreign-state outputs for cross-branch consistency.
4. Political branch can attach later to the same relation primitives.

#### Files Likely Touched

Existing files:

- `src/managers/GameManager.ts`
- `src/managers/TurnManager.ts`
- `src/managers/SaveManager.ts`
- `src/_common/models/save.models.ts`
- `src/_common/models/ui.models.ts`
- `src/scenes/GameplayScene.ts`

Likely new files:

- `src/_common/models/foreign-state.models.ts`
- `src/managers/ForeignStateManager.ts`
- `src/data/foreignStates.ts`
- `src/ui/popups/DiplomacyPopup.ts`
- `src/ui/views/DiplomacyStatusView.ts` (optional but useful for quick-access summary)

#### Implementation Phases (Step-by-Step)

1. Phase 1: Core foreign-state scaffolding
   - Add models for foreign states, relations, discovery, and interaction contracts.
   - Add `ForeignStateManager` and wire it into `GameManager`.
   - Add save/load fields and validation for foreign-state data.

2. Phase 2: Run-start generation
   - Generate several foreign states during new-game initialization.
   - Assign archetypes and baseline stat variance.
   - Ensure deterministic behavior under same RNG seed.

3. Phase 3: Lightweight AI progression
   - Add per-turn simulation step for each foreign state.
   - Update relation/tension/economic posture with bounded drift rules.
   - Emit simple events for player-facing interaction hooks.

4. Phase 4: Discovery and visibility rules
   - Implement discovered-state tracking.
   - Add initial discovery triggers (for example: adjacency, contact action, event-driven reveal).
   - Keep hidden states fully omitted from diplomacy UI.

5. Phase 5: Diplomacy popup v1
   - Add `DiplomacyPopup` listing discovered states.
   - Display concise state cards with stance, relative power, and interaction affordances.
   - Add scene entry point (button/hotkey) and popup lifecycle.

6. Phase 6: Interaction hooks
   - Add first economic interactions (for example: basic trade proposal and acceptance/rejection flow).
   - Add first military interaction hooks (for example: pressure/hostility escalation state).
   - Keep political interactions as disabled placeholders with clear TODO markers.

7. Phase 7: Balance and robustness pass
   - Tune AI behavior bounds to avoid chaotic or static outcomes.
   - Validate that AI states remain legible and varied through a 1-2h run.
   - Harden save compatibility and migration strategy for future schema growth.

#### Acceptance Criteria

- New runs include player state plus multiple AI-controlled foreign states.
- Foreign states are persisted correctly through save/load.
- Diplomacy popup exists and shows all discovered foreign states.
- Undiscovered states are not shown until revealed by rules/events.
- At least one economic and one military interaction path exist against foreign states.
- Foreign states evolve each turn via a simple robust simulation (no full realism required).
- Political interaction surface is planned in data/API shape for later expansion.

#### Validation Checklist

- New-game smoke test: foreign states spawn each run with varied profiles.
- Save/load test: discovery, relations, and state snapshots restore exactly.
- Turn progression test: foreign-state metrics change over time within expected bounds.
- UI test: diplomacy popup opens/closes and updates after turn changes.
- Interaction test: one economic and one military action path produce visible outcomes.

#### Risks and Open Questions

- Final discovery rules are not yet locked (adjacency, scouting, events, or hybrid).
- Need a strict bound on state count to keep performance/UI clarity stable.
- Scope risk: realism expectations can inflate complexity quickly; v1 should remain abstract.
- Need decision on whether AI border expansion is simulated numerically first or represented on map in v1.
