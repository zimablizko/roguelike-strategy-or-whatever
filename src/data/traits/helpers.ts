import { clamp } from '../../_common/math';
import type {
  RulerTraitApplicationInput,
  RulerTraitDefinition,
  RulerTraitId,
  RulerTraitPolarity,
} from '../../_common/models/ruler-traits.models';
import { RULER_HEALTH_LEVELS } from '../../_common/models/ruler.models';
import { rulerTraitDefinitions } from './traitDefinitions';

export const MAX_NEGATIVE_RULER_TRAITS = 1;
export const BASE_POSITIVE_RULER_TRAIT_LIMIT = 2;
export const BONUS_POSITIVE_RULER_TRAITS_PER_NEGATIVE = 1;

export function getRulerTraitDefinition(
  id: RulerTraitId
): RulerTraitDefinition | undefined {
  return rulerTraitDefinitions[id];
}

export function getAllRulerTraitDefinitions(): RulerTraitDefinition[] {
  return Object.values(rulerTraitDefinitions);
}

export function getRulerTraitsByPolarity(
  polarity: RulerTraitPolarity
): RulerTraitDefinition[] {
  return getAllRulerTraitDefinitions().filter(
    (trait) => trait.polarity === polarity
  );
}

export function normalizeRulerTraitIds(
  traitIds: readonly RulerTraitId[] | undefined
): RulerTraitId[] {
  if (!traitIds) {
    return [];
  }

  const seen = new Set<RulerTraitId>();
  const normalized: RulerTraitId[] = [];

  for (const traitId of traitIds) {
    if (seen.has(traitId) || !getRulerTraitDefinition(traitId)) {
      continue;
    }

    seen.add(traitId);
    normalized.push(traitId);
  }

  return normalized;
}

export function resolveRulerTraits(
  traitIds: readonly RulerTraitId[] | undefined
): RulerTraitDefinition[] {
  return normalizeRulerTraitIds(traitIds)
    .map((traitId) => getRulerTraitDefinition(traitId))
    .filter((trait): trait is RulerTraitDefinition => Boolean(trait));
}

export function countRulerTraitsByPolarity(
  traitIds: readonly RulerTraitId[] | undefined,
  polarity: RulerTraitPolarity
): number {
  return resolveRulerTraits(traitIds).filter(
    (trait) => trait.polarity === polarity
  ).length;
}

export function getPositiveRulerTraitSelectionLimit(
  traitIds: readonly RulerTraitId[] | undefined
): number {
  const negativeCount = countRulerTraitsByPolarity(traitIds, 'negative');
  return (
    BASE_POSITIVE_RULER_TRAIT_LIMIT +
    negativeCount * BONUS_POSITIVE_RULER_TRAITS_PER_NEGATIVE
  );
}

export function isRulerTraitSelectionValid(
  traitIds: readonly RulerTraitId[] | undefined
): boolean {
  const normalized = normalizeRulerTraitIds(traitIds);
  const positiveCount = countRulerTraitsByPolarity(normalized, 'positive');
  const negativeCount = countRulerTraitsByPolarity(normalized, 'negative');

  return (
    negativeCount <= MAX_NEGATIVE_RULER_TRAITS &&
    positiveCount <= getPositiveRulerTraitSelectionLimit(normalized)
  );
}

export function applyRulerTraitEffects(
  input: RulerTraitApplicationInput,
  traitIds: readonly RulerTraitId[] | undefined
): RulerTraitApplicationInput {
  const result: RulerTraitApplicationInput = { ...input };

  for (const trait of resolveRulerTraits(traitIds)) {
    const effect = trait.effect;
    if (!effect) {
      continue;
    }

    result.age = Math.max(18, result.age + (effect.age ?? 0));
    result.focus = clamp(result.focus + (effect.focus ?? 0), 1, 20);
    result.charisma = clamp(result.charisma + (effect.charisma ?? 0), 1, 20);

    if (effect.healthStep) {
      const currentIndex = RULER_HEALTH_LEVELS.indexOf(result.health);
      const nextIndex = clamp(
        currentIndex + effect.healthStep,
        0,
        RULER_HEALTH_LEVELS.length - 1
      );
      result.health = RULER_HEALTH_LEVELS[nextIndex];
    }
  }

  return result;
}
