import { ImageSource, Sprite, SpriteSheet } from 'excalibur';

/** Pixel size of each cell in the buildings spritesheet. */
const CELL_SIZE = 48;

/**
 * Layout map: sprite key → { col, row } (0-indexed) in buildings-spritesheet.png.
 *
 * Current grid (cell size 48×48 px):
 *
 *  row 0:  castle | house | lumbermill | hunters-hut | farm | field | field-empty
 *  row 1:  bakery | barracks | market | fishery | mine
 *
 * To add a new sprite: add a cell to the spritesheet and register it below.
 * Update `columns` / `rows` in the SpriteSheet grid if the sheet dimensions grow.
 */
export const SPRITE_LAYOUT = {
  castle: { col: 0, row: 0 },
  house: { col: 1, row: 0 },
  lumbermill: { col: 2, row: 0 },
  'hunters-hut': { col: 3, row: 0 },
  farm: { col: 4, row: 0 },
  field: { col: 5, row: 0 },
  'field-empty': { col: 6, row: 0 },
  bakery: { col: 0, row: 1 },
  barracks: { col: 1, row: 1 },
  market: { col: 2, row: 1 },
  fishery: { col: 3, row: 1 },
  mine: { col: 4, row: 1 },
} as const;

export type SpriteId = keyof typeof SPRITE_LAYOUT;

/** Single ImageSource for the whole buildings spritesheet. Register in the Excalibur Loader. */
export const BuildingsSpritesheet = new ImageSource(
  './images/buildings-spritesheet.png'
);

/** Internal SpriteSheet — constructed eagerly; sprites are valid before the image loads. */
const buildingSheet = SpriteSheet.fromImageSource({
  image: BuildingsSpritesheet,
  grid: {
    rows: 2,
    columns: 8,
    spriteWidth: CELL_SIZE,
    spriteHeight: CELL_SIZE,
  },
});

/**
 * Returns a new, independently resizable Sprite for the given key at `size` px,
 * or `undefined` if the key has no sprite defined.
 */
export function getBuildingSprite(
  spriteId: string,
  size: number = CELL_SIZE
): Sprite | undefined {
  if (!(spriteId in SPRITE_LAYOUT)) return undefined;
  const { col, row } = SPRITE_LAYOUT[spriteId as SpriteId];
  const base = buildingSheet.getSprite(col, row);
  if (!base) return undefined;
  const sprite = base.clone();
  sprite.width = size;
  sprite.height = size;
  return sprite;
}
