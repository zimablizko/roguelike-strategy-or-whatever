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

- [F-001 Military Branch](features/F-001-military-branch.md)

### Next

- [F-002 AI-Controlled States](features/F-002-ai-controlled-states.md)
- [F-003 Random Events](features/F-003-random-events.md)
- [F-004 Talents and Curses](features/F-004-talents-and-curses.md)
- [F-005 State Progression](features/F-005-state-progression.md)

### Later

- TBD

## 4. Feature Spec Template

Use this template for all new roadmap entries. Each feature spec lives in its own file under `docs/features/`.

Naming convention: `F-XXX-short-name.md` (e.g. `F-006-trade-system.md`).

Required sections:

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
