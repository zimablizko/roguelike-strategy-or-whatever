# Roguelike Strategy Roadmap

Last updated: 2026-02-26
Document owner: Product + Implementation Agents
Status: Living roadmap (updated feature-by-feature)

## 1. Vision

Roguelike civilization-like strategy game with mid-paced decision loops and runs lasting around 1-2 hours.  
Core goal is high replayability through varied strategic options, dynamic situations, and meaningful tradeoffs.

## 2. Design Pillars

1. Replayability first: every run should force different priorities and responses.
2. Mid-paced turns: decisions should feel substantial, not twitchy or overloaded.
3. Branch identity: each branch (economy, politics, military) must solve different problem classes.
4. Agent-ready implementation: features are split into clear phases with explicit acceptance criteria.

## 3. Roadmap Lanes

### Now

- F-001 Military branch (planned)

### Next

- F-002 AI-Controlled States (planned)
- F-003 Random Events (planned)
- F-004 Talents and Curses (planned)
- F-005 State Progression (planned)

### Later

- TBD

## 4. Feature Spec Template

Use this template for all new roadmap entries:

- ID and name
- Priority lane (`Now` / `Next` / `Later`)
- Problem and player value
- Scope (`In scope` / `Out of scope`)
- Gameplay and UX behavior
- Systems and data model
- Dependencies and sequencing
- Files likely touched
- Implementation phases (step-by-step)
- Acceptance criteria
- Validation checklist
- Risks and open questions

## 5. Feature Specs

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

### F-004 Talents and Curses

- Priority: `Next` (explicitly provided as next feature)
- Status: Planned

#### Problem and Player Value

Talents add a high-excitement layer of replayability by giving players impactful, semi-random build-defining choices.
Curses add the opposite pressure: high-stakes negative modifiers that force adaptation and create tension spikes.
Together they should create memorable run divergence across economy, military, and politics.

#### In Scope

- Add a talent-offer flow that triggers when defined conditions are met.
- Show a dedicated talent selection popup with 3 cards.
- Each card includes:
  - title,
  - icon,
  - description.
- Selection rules:
  - player chooses 1 of 3 offered talents.
- Support rarity tiers:
  - Common
  - Uncommon (green border)
  - Rare (blue border)
- Curses use red border for immediate visual distinction.
- Support domain categories with card background color:
  - General (white background)
  - Economic (green background)
  - Military (red background)
  - Politics (blue background)
- Support stacking model:
  - unique talents (pick once max),
  - stackable talents (can be taken multiple times, within optional caps).
- Support ownership model:
  - state-related talents (default, persist entire run),
  - personal talents (tied to current ruler only; must be visually highlighted).
- Add curse card type:
  - uses the same card framework and taxonomy as talents,
  - carries negative effects (opposite direction to talents),
  - acquired primarily through random events.
- Support curse acquisition flows:
  - direct forced curse from event outcome,
  - optional curse choice from event options (risk/reward branch).
- Add persistent in-game UI to inspect currently active talents and curses at any time.
- Clearly separate state-related vs personal modifiers in UI and behavior.

#### Out of Scope (for F-004)

- Full talent tree with pathing and branch prerequisites.
- Respec/reroll shop systems.
- Complex animation cinematics per individual talent.
- Permanent meta-progression across runs.

#### Gameplay and UX Behavior

- Talent moment should feel premium and celebratory:
  - darkened backplate + spotlight on cards,
  - animated card reveal with slight stagger,
  - hover emphasis and clear rarity/domain visual language.
- Card information hierarchy:
  - top: icon + title,
  - middle: concise effect summary,
  - bottom: tags (rarity, domain, unique/stackable, state/personal).
- Personal talents must be clearly marked (for example `Personal Talent` label in card body).
- Curses should be visually distinct from positive talents with red border (and optional darker frame + warning label).
- Card title color must always match border color (for example uncommon green title, rare blue title, curse red title).
- On ruler death/change:
  - personal talents from previous ruler become inactive,
  - state talents remain active.
- Selection should be final (no immediate cancel after reveal), unless an explicit confirm UX is added.

#### Active Talents/Curses UI (Recommendation)

- Use a two-layer UI model:
  - quick-glance HUD indicators,
  - full detail popup.
- Quick-glance placement (recommended):
  - state-related modifiers: small badge/button attached to `StateDisplay` area (top-left state panel),
  - personal modifiers: small badge/button attached to `RulerDisplay` area (top-left ruler panel).
