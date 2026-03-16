import type { ResourceCost } from './resource.models';

// ─── Unit Types ──────────────────────────────────────────────────────

/** Classification of a military unit. */
export type UnitClass = 'common' | 'specialist';

/** Tactical attack profile used by battle resolution. */
export type UnitAttackType = 'melee' | 'ranged' | 'support';

/** Role identifier for all unit types. */
export type UnitRole = 'militia' | 'footman' | 'archer' | 'spy' | 'engineer';

/** Player-facing per-unit commands for indirect battle control. */
export type BattleCommandId =
  | 'press-forward'
  | 'shield-up'
  | 'volley'
  | 'sow-panic'
  | 'brace-line';

/** Temporary combat statuses applied by commands and battle events. */
export type BattleStatusId =
  | 'aggressive'
  | 'shielded'
  | 'volleying'
  | 'fortified'
  | 'disrupting';

/**
 * Static definition of a military unit type.
 * Lives in data layer — never mutated at runtime.
 */
export interface UnitDefinition {
  /** Unique identifier matching the UnitRole. */
  id: UnitRole;
  name: string;
  description: string;
  class: UnitClass;
  /** Base combat power contributed per unit. */
  power: number;
  /** Base health of a single unit in tactical battle. */
  health: number;
  /** Base defense multiplier (1 = normal). */
  defense: number;
  /** Which combat phase this unit contributes to most. */
  attackType: UnitAttackType;
  /** Per-turn upkeep cost while the unit exists. */
  upkeep: ResourceCost;
  /** One-time resource cost to begin training. */
  trainingCost: ResourceCost;
  /** Number of turns required to finish training. */
  trainingTime: number;
  /** Tags for matching specialists to task bonuses. */
  tags: string[];
  /** Indirect battle commands available from the unit card. */
  commandIds: BattleCommandId[];
  /** Technology required to unlock this unit type. Empty = always available. */
  requiredTechnologies: string[];
}

/** Static description of a battle command. */
export interface BattleCommandDefinition {
  id: BattleCommandId;
  name: string;
  description: string;
  statusId: BattleStatusId;
  /** Harder commands are more likely to be ignored at low morale. */
  disciplineDifficulty: number;
}

/** Static description of a temporary battle status. */
export interface BattleStatusDefinition {
  id: BattleStatusId;
  name: string;
  description: string;
  powerMultiplier?: number;
  defenseMultiplier?: number;
  meleePowerMultiplier?: number;
  rangedPowerMultiplier?: number;
  rangedDefenseMultiplier?: number;
  enemyMoraleHit?: number;
}

// ─── Roster ──────────────────────────────────────────────────────────

/** Unit readiness state within the player's roster. */
export type UnitReadiness = 'available' | 'assigned' | 'training';

/**
 * A group of identical units at the same readiness level.
 * Stored in MilitaryManager roster.
 */
export interface UnitStack {
  unitId: UnitRole;
  count: number;
  readiness: UnitReadiness;
}

// ─── Training Queue ──────────────────────────────────────────────────

/** A single training order in the barracks queue. */
export interface TrainingOrder {
  /** Unique sequential id for this order. */
  orderId: number;
  unitId: UnitRole;
  /** Turns remaining until training completes. */
  turnsLeft: number;
  /** Number of units being trained in this batch. */
  count: number;
}

// ─── Assignments ─────────────────────────────────────────────────────

/** Types of military tasks units can be assigned to. */
export type MilitaryTaskType =
  | 'border-defense'
  | 'anti-raid'
  | 'campaign'
  | 'suppress-revolt';

/**
 * An active assignment of units to a task.
 */
export interface MilitaryAssignment {
  /** Unique sequential id for this assignment. */
  assignmentId: number;
  taskType: MilitaryTaskType;
  /** Optional target descriptor (e.g. zone id, state name). */
  target?: string;
  /** Units allocated to this task, keyed by UnitRole. */
  allocatedUnits: Partial<Record<UnitRole, number>>;
  /** Estimated risk level based on current intel. */
  risk: 'low' | 'medium' | 'high' | 'unknown';
}

// ─── Snapshot / Summary ──────────────────────────────────────────────

/**
 * Aggregated military metrics for display and AI evaluation.
 */
export interface MilitarySnapshot {
  /** Total combined power of all non-training units. */
  totalPower: number;
  /** Count of available (unassigned, trained) units. */
  availableCount: number;
  /** Count of units currently assigned to tasks. */
  assignedCount: number;
  /** Count of units currently in training. */
  trainingCount: number;
  /** Breakdown by unit role. */
  composition: Partial<Record<UnitRole, number>>;
}

// ─── Threats ─────────────────────────────────────────────────────────

/** Categories of threats that spawn each turn. */
export type ThreatType = 'raid' | 'revolt' | 'border-pressure';

/** An active threat that needs a military response. */
export interface MilitaryThreat {
  /** Unique sequential id. */
  threatId: number;
  type: ThreatType;
  /** Descriptive label (e.g. "Southern Border Raid"). */
  name: string;
  /** Enemy power that must be overcome. */
  enemyPower: number;
  /** Turns remaining before the threat auto-resolves (negatively). */
  turnsLeft: number;
  /** Which assignment task type can counter this threat. */
  counterTask: MilitaryTaskType;
}

