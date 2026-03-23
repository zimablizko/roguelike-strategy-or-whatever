import type { TechnologyId } from './buildings.models';
import type { UnitRole } from './military.models';
import type { ResourceCost } from './resource.models';

export type MapSizeId = 'small' | 'medium' | 'large';

export type StatePrehistoryId =
  | 'distant-colony'
  | 'military-campaign'
  | 'farmers-community';

export interface GameSetupData {
  mapSize: MapSizeId;
  stateName: string;
  rulerName: string;
  prehistory: StatePrehistoryId;
  rulerTraits: string[];
}

export interface MapSizeDefinition {
  id: MapSizeId;
  label: string;
  width: number;
  height: number;
  description: string;
}

export interface StartingUnitGrant {
  unitId: UnitRole;
  count: number;
}

export interface StatePrehistoryDefinition {
  id: StatePrehistoryId;
  label: string;
  description: string;
  effectSummary: string;
  startingResources?: ResourceCost;
  startingTechnologies?: TechnologyId[];
  startingUnits?: StartingUnitGrant[];
}
