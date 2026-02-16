import type { MapTileType } from './map.models';
import type { ResourceCost, ResourceType } from './resource.models';

export type TechnologyId = string;

export interface BuildingActionContext {
  state: Readonly<{
    tiles: { forest: number; stone: number; plains: number; river: number };
    ocean: number;
  }>;
  resources: { addResource(type: string, amount: number): void };
  buildingCount: number;
}

export interface StateBuildingActionDefinition {
  id: string;
  name: string;
  description: string;
  run: (context: BuildingActionContext) => void;
}

export interface StateBuildingDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  buildCost: ResourceCost;
  costGrowth: number;
  unique: boolean;
  /** Population this building adds to the total cap (e.g. House +5, Castle +10). */
  populationProvided?: number;
  /** Free population required to operate this building (occupied, not consumed). */
  populationRequired?: number;
  placementRule: {
    width: number;
    height: number;
    allowedTiles: MapTileType[];
    fallbackReplacementTile?: MapTileType;
  };
  placementDescription: string;
  requiredTechnologies: TechnologyId[];
  getStats: (
    state: Readonly<{
      tiles: { forest: number; stone: number; plains: number; river: number };
      ocean: number;
    }>,
    count: number
  ) => string[];
  actions: StateBuildingActionDefinition[];
}

export interface BuildingPassiveIncome {
  resourceType: ResourceType;
  amount: number | 'random:5:20';
}

export type StateBuildingId =
  keyof typeof import('../../data/buildings').stateBuildingDefinitions;

export type TypedBuildingDefinition = StateBuildingDefinition & {
  id: StateBuildingId;
};
