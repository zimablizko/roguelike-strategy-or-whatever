import type { ResourceCost } from './resource.models';

// ─── Entities ────────────────────────────────────────────────────────

/** Identifiers for political entities whose opinion the ruler must manage. */
export type PoliticalEntityId =
  | 'common-folk'
  | 'economy-advisor'
  | 'military-advisor'
  | 'politics-advisor';

/** Runtime state of a single political entity. */
export interface PoliticalEntity {
  id: PoliticalEntityId;
  name: string;
  reputation: number;
}

// ─── Reputation Tiers ────────────────────────────────────────────────

/** Word-based reputation tier shown to the player instead of a raw number. */
export type ReputationTier =
  | 'hostile'
  | 'distrustful'
  | 'neutral'
  | 'favorable'
  | 'loyal';

/** Display configuration for a reputation tier. */
export interface ReputationTierInfo {
  tier: ReputationTier;
  label: string;
  colorHex: string;
  min: number;
  max: number;
}

export const REPUTATION_TIERS: readonly ReputationTierInfo[] = [
  { tier: 'hostile', label: 'Hostile', colorHex: '#e05252', min: 0, max: 19 },
  {
    tier: 'distrustful',
    label: 'Distrustful',
    colorHex: '#e09a52',
    min: 20,
    max: 39,
  },
  {
    tier: 'neutral',
    label: 'Neutral',
    colorHex: '#b0bcc8',
    min: 40,
    max: 59,
  },
  {
    tier: 'favorable',
    label: 'Favorable',
    colorHex: '#52b66f',
    min: 60,
    max: 79,
  },
  { tier: 'loyal', label: 'Loyal', colorHex: '#52a5e0', min: 80, max: 100 },
] as const;

/** Resolve a numeric reputation value to its display tier. */
export function reputationTierFromValue(value: number): ReputationTierInfo {
  for (const info of REPUTATION_TIERS) {
    if (value >= info.min && value <= info.max) {
      return info;
    }
  }
  // Fallback (should not happen when value is clamped 0–100)
  return REPUTATION_TIERS[2]; // neutral
}

// ─── Requests ────────────────────────────────────────────────────────

/** Condition context passed to request condition predicates. */
export interface PoliticalRequestConditionContext {
  /** Current turn number. */
  turn: number;
  /** Whether a specific technology is unlocked. */
  isTechUnlocked: (techId: string) => boolean;
  /** Current reputation with any entity. */
  getReputation: (entityId: PoliticalEntityId) => number;
  /** Current resource stock query. */
  getResource: (type: string) => number;
  /** Building count query. */
  getBuildingCount: (buildingId: string) => number;
}

/** Static definition of a political request (data layer, never mutated). */
export interface PoliticalRequestDefinition {
  id: string;
  entityId: PoliticalEntityId;
  title: string;
  description: string;
  /** Weight for random selection (higher = more likely). */
  weight: number;
  /** Minimum turns between re-appearances of this request. */
  cooldownTurns: number;
  /** Predicate — return true if this request is eligible to appear. */
  condition?: (ctx: PoliticalRequestConditionContext) => boolean;
  /** Reputation change when approved. Keyed by entity, defaults to entityId only. */
  approveRepChanges: Partial<Record<PoliticalEntityId, number>>;
  /** Reputation change when denied. */
  denyRepChanges: Partial<Record<PoliticalEntityId, number>>;
  /** Resource cost or gain on approval (negative = cost, positive = gain). */
  approveResourceEffects?: Partial<ResourceCost>;
  /** Number of turns before the request expires if unanswered. 0 = persists indefinitely. */
  expireTurns?: number;
}

/** Runtime instance of an active request. */
export interface PoliticalRequestInstance {
  /** Unique sequential id for this instance. */
  instanceId: number;
  definitionId: string;
  entityId: PoliticalEntityId;
  turnCreated: number;
}

// ─── Save / Load ─────────────────────────────────────────────────────

/** Serializable politics state for save/load. */
export interface PoliticsSaveState {
  entities: Array<{ id: PoliticalEntityId; reputation: number }>;
  activeRequests: PoliticalRequestInstance[];
  /** Tracks last turn each request definition appeared (for cooldown). */
  cooldowns: Array<{ definitionId: string; lastTurn: number }>;
  /** Per-entity scheduled turn for next request generation. */
  entityScheduledTurns?: Array<{
    entityId: PoliticalEntityId;
    scheduledTurn: number;
  }>;
  instanceSerial: number;
  version: number;
}

// ─── Manager Options ─────────────────────────────────────────────────

export interface PoliticsManagerOptions {
  isTechUnlocked: (techId: string) => boolean;
  getResource: (type: string) => number;
  getBuildingCount: (buildingId: string) => number;
  initial?: PoliticsSaveState;
}
