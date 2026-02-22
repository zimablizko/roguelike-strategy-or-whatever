import type { ImageSource } from 'excalibur';
import type { StateBuildingId } from './buildings.models';
import type { MapTileType } from './map.models';
import type { ResourceType } from './resource.models';

export interface RareResourceDefinition {
  id: string;
  name: string;
  description: string;
  spawnOnTiles: MapTileType[];
  spawnChance: number;
  visible: boolean;
  icon: ImageSource;
  bonusBuilding: StateBuildingId;
  bonus: {
    resourceType: ResourceType;
    amount: number | `random:${number}:${number}`;
  };
  /**
   * When true, the resource only spawns if the tile is part of a 2×2 block
   * where all four tiles share the same allowed tile type. Used to ensure
   * buildings with a 2×2 footprint can always be placed on the resource.
   */
  requiresContiguous2x2?: boolean;
}

export interface RareResourceInstance {
  resourceId: string;
  x: number;
  y: number;
  visible: boolean;
}

export type RareResourceMap = Record<string, RareResourceInstance>;
