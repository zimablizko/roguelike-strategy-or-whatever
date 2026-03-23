import type {
  RandomEventDefinition,
  RandomEventPresentation,
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
