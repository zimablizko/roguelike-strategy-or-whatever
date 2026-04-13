import type {
  ActiveCondition,
  ConditionDefinition,
  ConditionEffects,
  ConditionId,
} from '../../_common/models/condition.models';
import { conditionDefinitions } from './conditionDefinitions';

const definitionMap = new Map<string, ConditionDefinition>(
  Object.values(conditionDefinitions).map((d) => [d.id, d])
);

/** Look up a condition definition by ID. */
export function getConditionDefinition(
  id: ConditionId | string
): ConditionDefinition | undefined {
  return definitionMap.get(id);
}

/** Return all condition definition entries. */
export function getAllConditionDefinitions(): ConditionDefinition[] {
  return Object.values(conditionDefinitions);
}

/** Check whether a string is a known condition ID. */
export function isConditionId(id: string): id is ConditionId {
  return definitionMap.has(id);
}

/**
 * Aggregate effects from a list of active conditions into a single summary.
 * - Flat modifiers (resourceModifiers, combatModifiers, focusModifier) are summed.
 * - Multipliers (resourceMultipliers, buildSpeedModifier, researchSpeedModifier, upkeepMultiplier) are multiplied.
 */
export function aggregateConditionEffects(
  activeConditions: readonly ActiveCondition[]
): ConditionEffects {
  const result: ConditionEffects = {};

  for (const active of activeConditions) {
    const definition = getConditionDefinition(active.conditionId);
    if (!definition) continue;
    const fx = definition.effects;

    // --- Flat resource modifiers (sum) ---
    if (fx.resourceModifiers) {
      if (!result.resourceModifiers) result.resourceModifiers = {};
      for (const [key, value] of Object.entries(fx.resourceModifiers)) {
        const k = key as keyof typeof fx.resourceModifiers;
        result.resourceModifiers[k] =
          (result.resourceModifiers[k] ?? 0) + (value ?? 0);
      }
    }

    // --- Resource multipliers (multiply) ---
    if (fx.resourceMultipliers) {
      if (!result.resourceMultipliers) result.resourceMultipliers = {};
      for (const [key, value] of Object.entries(fx.resourceMultipliers)) {
        const k = key as keyof typeof fx.resourceMultipliers;
        result.resourceMultipliers[k] =
          (result.resourceMultipliers[k] ?? 1) * (value ?? 1);
      }
    }

    // --- Combat modifiers (sum) ---
    if (fx.combatModifiers) {
      if (!result.combatModifiers) result.combatModifiers = {};
      result.combatModifiers.attackBonus =
        (result.combatModifiers.attackBonus ?? 0) +
        (fx.combatModifiers.attackBonus ?? 0);
      result.combatModifiers.defenseBonus =
        (result.combatModifiers.defenseBonus ?? 0) +
        (fx.combatModifiers.defenseBonus ?? 0);
    }

    // --- Build speed multiplier (multiply) ---
    if (fx.buildSpeedModifier !== undefined) {
      result.buildSpeedModifier =
        (result.buildSpeedModifier ?? 1) * fx.buildSpeedModifier;
    }

    // --- Research speed multiplier (multiply) ---
    if (fx.researchSpeedModifier !== undefined) {
      result.researchSpeedModifier =
        (result.researchSpeedModifier ?? 1) * fx.researchSpeedModifier;
    }

    // --- Focus modifier (sum) ---
    if (fx.focusModifier !== undefined) {
      result.focusModifier = (result.focusModifier ?? 0) + fx.focusModifier;
    }

    // --- Upkeep multiplier (multiply) ---
    if (fx.upkeepMultiplier !== undefined) {
      result.upkeepMultiplier =
        (result.upkeepMultiplier ?? 1) * fx.upkeepMultiplier;
    }
  }

  return result;
}
