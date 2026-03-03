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
