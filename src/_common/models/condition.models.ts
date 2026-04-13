import type { conditionDefinitions } from '../../data/conditions/conditionDefinitions';
import type { ResourceType } from './resource.models';

/** Derived from definition keys — add new conditions by editing conditionDefinitions. */
export type ConditionId = keyof typeof conditionDefinitions;

export type ConditionSentiment = 'positive' | 'negative' | 'neutral';

export type ConditionSourceType =
  | 'random-event'
  | 'research'
  | 'politics'
  | 'building'
  | 'system';

/**
 * Modifier payload describing how an active condition affects the game.
 * Flat modifiers are additive; multipliers are multiplicative (1.0 = no change).
 */
export interface ConditionEffects {
  /** Flat per-turn resource delta (e.g. { gold: -5 } = lose 5 gold/turn). */
  resourceModifiers?: Partial<Record<ResourceType, number>>;
  /**
   * Percentage multiplier on passive building income per resource type.
   * 1.0 = no change, 0.7 = −30%, 1.5 = +50%.
   */
  resourceMultipliers?: Partial<Record<ResourceType, number>>;
  /** Flat combat stat adjustments during battles. */
  combatModifiers?: { attackBonus?: number; defenseBonus?: number };
  /** Multiplier on building construction speed (1.0 = normal, 0.8 = 20% slower). */
  buildSpeedModifier?: number;
  /** Multiplier on research progress speed (1.0 = normal, 1.15 = 15% faster). */
  researchSpeedModifier?: number;
  /** Per-turn focus delta applied during focus reset. */
  focusModifier?: number;
  /** Multiplier on monthly upkeep cost (1.0 = normal, 1.3 = +30%). */
  upkeepMultiplier?: number;
}

/** Static, data-driven definition of a condition. */
export interface ConditionDefinition {
  id: string;
  name: string;
  description: string;
  sentiment: ConditionSentiment;
  /** Default duration in turns when no override is supplied. */
  defaultDuration: number;
  effects: ConditionEffects;
  /** Whether multiple instances can stack. Defaults to false. */
  stackable?: boolean;
  /** Maximum number of stacks when stackable. Defaults to 1 if not stackable. */
  maxStacks?: number;
}

/** Runtime instance of an active condition. */
export interface ActiveCondition {
  conditionId: ConditionId;
  turnsRemaining: number;
  appliedOnTurn: number;
  sourceType: ConditionSourceType;
  sourceId?: string;
}

/** Serializable save state for the condition system. */
export interface ConditionSaveState {
  activeConditions: ActiveCondition[];
  version: number;
}