- Full detail popup:
  - one shared `Talents & Curses` popup opened from either badge or hotkey.
  - default tab/section depends on opener:
    - opened from State -> `State Modifiers` tab first,
    - opened from Ruler -> `Personal Modifiers` tab first.
  - sections:
    - State Modifiers (run-persistent),
    - Personal Modifiers (current ruler only),
    - optional `All Curses` filter for debugging/clarity.
- Card/list rows in the detail popup should show:
  - icon, title, short effect text,
  - polarity marker (`Talent` vs `Curse`),
  - stack count if stackable,
  - ownership marker (`State` or `Personal`).

#### Talent Offer Timing (Suggestions)

Option A: Fixed cadence
- Offer every `N` turns (simple and predictable).
- Pros: easy balance and pacing.
- Cons: can feel detached from player actions.

Option B: Milestone-driven
- Offer only on milestones (research completions, military victories, state growth thresholds, ruler events).
- Pros: thematic and reactive.
- Cons: can create droughts or bursts.

Option C: Hybrid (recommended for v1)
- Use milestone-driven offers with a cadence safety net.
- Recommended baseline:
  1. Guaranteed first offer on Turn 3 (early run identity choice).
  2. Milestone offers on major achievements (first branch breakthrough, major victory, major state growth, specialization threshold from `F-005`).
  3. Pity timer guarantee if no offer for 6 turns.
  4. Cooldown of 2 turns between offers.
  5. Maximum one talent offer per turn.
- Target pacing: roughly 4-7 offers in a typical 1-2h run.

#### Curse Acquisition Timing (Suggestions)

- Primary source (recommended): random events (`F-003`) grant curses directly or through event choices.
- Secondary source (optional): rare high-reward interactions where player can accept a curse for immediate gain.
- Guardrails:
  - avoid back-to-back forced curses without player agency,
  - apply curse cooldown windows to prevent frustration spikes.

#### Systems and Data Model (Target)

- New talent domain model:
  - `TalentCardDefinition` (id, title, description, icon, polarity, rarity, domain, stackMode, ownership)
  - `TalentOffer` (id, source, turnNumber, cardIds[3])
  - `TalentEffect` (typed positive effect payload)
  - `CurseEffect` (typed negative effect payload)
  - `TalentState` (picked talents, active curses, stacks, inactive personal modifiers, offer/cooldown state)
- New manager:
  - `TalentManager` for offer generation, validation, selection, and talent/curse effect application.
- Trigger subsystem:
  - `TalentTriggerSource` events (cadence tick, milestone reached, scripted reward).
- Event bridge:
  - integration contract for `RandomEventManager` to grant talents/curses as outcomes.
- Ruler binding:
  - personal talent/curse ownership references current ruler identity for activation checks.
- Save/load integration for picked talents, curses, stacks, and active/inactive status.

#### Dependencies and Sequencing

1. Talent definitions + manager + save schema must land first.
2. Offer trigger signals need turn/ruler/gameplay hooks.
3. Effect executor must integrate safely with resource, military, politics, and building systems.
4. Popup UX depends on stable offer payload contracts.
5. Curse acquisition path depends on random-event outcomes integration.
6. State progression specialization thresholds (`F-005`) should provide deterministic talent-offer triggers.

#### Files Likely Touched

Existing files:
- `src/managers/GameManager.ts`
- `src/managers/TurnManager.ts`
- `src/managers/RulerManager.ts`
- `src/managers/SaveManager.ts`
- `src/_common/models/save.models.ts`
- `src/_common/models/ui.models.ts`
- `src/scenes/GameplayScene.ts`
- `src/ui/views/StateView.ts`
- `src/ui/views/RulerView.ts`

Likely new files:
- `src/_common/models/talent.models.ts`
- `src/managers/TalentManager.ts`
- `src/data/talents.ts`
- `src/ui/popups/TalentPopup.ts`
- `src/ui/popups/TalentsCursesPopup.ts`
- `src/ui/views/TalentStatusView.ts`
- `src/ui/constants/TalentPopupConstants.ts`

#### Implementation Phases (Step-by-Step)

1. Phase 1: Core talent scaffolding
   - Define talent schema and taxonomy (rarity/domain/stack/ownership).
   - Add `TalentManager` with talent registry and picked-state tracking.
   - Add save/load schema and validation for talent state.

2. Phase 2: Trigger and offer generation
   - Implement trigger collection (cadence, milestones, scripted hooks).
   - Generate 3-card offers with rarity weighting and duplicate protection.
   - Enforce unique/stackable constraints when building offers.

3. Phase 3: Fancy popup UX
   - Add full-screen style talent popup with animated 3-card reveal.
   - Implement domain backgrounds and rarity borders exactly as specified.
   - Add clear personal/state labeling and selection feedback.

