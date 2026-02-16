import type { SeededRandom } from '../random';
import type { MapPlayerStateSummary } from './map.models';

export type StateTiles = {
  forest: number;
  stone: number;
  plains: number;
  river: number;
};

export type StateData = {
  name: string;
  size: number;
  tiles: StateTiles;
  ocean: number;
};

export interface StateManagerOptions {
  rng?: SeededRandom;
  initial?: Partial<Omit<StateData, 'size' | 'tiles'>> & {
    tiles?: Partial<StateTiles>;
  };
}

export type StateSummarySync = MapPlayerStateSummary;
