import type { SeededRandom } from '../random';
import type { RareResourceMap } from './rare-resource.models';

export type MapTileType =
  | 'plains'
  | 'forest'
  | 'rocks'
  | 'sand'
  | 'river'
  | 'ocean'
  | 'field'
  | 'field-empty';

export interface MapPlayerStateSummary {
  tiles: {
    forest: number;
    stone: number;
    plains: number;
    river: number;
  };
  size: number;
  ocean: number;
}

export interface MapData {
  width: number;
  height: number;
  tiles: MapTileType[][];
  zones: (number | null)[][];
  zoneCount: number;
  playerZoneId: number | null;
  rareResources: RareResourceMap;
}

export interface MapManagerOptions {
  width?: number;
  height?: number;
  rng?: SeededRandom;
  initialMap?: MapData;
}

export interface MapCell {
  x: number;
  y: number;
}

export interface VoronoiPoint {
  x: number;
  y: number;
}

export type OceanEdge = 'west' | 'east' | 'north' | 'south';
export type OceanLayout =
  | OceanEdge
  | 'north-west'
  | 'north-east'
  | 'south-west'
  | 'south-east'
  | 'center'
  | 'none';

export type RiverStartType = 'ocean' | 'river' | 'rocks';

export interface RiverStart extends MapCell {
  type: RiverStartType;
}