4. Phase 4: Active modifiers UI
   - Add HUD indicators near state and ruler panels.
   - Add shared `Talents & Curses` detail popup with state/personal sections.
   - Add clear polarity and ownership labels to avoid confusion.

5. Phase 5: Effect application engine
   - Implement core effect types (resource modifiers, military modifiers, political modifiers).
   - Apply chosen talent immediately and persist active modifiers.
   - Add stack resolution rules and caps for stackable talents.

6. Phase 6: Curses integration
   - Integrate curse grant flow with random-event outcomes.
   - Apply curse effects using the same modifier pipeline as talents.
   - Add anti-frustration rules (curse cooldown or protection window).

7. Phase 7: Personal vs state lifecycle
   - Bind personal talents/curses to current ruler lifecycle.
   - On ruler replacement, deactivate old personal modifiers without deleting history.
   - Keep state-related modifiers always active for run duration.

8. Phase 8: Timing balance and pacing pass
   - Implement recommended hybrid cadence/milestone/pity model.
   - Tune offer frequency to hit 4-7 offers per run.
   - Prevent offer spam and dead-zones via cooldown/pity tuning.

#### Acceptance Criteria

- Talent offer popup can appear when trigger conditions are met.
- Popup presents exactly 3 cards, player chooses one.
- Cards include title, icon, and description.
- Rarity and domain visuals match spec:
  - uncommon green border,
  - rare blue border,
  - curse red border,
  - title color matches card border color,
  - domain backgrounds by category.
- Unique talents cannot be selected beyond allowed limit.
- Stackable talents can be selected repeatedly according to stack rules.
- State talents persist through the run.
- Personal talents are only active while their owner ruler is alive/current.
- Curses can be obtained through events and apply negative modifiers correctly.
- Curse state persists through save/load and follows state/personal lifecycle rules.
- Player can inspect active talents/curses anytime via HUD entry points and detail popup.
- UI clearly distinguishes state vs personal modifiers and talent vs curse polarity.
- Offer timing follows a defined policy and is reproducible for balancing.

#### Validation Checklist

- Offer generation test: receives valid 3-card options with no invalid duplicates.
- UI test: popup animation and interaction are smooth on desktop and mobile resolutions.
- Rarity/domain visual test: border/background coding always correct.
- Title color test: title always matches the effective border color.
- UI placement test: state and ruler entry points are visible and do not conflict with existing HUD.
- Lifecycle test: ruler replacement deactivates personal talents and keeps state talents.
- Detail popup test: state/personal sections and ownership labels are correct.
- Event integration test: at least one event can grant a curse and apply effects.
- Persistence test: picked talents/curses/stacks/active states survive save-load cycles.
- Pacing test: run simulation lands near target 4-7 offers in a 1-2h session.

#### Risks and Open Questions

- Exact milestone list for talent triggers still needs final definition.
- Personal talent handling on ruler death may need additional UX explanation.
- Curse acquisition rate must be tuned carefully to avoid player frustration.
- Balancing rarity excitement vs build reliability can be difficult early.
- Need decision on whether to keep one shared details popup only, or additionally keep separate state/ruler mini-popups.

### F-005 State Progression

- Priority: `Next` (explicitly provided as next feature)
- Status: Planned

#### Problem and Player Value

State progression provides a clear long-term run arc and ties strategic branch investment to rewards.
It should:
- make specialization choices legible,
- produce predictable talent moments on progression milestones,
- strengthen replayability through different branch growth paths.

#### In Scope

- Add `State Level` property as sum of specialization levels.
- Add specialization levels:
  - Economics
  - Politics
  - Military
- Add specialization gain conditions (first guaranteed source: corresponding research completion).
- Add talent reward trigger on specialization milestones:
  - progressive thresholds (2, 5, 9, 14, ...),
  - reward offer pulls from:
    - that specialization talent pool,
    - general talent pool.
- Display progression in `StatePopup`:
  - state level,
  - specialization levels,
  - progress to next talent milestone,
  - pending reward indicator (if offer queued).

#### Out of Scope (for F-005)

- Deep specialization trees with branching nodes.
- Specialization decay/regression mechanics.
- Full visual map-based progression tracks.
- Permanent cross-run progression.

#### Gameplay and UX Behavior

- Core formula:
  - `stateLevel = economicsLevel + politicsLevel + militaryLevel`.
- Initial gain source:
  - completing research in a tree grants progression to matching specialization.
- On reaching a specialization milestone, queue one talent choice moment.
- Talent offer composition for specialization milestone:
  - weighted majority from matching specialization pool,
  - minority from general pool.
