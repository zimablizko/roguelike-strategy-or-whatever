### F-006 Politics Branch

- Priority: `Later`
- Status: Planned

#### Problem and Player Value

Early-game rulers are lone micro-managers: every decision, every building, every resource allocation falls directly on the player. There is no social fabric — no advisors to trust, no populace whose mood matters, no sense that the ruler's authority must be earned.

The Politics branch introduces **reputation-based indirect control**. The ruler starts overwhelmed by mundane chores, and must earn the trust of key entities (common folk, advisors) to delegate work and unlock higher-level strategic options. This creates:

- a visible progression from "doing everything yourself" to "governing through others",
- meaningful social relationships that gate political actions,
- turn-by-turn decision pressure via requests that affect reputation,
- a natural home for future diplomacy, internal factions, and court intrigue mechanics.

#### Core Concept: Reputation and Delegation

The ruler interacts with **entities** — named groups or individuals whose opinion of the ruler matters:

| Entity           | Role / Domain                                |
| ---------------- | -------------------------------------------- |
| Common Folk      | General populace; react to living conditions |
| Economy Advisor  | Trade, taxation, resource management         |
| Military Advisor | Defense, army readiness, threat response     |
| Politics Advisor | Governance, law, diplomacy, internal order   |

Each entity has a **reputation** towards the ruler expressed as a **word tier**, not a raw number:

| Internal Range | Display Word | Meaning                                 |
| -------------- | ------------ | --------------------------------------- |
| 0 – 19         | Hostile      | Actively obstructs / ignores ruler      |
| 20 – 39        | Distrustful  | Reluctant cooperation, frequent refusal |
| 40 – 59        | Neutral      | Professional but uninvested             |
| 60 – 79        | Favorable    | Willing collaborator, occasional ideas  |
| 80 – 100       | Loyal        | Trusted partner, proactive support      |

Reputation determines:

- which requests the entity sends,
- whether delegation of duties is available,
- which political actions and techs become effective.

#### In Scope

- Add **reputation system** with four entities and tiered word-based display.
- Rework **State Popup** into a multi-tab popup:
  - **Town Hall** tab (default, new) — entity portraits, reputation, requests list.
  - **Statistics** tab — current state overview (existing `populateOverview` content).
- Add **request system**:
  - each turn, entities may generate requests based on game state and reputation,
  - ruler can **approve** or **deny** each request,
  - approval/denial adjusts reputation for the requesting entity (and sometimes others),
  - some requests have gameplay consequences beyond reputation (build a building, change policy, spend resources).
- Redesign **politics research tree** to support the reputation/delegation progression.
- Add initial set of **request definitions** covering simple and moderate complexity.

#### Out of Scope (for F-006)

- Full court / advisor character system with individual names, traits, and permadeath.
- Deep diplomacy with external states (covered by F-002 AI-Controlled States).
- Faction warfare or civil war mechanics.
- Advisor-initiated autonomous actions (advisors only suggest, player decides).
- Voice lines, cutscenes, or per-character art beyond placeholder portraits/icons.

#### Gameplay and UX Behavior

##### State Popup — Tabs

The State Popup gains a tab bar below its header:

```
┌─────────────────────────────────────────────┐
│  State: <name>                          [X] │
├──────────────┬──────────────────────────────┤
│  Town Hall   │   Statistics                 │
├──────────────┴──────────────────────────────┤
│                                             │
│  (tab content area)                         │
│                                             │
└─────────────────────────────────────────────┘
```

- Town Hall is the **first** (default) tab.
- Statistics contains the current state overview (tiles, population, upkeep).
- Tabs switch content without closing/reopening the popup.
- Future tabs (e.g. Diplomacy, Edicts) can be added later.

##### Town Hall Tab — Layout

