import { ImageSource, Sprite, SpriteSheet } from 'excalibur';
import type { StateBuildingId } from './models/buildings.models';

/** Pixel size of each cell in the buildings spritesheet. */
const CELL_SIZE = 48;

/**
 * Layout map: building ID → { col, row } (0-indexed) in buildings-spritesheet.png.
 *
 * Current grid (cell size 48×48 px):
 *
 *  row 0:  castle | house | lumbermill | hunters-hut | farm
 *
 * To add a new building sprite: add a cell to the spritesheet and register it below.
 * Update `columns` / `rows` in the SpriteSheet grid if the sheet dimensions grow.
 */
export const BUILDING_LAYOUT = {
  castle:       { col: 0, row: 0 },
  house:        { col: 1, row: 0 },
  lumbermill:   { col: 2, row: 0 },
  'hunters-hut': { col: 3, row: 0 },
  farm:         { col: 4, row: 0 },
} as const satisfies Partial<Record<StateBuildingId, { col: number; row: number }>>;

export type BuildingSpriteId = keyof typeof BUILDING_LAYOUT;

/** Single ImageSource for the whole buildings spritesheet. Register in the Excalibur Loader. */
export const BuildingsSpritesheet = new ImageSource(
  './images/buildings-spritesheet.png'
);

/** Internal SpriteSheet — constructed eagerly; sprites are valid before the image loads. */
const buildingSheet = SpriteSheet.fromImageSource({
  image: BuildingsSpritesheet,
  grid: {
    rows: 1,
    columns: 5,
    spriteWidth: CELL_SIZE,
    spriteHeight: CELL_SIZE,
  },
});

/**
 * Returns a new, independently resizable Sprite for the given building at `size` px,
 * or `undefined` if the building has no sprite defined.
 */
export function getBuildingSprite(
  buildingId: StateBuildingId,
  size: number = CELL_SIZE
): Sprite | undefined {
  if (!(buildingId in BUILDING_LAYOUT)) return undefined;
  const { col, row } = BUILDING_LAYOUT[buildingId as BuildingSpriteId];
  const base = buildingSheet.getSprite(col, row);
  if (!base) return undefined;
  const sprite = base.clone();
  sprite.width = size;
  sprite.height = size;
  return sprite;
}
