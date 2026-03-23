import type { MapManager } from '../../managers/MapManager';
import type { GameLogManager } from '../../managers/GameLogManager';
import type { UnitRole } from './military.models';
import type { SeededRandom } from '../random';
import type { StateBuildingId, TechnologyId } from './buildings.models';
import type { MapPlayerStateSummary, MapTileType } from './map.models';
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

export interface BuildingActionProgress {
  instanceId: string;
  buildingId: StateBuildingId;
  actionId: string;
  turnsLeft: number;
  unitId: UnitRole;
  unitCount: number;
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

export interface BuildingTileChange {
  x: number;
  y: number;
  from?: MapTileType;
  to: MapTileType;
  source: 'building-action' | 'field-placement' | 'turn-recovery';
}

export interface BuildingManagerOptions {
  mapManager?: MapManager;
  stateBridge: BuildingManagerStateBridge;
  rng?: SeededRandom;
  logManager?: GameLogManager;
  onTileChanged?: (change: BuildingTileChange) => void;
  initial?: {
    technologies?: TechnologyId[];
    builtBuildings?: Partial<Record<StateBuildingId, number | boolean>>;
    buildingInstances?: StateBuildingInstance[];
    buildingInstanceSerial?: number;
    actionProgresses?: BuildingActionProgress[];
  };
}