```
┌─────────────────────────────────────────────┐
│  [👤 Folk]   [👤 Econ]  [👤 Mil]  [👤 Pol] │
│  Favorable   Neutral    Distrustful Neutral │
├─────────────────────────────────────────────┤
│  Requests                          (Turn 5) │
│ ┌─────────────────────────────────────────┐ │
│ │ 📜 Economy Advisor suggests building    │ │
│ │    a Lumbermill near the northern forest│ │
│ │    [Approve]  [Deny]                    │ │
│ ├─────────────────────────────────────────┤ │
│ │ 📜 Common Folk demand lower food prices │ │
│ │    Spend 10 Food to appease them.       │ │
│ │    [Approve]  [Deny]                    │ │
│ ├─────────────────────────────────────────┤ │
│ │ (scrollable if more requests)           │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

- **Top row**: horizontal portraits/icons for each entity, with reputation word below.
- **Request list**: scrollable area; each entry shows:
  - the requesting entity (icon + name),
  - request description,
  - Approve / Deny buttons.
- Approving/denying a request removes it from the list and applies consequences immediately.
- Unanswered requests persist across turns but may expire or escalate.

##### Request Flow

1. At the start of each turn (after end-turn resolution), the request system evaluates conditions.
2. Each entity has a weighted pool of possible requests filtered by:
   - current game state (resources, buildings, threats, reputation tier),
   - cooldown / uniqueness constraints,
   - research prerequisites.
3. 0–2 new requests are added per turn (configurable).
4. Requests appear in the Town Hall request list.
5. The ruler may approve or deny at any point during the turn.
6. Consequences:
   - **Approve**: execute the request's effect (e.g. spend resources, queue a building, grant a bonus). Reputation with requester increases. May decrease reputation with competing entities.
   - **Deny**: no gameplay effect. Reputation with requester decreases. May increase reputation with competing entities.
   - **Ignore (expire)**: small reputation penalty with requester.

##### Reputation Effects on Gameplay

- **Hostile / Distrustful**: entity sends complaints and demands; denying them has harsher penalties. No delegation available.
- **Neutral**: entity sends balanced requests. Basic delegation unlocked (via tech).
- **Favorable**: entity sends helpful suggestions and offers. Full delegation available.
- **Loyal**: entity proactively provides bonuses (passive income boost, threat warnings, etc.).

##### Delegation (Future Expansion within F-006)

When reputation is high enough and the matching politics tech is researched:

- Economy Advisor can auto-manage resource buildings (e.g. rotate farm harvests).
- Military Advisor can auto-assign idle units to border defense.
- Politics Advisor can auto-approve low-stakes requests from common folk.
- Common Folk contentment reduces random negative events.

Delegation reduces micro-management burden and represents the ruler's growing authority.

#### Politics Research Tree (Redesign)

The existing placeholder politics tree is replaced with nodes that directly support the reputation and delegation systems:

| ID                         | Name                 | Turns | Prerequisites                                | Effect                                                                  |
| -------------------------- | -------------------- | ----- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `pol-clan-council`         | Clan Council         | 2     | —                                            | Establishes formal council. Unlocks Town Hall tab in State Popup.       |
| `pol-public-hearings`      | Public Hearings      | 3     | `pol-clan-council`                           | Common Folk requests appear. Approving grants +2 rep instead of +1.     |
| `pol-civil-code`           | Civil Code           | 3     | `pol-clan-council`                           | Advisor requests appear. Deny penalty reduced from -3 to -1.            |
| `pol-tax-census`           | Tax Census           | 3     | `pol-civil-code`                             | Economy Advisor delegation unlocked at Favorable reputation.            |
| `pol-provincial-governors` | Provincial Governors | 4     | `pol-civil-code`                             | Politics Advisor delegation unlocked at Favorable reputation.           |
| `pol-military-liaison`     | Military Liaison     | 4     | `pol-civil-code`, `mil-drill-doctrine`       | Military Advisor delegation unlocked at Favorable reputation.           |
| `pol-state-bureaucracy`    | State Bureaucracy    | 5     | `pol-tax-census`, `pol-provincial-governors` | All delegation thresholds lowered to Neutral. +1 max requests per turn. |

> Note: existing research IDs (`pol-clan-council`, `pol-civil-code`, `pol-tax-census`, `pol-provincial-governors`, `pol-state-bureaucracy`) are reused and redefined with new descriptions and effects. `pol-public-hearings` and `pol-military-liaison` are new nodes.

#### Systems and Data Model (Target)

- New reputation domain model:
  - `PoliticalEntityId` — `'common-folk' | 'economy-advisor' | 'military-advisor' | 'politics-advisor'`
  - `PoliticalEntity` — `{ id, name, iconKey, reputation: number }`
  - `ReputationTier` — `'hostile' | 'distrustful' | 'neutral' | 'favorable' | 'loyal'`
  - `reputationTierFromValue(value: number): ReputationTier` — tier lookup function
- New request domain model:
  - `PoliticalRequestDefinition` — `{ id, entityId, title, description, conditions, approveEffects, denyEffects, approveRepChange, denyRepChange, cooldownTurns, weight }`
  - `PoliticalRequestInstance` — `{ definitionId, entityId, turnCreated, answered: boolean }`
- New or extended managers:
  - `PoliticsManager` — owns entity reputation state, request instances, delegation flags. Provides:
    - `getEntities(): PoliticalEntity[]`
    - `getReputation(entityId): number`
    - `getReputationTier(entityId): ReputationTier`
    - `adjustReputation(entityId, delta): void`
    - `getActiveRequests(): PoliticalRequestInstance[]`
    - `approveRequest(instanceId): void`
    - `denyRequest(instanceId): void`
    - `generateTurnRequests(): void` (called by TurnManager)
    - `getDelegationStatus(entityId): boolean`
    - `getVersion(): number` (for dirty-checking)
  - Integrate with `TurnManager` for turn-start request generation.
  - Integrate with `SaveManager` for persistence.
- Extend `StatePopup`:
  - Add tab system (Town Hall / Statistics).
  - Town Hall tab reads from `PoliticsManager`.
  - Statistics tab retains existing `populateOverview` logic.
- Request definitions data file:
  - `src/data/politicalRequests.ts` — all request definitions keyed by ID.

#### Dependencies and Sequencing

1. Reputation data model and `PoliticsManager` core must land before any UI work.
2. `StatePopup` tab system is a prerequisite for the Town Hall tab.
3. Request system depends on reputation being functional.
4. Delegation mechanics depend on both reputation thresholds and politics research being in place.
5. Politics research redesign should land alongside or before the request system to gate content properly.
6. Cross-branch tech dependency (`pol-military-liaison` → `mil-drill-doctrine`) requires military branch (F-001) to be implemented first.

#### Files Likely Touched

Existing files:

- `src/managers/GameManager.ts` — create and wire `PoliticsManager`
- `src/managers/TurnManager.ts` — call request generation on turn start
- `src/managers/SaveManager.ts` — serialize/deserialize reputation and requests
- `src/_common/models/save.models.ts` — add politics save fields
- `src/_common/models/ui.models.ts` — add `StatePopupOptions` tab support
- `src/data/researches.ts` — redefine politics tree nodes
- `src/ui/popups/StatePopup.ts` — add tab system, Town Hall tab
- `src/ui/constants/StatePopupConstants.ts` — layout constants for tabs and Town Hall
- `src/scenes/GameplayScene.ts` — pass `PoliticsManager` to State Popup

Likely new files:

- `src/_common/models/politics.models.ts` — entity, reputation, request types
- `src/managers/PoliticsManager.ts` — reputation state, request lifecycle, delegation
- `src/data/politicalRequests.ts` — request definitions

#### Implementation Phases (Step-by-Step)

1. Phase 1: Reputation scaffolding
   - Define `PoliticalEntityId`, `PoliticalEntity`, `ReputationTier` models.
   - Implement `PoliticsManager` with entity initialization, reputation get/set, tier lookup, and version counter.
   - Wire into `GameManager` and add save/load integration.

2. Phase 2: State Popup tab system
   - Refactor `StatePopup` to support a tab bar (Town Hall, Statistics).
   - Move existing `populateOverview` content into the Statistics tab.
   - Add empty Town Hall tab placeholder.
   - Ensure tab switching works with dirty-check and content rebuild.

3. Phase 3: Town Hall — entity display
   - Render entity portraits/icons horizontally at the top of Town Hall tab.
   - Display reputation tier word below each portrait.
   - Poll `PoliticsManager` for reputation data with version-based dirty-check.

4. Phase 4: Request definitions and generation
   - Define `PoliticalRequestDefinition` and `PoliticalRequestInstance` models.
   - Create initial request pool in `src/data/politicalRequests.ts` (8–12 requests).
   - Implement request generation logic in `PoliticsManager` (condition evaluation, weight, cooldown).
   - Hook generation into `TurnManager` turn-start flow.

5. Phase 5: Town Hall — request list UI
   - Add scrollable request list below entity portraits.
   - Each request entry: entity icon, description text, Approve / Deny buttons.
   - Wire button clicks to `PoliticsManager.approveRequest()` / `denyRequest()`.
   - Apply reputation changes and gameplay effects on approval/denial.
   - Refresh list after interaction.

6. Phase 6: Politics research tree redesign
   - Update existing politics research definitions with new descriptions and effects.
   - Add `pol-public-hearings` and `pol-military-liaison` nodes.
   - Gate Town Hall features behind `pol-clan-council` research.
   - Gate request types and delegation behind appropriate techs.

7. Phase 7: Delegation mechanics
   - Implement delegation flags per entity in `PoliticsManager`.
   - Check reputation tier + research completion for delegation eligibility.
   - Add auto-actions for each advisor domain (resource management, unit assignment, request auto-approval).
   - Expose delegation toggle in Town Hall UI per entity.

8. Phase 8: Balance and QA
   - Tune reputation gain/loss values for 1–2h run pacing.
   - Ensure request pool variety is sufficient and no single strategy dominates.
   - Validate that delegation meaningfully reduces late-game micro-management.
   - Verify save compatibility and deterministic behavior.

#### Acceptance Criteria

- Four political entities exist with tracked reputation values.
- Reputation is displayed as a word tier (Hostile → Loyal), not a number.
- State Popup has at least two tabs: Town Hall and Statistics.
- Town Hall tab shows entity portraits with reputation tiers at the top.
- Requests appear in a scrollable list in the Town Hall tab.
- Ruler can approve or deny requests; both actions have reputation consequences.
- At least 8 distinct request definitions exist across entities.
- Politics research tree has been redesigned with nodes that gate reputation/request/delegation features.
- Delegation is available for at least one advisor type when reputation and research conditions are met.
- Save/load preserves all reputation values, active requests, and delegation state.

#### Validation Checklist

- New game: entities start at Neutral reputation; no requests until `pol-clan-council` is researched.
- Research hook: completing `pol-clan-council` enables Town Hall tab functionality.
- Request generation: new requests appear after end-turn when conditions are met.
- Approve flow: approving a request applies its effect and adjusts reputation upward.
- Deny flow: denying a request adjusts reputation downward with no gameplay effect.
- Expiry: unanswered requests that expire cause a small reputation penalty.
- Reputation display: tier word updates correctly when internal value crosses a threshold.
- Delegation: advisor auto-actions trigger only when reputation ≥ threshold AND tech is researched.
- Tab switching: Town Hall ↔ Statistics switch without data loss or visual glitch.
- Persistence: all politics state survives save-load cycles exactly.
- Balance smoke test: reputation does not reach Loyal within the first 10 turns under normal play.

#### Risks and Open Questions

- Entity portraits/icons: need art or placeholder sprites. Decide on asset pipeline early.
- Request pool size: 8–12 initial requests may feel repetitive over long runs; plan for expansion.
- Delegation balance: auto-actions must not outperform manual play or players will feel forced into politics.
- Cross-entity reputation spillover: approving one entity's request may upset another — rules need careful design to avoid feel-bad loops.
- Interaction with F-003 (Random Events): some events may affect reputation — define the boundary clearly.
- Interaction with F-004 (Talents and Curses): some talents/curses could modify reputation gain rates — plan the hook but defer implementation.
- Town Hall tab gating behind `pol-clan-council`: the State Popup opens before this tech is researched — decide whether to show a locked placeholder or hide the tab entirely.
