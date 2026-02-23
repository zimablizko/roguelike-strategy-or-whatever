import type { StateBuildingInstance } from './building-manager.models';
import type { StateBuildingId, TechnologyId } from './buildings.models';
import type { PlayerData } from './game.models';
import type { MapData } from './map.models';
import type {
  ActiveResearchState,
  CompletedResearchSummary,
} from './research-manager.models';
import type { ResearchId } from './researches.models';
import type { ResourceStock } from './resource.models';
import type { StateData } from './state.models';
import type { TurnData } from './turn.models';

export type SaveSlotId = 1 | 2 | 3;

export interface GameSaveData {
  version: 1;
  savedAt: number;
  playerData: PlayerData;
  rngState: number;
  map: MapData;
  resources: ResourceStock;
  ruler: {
    name: string;
    age: number;
    popularity: number;
  };
  state: StateData;
  buildings: {
    counts: Record<StateBuildingId, number>;
    instances: StateBuildingInstance[];
    instanceSerial: number;
    technologies: TechnologyId[];
  };
  research: {
    activeResearch?: ActiveResearchState;
    completedResearches: ResearchId[];
    latestCompletion?: CompletedResearchSummary;
    researchVersion: number;
  };
  turn: {
    data: TurnData;
    version: number;
    /** Tracks fallow field tiles awaiting recovery. Key is "x,y", value is turns remaining. */
    emptyFieldQueue?: Array<{ x: number; y: number; turnsLeft: number }>;
  };
}

export interface SaveSlotSummary {
  slot: SaveSlotId;
  used: boolean;
  savedAt?: number;
  turnNumber?: number;
  rulerName?: string;
  stateName?: string;
}

export interface PendingGameLaunch {
  slot: SaveSlotId;
  mode: 'new' | 'continue';
}
