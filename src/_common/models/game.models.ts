import type { TechnologyId } from './buildings.models';
import type { GameSetupData } from './game-setup.models';
import type { UnitRole } from './military.models';
import type { ResourceStock } from './resource.models';
import type { GameSaveData } from './save.models';
import type { RulerManagerOptions } from './ruler.models';
import type { StateManagerOptions } from './state.models';

export type PlayerRace = 'human' | 'elf' | 'dwarf' | 'orc';

export type PlayerData = {
  race: PlayerRace;
  resources: ResourceStock;
};

export type GameManagerOptions = {
  playerData?: PlayerData;
  map?: {
    width?: number;
    height?: number;
  };
  ruler?: RulerManagerOptions['initial'];
  state?: StateManagerOptions['initial'];
  startingTechnologies?: TechnologyId[];
  startingUnits?: Array<{ unitId: UnitRole; count: number }>;
  setup?: GameSetupData;
  /** Optional seed for reproducible randomness across all managers. */
  seed?: number;
  saveData?: GameSaveData;
};