- State popup progression block should be concise and always visible in overview:
  - `State Level: X`,
  - `Economics: A | Next talent in N levels`,
  - `Politics: B | Next talent in N levels`,
  - `Military: C | Next talent in N levels`.

#### Milestone Cadence (Suggestion)

- Config key: `SPECIALIZATION_TALENT_MILESTONES`.
- Default recommendation: progressive thresholds per specialization:
  - `2, 5, 9, 14, 20, ...`
  - increments grow by +1 each step (`+3, +4, +5, +6, ...`).
- Formula form (for generated milestones): `threshold(n) = n * (n + 3) / 2`, where `n` starts at `1`.
- If multiple thresholds are crossed in one update, queue rewards sequentially (one offer shown per turn).

#### Systems and Data Model (Target)

- Extend state progression model:
  - `StateProgression` (stateLevel, specializations, thresholdsReached).
  - `StateSpecializationLevels` (`economics`, `politics`, `military`).
- New or extended manager responsibilities:
  - track specialization gains from events,
  - recompute state level,
  - emit milestone reward events for talent system.
- Talent integration contract:
  - `TalentManager` consumes specialization milestone events to produce scoped offers.
- Save/load integration:
  - specialization levels,
  - state level,
  - pending milestone reward queue.

#### Dependencies and Sequencing

1. State progression data model and persistence must land first.
2. Research completion pipeline must emit specialization gain signals.
3. Talent system (`F-004`) must accept specialization-scoped offer requests.
4. State popup display should read progression data from a stable API.

#### Files Likely Touched

Existing files:
- `src/_common/models/state.models.ts`
- `src/_common/models/save.models.ts`
- `src/managers/StateManager.ts`
- `src/managers/GameManager.ts`
- `src/managers/TurnManager.ts`
- `src/managers/ResearchManager.ts`
- `src/scenes/GameplayScene.ts`
- `src/ui/popups/StatePopup.ts`
- `src/managers/SaveManager.ts`

Likely new files:
- `src/_common/models/state-progression.models.ts`
- `src/data/stateProgression.ts`
- `src/managers/StateProgressionManager.ts`

#### Implementation Phases (Step-by-Step)

1. Phase 1: Progression schema and persistence
   - Define specialization level schema and state-level formula contract.
   - Add save/load fields and validation for progression state.
   - Ensure backward compatibility for older saves.

2. Phase 2: Gain-source integration
   - Hook research completion events to specialization gain updates.
   - Add event API for additional future gain sources.
   - Prevent duplicate gain from same completion event.

3. Phase 3: Milestone and reward queue
   - Implement progressive milestone threshold logic (`2, 5, 9, 14, ...`).
   - Detect threshold crossings and queue talent reward tokens.
   - Guarantee one reward popup max per turn for pacing.

4. Phase 4: Talent pool integration
   - Request talent offers from specialization + general pools.
   - Apply weighting policy and unique/stackable constraints.
   - Handle queued rewards across turns.

5. Phase 5: StatePopup progression UI
   - Add progression panel to existing `StatePopup`.
   - Render state level, specialization levels, and next milestone info.
   - Show pending reward count/indicator.

6. Phase 6: Balance and QA
   - Tune progressive milestone curve against 1-2h run pacing.
   - Validate progression speed across different playstyles.
   - Ensure no runaway feedback loops from rapid talent gain.

#### Acceptance Criteria

- State has a persisted numeric level.
- State level always equals sum of specialization levels.
- Economics/politics/military specializations exist and persist through save/load.
- Completing relevant research advances matching specialization progression.
- Specialization milestones trigger talent offers from specialization + general pools.
- Progressive milestone thresholds (`2, 5, 9, 14, ...`) are applied correctly.
- Progression is visible in `StatePopup` with current levels and next-threshold information.

#### Validation Checklist

- Formula test: state level recalculates correctly after each specialization gain.
- Research hook test: each completed research increments only its matching specialization.
- Milestone queue test: crossing multiple thresholds queues multiple rewards without skipping.
- Milestone formula test: thresholds follow `2, 5, 9, 14, ...` progression exactly.
- Talent pool test: milestone offers include specialization and general cards with expected weighting.
- UI test: state popup progression block updates correctly after turn/research changes.
- Persistence test: progression levels and queued rewards survive save-load cycles.

#### Risks and Open Questions

- Progressive curve may need tuning if rewards arrive too slowly or too quickly in edge-case runs.
- Need a clear rule for how much each gain source contributes (flat +1 vs weighted values).
- Risk of over-rewarding one specialization if its gain sources are easier than others.
- Need final UX decision on where pending talent queue is surfaced outside `StatePopup` (if anywhere).
