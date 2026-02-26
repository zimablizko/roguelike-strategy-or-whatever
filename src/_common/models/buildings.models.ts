import type { MapTileType } from './map.models';
import type { ResourceCost, ResourceType } from './resource.models';

export type TechnologyId = string;

export interface BuildingActionInstanceInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BuildingActionContext {
  state: Readonly<{
    tiles: { forest: number; stone: number; plains: number; river: number };
    ocean: number;
  }>;
  resources: { addResource(type: string, amount: number): void };
  /** Get the current amount of a specific resource. */
  getResource: (type: string) => number;
  /** Check whether a technology has been researched. */
  isTechnologyUnlocked: (id: string) => boolean;
  buildingCount: number;
  /** All placed instances of the building that triggered the action. */
  buildingInstances: ReadonlyArray<BuildingActionInstanceInfo>;
  /** Read a map tile by tile coordinates. Returns undefined if out of bounds. */
  mapGetTile: (x: number, y: number) => MapTileType | undefined;
  isInPlayerZone: (x: number, y: number) => boolean;
  /** Write a map tile. Triggers state re-sync and version bump automatically. */
  mapSetTile: (x: number, y: number, tile: MapTileType) => void;
}

export interface BuildingActionCanRunResult {
  activatable: boolean;
  reason?: string;
}

export interface StateBuildingActionDefinition {
  id: string;
  name: string;
  description: string;
  /**
   * Number of times this action can be used per turn per building instance. Defaults to 1.
   * Example: charges=2 means a single instance of that building can use this action twice per turn.
   */
  charges?: number;
  /**
   * Optional guard evaluated at action-check time. When provided, its result
   * replaces the default "activatable: true" check (use-counts are still
   * enforced separately). Return a reason string when not activatable.
   */
  canRun?: (context: BuildingActionContext) => BuildingActionCanRunResult;
  /**
   * When true, clicking this action in the UI enters a tile-placement mode
   * instead of executing the action immediately. Focus is only spent after
   * the player confirms the placement.
   */
  requiresTilePlacement?: boolean;
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
  /**
   * Number of turns required to finish constructing this building after placement.
   * 0 or undefined means it completes instantly (same turn). Default: 0.
   */
  buildingTime?: number;
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
  amount: number | `random:${number}:${number}`;
}

export type StateBuildingId =
  keyof typeof import('../../data/buildings').stateBuildingDefinitions;

export type TypedBuildingDefinition = StateBuildingDefinition & {
  id: StateBuildingId;
};
