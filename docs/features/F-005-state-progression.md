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
