import type { ResourceStock } from './resource.models';

export type PlayerRace = 'human' | 'elf' | 'dwarf' | 'orc';

export type PlayerData = {
  race: PlayerRace;
  resources: ResourceStock;
};

export type GameManagerOptions = {
  playerData: PlayerData;
  map?: {
    width?: number;
    height?: number;
  };
  /** Optional seed for reproducible randomness across all managers. */
  seed?: number;
};
