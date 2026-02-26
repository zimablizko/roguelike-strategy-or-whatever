import type { MapManager } from '../../managers/MapManager';
import type { SeededRandom } from '../random';
import type { StateBuildingId, TechnologyId } from './buildings.models';
import type { MapPlayerStateSummary } from './map.models';
import type { ResourceCost } from './resource.models';
import type { StateData } from './state.models';

export interface StateBuildingBuildStatus {
  buildable: boolean;
  missingResources: ResourceCost;
  missingTechnologies: TechnologyId[];
  /** True when the building needs population but not enough free pop is available. */
  populationInsufficient: boolean;
  nextCost: ResourceCost;
  placementAvailable: boolean;
  placementReason?: string;
}

export interface StateBuildingActionStatus {
  activatable: boolean;
  reason?: string;
  /** Remaining uses this turn across all instances of this building. */
  usesRemaining?: number;
  /** Maximum uses this turn (building count × action charges). */
  usesMax?: number;
}

export interface StateBuildingInstance {
  instanceId: string;
  buildingId: StateBuildingId;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Number of turns remaining before this building finishes construction.
   * undefined (or 0) means the building is fully operational.
   */
  turnsRemaining?: number;
}

export interface StateBuildingMapOverlay extends StateBuildingInstance {
  name: string;
  shortName: string;
}

export interface StateBuildingPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BuildingMapCell {
  x: number;
  y: number;
}

export interface PlacementCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
  replacementCells: BuildingMapCell[];
  distanceSq: number;
}

export interface BuildingManagerStateBridge {
  getStateRef(): Readonly<StateData>;
  applyMapSummary(summary: MapPlayerStateSummary): void;
}

export interface BuildingManagerOptions {
  mapManager?: MapManager;
  stateBridge: BuildingManagerStateBridge;
  rng?: SeededRandom;
  initial?: {
    technologies?: TechnologyId[];
    builtBuildings?: Partial<Record<StateBuildingId, number | boolean>>;
    buildingInstances?: StateBuildingInstance[];
    buildingInstanceSerial?: number;
  };
}
