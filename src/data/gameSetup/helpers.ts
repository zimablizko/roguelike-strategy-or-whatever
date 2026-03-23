import type {
  GameSetupData,
  MapSizeDefinition,
  MapSizeId,
  StatePrehistoryDefinition,
  StatePrehistoryId,
} from '../../_common/models/game-setup.models';
import { SeededRandom } from '../../_common/random';
import { mapSizeDefinitions } from './mapSizeDefinitions';
import { rulerNames } from './rulerNames';
import { stateNameRoots } from './stateNameRoots';
import { stateNameSuffixes } from './stateNameSuffixes';
import { statePrehistoryDefinitions } from './statePrehistoryDefinitions';

type RandomPicker = Pick<SeededRandom, 'randomInt'>;

function pickRandom<T>(items: readonly T[], rng: RandomPicker): T {
  return items[rng.randomInt(0, items.length - 1)];
}

export function generateStateName(rng: RandomPicker): string {
  return `${pickRandom(stateNameRoots, rng)}${pickRandom(stateNameSuffixes, rng)}`;
}

export function generateRulerName(rng: RandomPicker): string {
  return pickRandom(rulerNames, rng);
}

export function getMapSizeDefinition(id: MapSizeId): MapSizeDefinition {
  return mapSizeDefinitions[id];
}

export function getStatePrehistoryDefinition(
  id: StatePrehistoryId
): StatePrehistoryDefinition {
  return statePrehistoryDefinitions[id];
}

export function createDefaultGameSetup(
  rng: RandomPicker = new SeededRandom()
): GameSetupData {
  return {
    mapSize: 'medium',
    stateName: generateStateName(rng),
    rulerName: generateRulerName(rng),
    prehistory: 'distant-colony',
    rulerTraits: [],
  };
}