/** Outcome of resolving a threat at end-of-turn. */
export interface ThreatOutcome {
  threatId: number;
  threatName: string;
  threatType: ThreatType;
  /** Whether the player won. */
  victory: boolean;
  /** Power comparison: player vs enemy. */
  playerPower: number;
  enemyPower: number;
  /** Casualties suffered (keyed by unit role). */
  casualties: Partial<Record<UnitRole, number>>;
  /** Resource losses from a defeat. */
  resourceLosses: Partial<Record<string, number>>;
  /** Specialist bonuses that applied. */
  specialistBonuses: string[];
}

// ─── Tactical Battles ────────────────────────────────────────────────

export type BattleWinner = 'player' | 'enemy' | 'draw';

export interface ActiveBattleStatus {
  statusId: BattleStatusId;
  turnsLeft: number;
  sourceCommandId?: BattleCommandId;
}

export interface BattleAttackQueueItem {
  side: 'player' | 'enemy';
  battleUnitId: string;
}

export interface PendingBattleAction {
  attackerSide: 'player' | 'enemy';
  attackerUnitId: string;
  defenderSide: 'player' | 'enemy';
  defenderUnitId: string;
  attackType: UnitAttackType;
  attackerLabel: string;
  defenderLabel: string;
  damage: number;
  counterDamage: number;
  roundNumber: number;
}

export interface BattleUnitState {
  battleUnitId: string;
  unitId: UnitRole;
  initialQuantity: number;
  remainingHealth: number;
  killedCount: number;
  routedCount: number;
  selectedCommandId?: BattleCommandId;
  activeStatuses: ActiveBattleStatus[];
}

export interface BattleSideState {
  label: string;
  morale: number;
  startingMorale: number;
  usesRoster: boolean;
  reserveUnits: Partial<Record<UnitRole, number>>;
  maxGroups: number;
  units: BattleUnitState[];
}

export interface BattleTurnSummary {
  turnNumber: number;
  roundNumber: number;
  playerDamage: number;
  enemyDamage: number;
  playerMorale: number;
  enemyMorale: number;
  playerCasualties: Partial<Record<UnitRole, number>>;
  enemyCasualties: Partial<Record<UnitRole, number>>;
  playerRouted: Partial<Record<UnitRole, number>>;
  enemyRouted: Partial<Record<UnitRole, number>>;
  action?: PendingBattleAction;
  commandResults: string[];
  highlights: string[];
}

export interface BattleState {
  battleId: number;
  name: string;
  phase: 'preparation' | 'battle';
  turnNumber: number;
  roundNumber: number;
  rewardMultiplier: number;
  attackQueue: BattleAttackQueueItem[];
  pendingWinner?: BattleWinner;
  pendingAction?: PendingBattleAction;
  pendingRoundNotes: string[];
  battleLog: string[];
  player: BattleSideState;
  enemy: BattleSideState;
  lastTurnSummary?: BattleTurnSummary;
}

export interface BattleResult {
  battleId: number;
  name: string;
  winner: BattleWinner;
  turns: number;
  playerKilled: Partial<Record<UnitRole, number>>;
  enemyKilled: Partial<Record<UnitRole, number>>;
  playerRouted: Partial<Record<UnitRole, number>>;
  enemyRouted: Partial<Record<UnitRole, number>>;
  rewards: ResourceCost;
  playerMorale: number;
  enemyMorale: number;
  summaryLines: string[];
}

export interface BattleStartSide {
  label?: string;
  morale?: number;
  units?: Partial<Record<UnitRole, number>>;
  /** If true, units are temporarily removed from available roster until battle ends. */
  reserveFromRoster?: boolean;
}

export interface StartBattleOptions {
  name: string;
  player?: BattleStartSide;
  enemy: BattleStartSide & {
    units: Partial<Record<UnitRole, number>>;
  };
  rewardMultiplier?: number;
}

// ─── Manager Options ─────────────────────────────────────────────────

/** Serializable military state for save/load. */
export interface MilitarySaveState {
  roster: UnitStack[];
  trainingQueue: TrainingOrder[];
  assignments: MilitaryAssignment[];
  threats: MilitaryThreat[];
  lastOutcomes: ThreatOutcome[];
  activeBattle?: BattleState;
  lastBattleResult?: BattleResult;
  orderSerial: number;
  assignmentSerial: number;
  threatSerial: number;
  battleSerial: number;
  version: number;
}

export interface MilitaryManagerOptions {
  /** Barracks capacity supplier — returns total training slots across all barracks. */
  getBarracksCapacity: () => number;
  /** Garrison capacity supplier — returns max non-training units across all barracks. */
  getGarrisonCapacity: () => number;
  /** Technology check — returns true if the given technology id is completed. */
  isTechnologyUnlocked: (techId: string) => boolean;
  /** Applies battle rewards to the game economy. */
  grantResources?: (resources: ResourceCost) => void;
  /** Restore from save data. */
  initial?: MilitarySaveState;
}
