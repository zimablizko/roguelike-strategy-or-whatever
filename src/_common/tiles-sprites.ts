import { ImageSource, Sprite, SpriteSheet } from 'excalibur';
import type { MapTileType } from './models/map.models';

export const TILE_CELL_SIZE = 24;

export const TERRAIN_TILE_LAYOUT = {
  plains: { row: 0, variations: 3 },
  forest: { row: 1, variations: 3 },
  rocks: { row: 2, variations: 3 },
  sand: { row: 3, variations: 3 },
  river: { row: 4, variations: 3 },
  ocean: { row: 5, variations: 3 },
} as const satisfies Record<string, { row: number; variations: number }>;

export type TerrainTileId = keyof typeof TERRAIN_TILE_LAYOUT;

export const TilesSpritesheet = new ImageSource('./images/tiles-spritesheet.png');

const terrainSheet = SpriteSheet.fromImageSource({
  image: TilesSpritesheet,
  grid: {
    rows: 6,
    columns: 3,
    spriteWidth: TILE_CELL_SIZE,
    spriteHeight: TILE_CELL_SIZE,
  },
});

export function isTerrainTileId(tileId: MapTileType): tileId is TerrainTileId {
  return Object.prototype.hasOwnProperty.call(TERRAIN_TILE_LAYOUT, tileId);
}

function getTerrainVariantIndex(tileId: TerrainTileId, x: number, y: number): number {
  const { row, variations } = TERRAIN_TILE_LAYOUT[tileId];
  const hash =
    (((x + 1) * 73856093) ^ ((y + 1) * 19349663) ^ ((row + 1) * 83492791)) >>>
    0;
  return hash % variations;
}

export function getTerrainTileFrame(
  tileId: MapTileType,
  x: number,
  y: number
): { col: number; row: number } | undefined {
  if (!isTerrainTileId(tileId)) {
    return undefined;
  }

  return {
    col: getTerrainVariantIndex(tileId, x, y),
    row: TERRAIN_TILE_LAYOUT[tileId].row,
  };
}

export function getTerrainSprite(
  tileId: MapTileType,
  x: number,
  y: number,
  size: number = TILE_CELL_SIZE
): Sprite | undefined {
  const frame = getTerrainTileFrame(tileId, x, y);
  if (!frame) {
    return undefined;
  }

  const base = terrainSheet.getSprite(frame.col, frame.row);
  if (!base) {
    return undefined;
  }

  const sprite = base.clone();
  sprite.width = size;
  sprite.height = size;
  return sprite;
}
