import type {
  RandomEventDefinition,
  RandomEventPresentation,
  RandomEventSkillCheckDifficulty,
} from '../../_common/models/random-events.models';
import { randomEventDefinitions } from './randomEventDefinitions';

export type RandomEventId = keyof typeof randomEventDefinitions;

export function isRandomEventId(id: string): id is RandomEventId {
  return Object.prototype.hasOwnProperty.call(randomEventDefinitions, id);
}

export function getRandomEventDefinition(
  id: RandomEventId
): RandomEventDefinition | undefined {
  return randomEventDefinitions[id];
}

export function getAllRandomEventDefinitions(): RandomEventDefinition[] {
  return Object.values(randomEventDefinitions) as RandomEventDefinition[];
}

export function hasAvailableRandomEventOption(
  presentation: RandomEventPresentation
): boolean {
  return presentation.options.some((option) => !option.disabled);
}

export const RANDOM_EVENT_SKILL_CHECK_TARGETS: Record<
  RandomEventSkillCheckDifficulty,
  number
> = {
  easy: 10,
  normal: 15,
  hard: 20,
  'very-hard': 25,
  impossible: 30,
};

const RANDOM_EVENT_SKILL_CHECK_LABELS: Record<
  RandomEventSkillCheckDifficulty,
  string
> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  'very-hard': 'Very Hard',
  impossible: 'Impossible',
};

export function getRandomEventSkillCheckTarget(
  difficulty: RandomEventSkillCheckDifficulty | number
): number {
  return typeof difficulty === 'number'
    ? difficulty
    : RANDOM_EVENT_SKILL_CHECK_TARGETS[difficulty];
}

export function getRandomEventSkillCheckLabel(
  difficulty: RandomEventSkillCheckDifficulty | number,
  customLabel?: string
): string {
  if (customLabel) {
    return customLabel;
  }

  if (typeof difficulty !== 'number') {
    return RANDOM_EVENT_SKILL_CHECK_LABELS[difficulty];
  }

  if (difficulty <= RANDOM_EVENT_SKILL_CHECK_TARGETS.easy) {
    return RANDOM_EVENT_SKILL_CHECK_LABELS.easy;
  }
  if (difficulty <= RANDOM_EVENT_SKILL_CHECK_TARGETS.normal) {
    return RANDOM_EVENT_SKILL_CHECK_LABELS.normal;
  }
  if (difficulty <= RANDOM_EVENT_SKILL_CHECK_TARGETS.hard) {
    return RANDOM_EVENT_SKILL_CHECK_LABELS.hard;
  }
  if (difficulty <= RANDOM_EVENT_SKILL_CHECK_TARGETS['very-hard']) {
    return RANDOM_EVENT_SKILL_CHECK_LABELS['very-hard'];
  }

  return RANDOM_EVENT_SKILL_CHECK_LABELS.impossible;
}
