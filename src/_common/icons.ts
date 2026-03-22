import { ImageSource, Sprite, SpriteSheet } from 'excalibur';
import type { ResourceType } from './models/resource.models';

/** Pixel size of each cell in the icons spritesheet. */
const CELL_SIZE = 24;

/**
 * Layout map: icon name → { col, row } (0-indexed) in icons-spritesheet.png.
 *
 * Current grid (7 columns × 3 rows, 24×24 px each):
 *
 *  row 0:  stone  | resources | population | money | wheat
 *  row 1:  lumber | goldenOre | food       | focus
 *  row 2:  dummy  |           |            |
 *
 * To add a new icon: drop it in the spritesheet and add an entry below.
 * The `col` and `row` values are the 0-based grid coordinates.
 */
export const ICON_LAYOUT = {
  stone: { col: 0, row: 0 },
  resources: { col: 1, row: 0 },
  population: { col: 2, row: 0 },
  money: { col: 3, row: 0 },
  wheat: { col: 4, row: 0 },
  jewelry: { col: 5, row: 0 },
  ironOre: { col: 6, row: 0 },
  lumber: { col: 0, row: 1 },
  goldenOre: { col: 1, row: 1 },
  food: { col: 2, row: 1 },
  focus: { col: 3, row: 1 },
  dummy: { col: 0, row: 2 },
} as const satisfies Record<string, { col: number; row: number }>;

export type IconId = keyof typeof ICON_LAYOUT;

/** Single ImageSource for the whole icon spritesheet. Register in the Excalibur Loader. */
export const IconsSpritesheet = new ImageSource(
  './images/icons-spritesheet.png'
);

/** Internal SpriteSheet — constructed eagerly; sprites are valid before the image loads. */
const iconSheet = SpriteSheet.fromImageSource({
  image: IconsSpritesheet,
  grid: {
    rows: 3,
    columns: 7,
    spriteWidth: CELL_SIZE,
    spriteHeight: CELL_SIZE,
  },
});

/**
 * Returns a new, independently resizable Sprite for the given icon at `size` px.
 * Each call clones the base sheet sprite so callers may resize freely.
 * Falls back to the `dummy` icon if the ID is somehow out-of-bounds.
 */
export function getIconSprite(id: IconId, size: number = CELL_SIZE): Sprite {
  const { col, row } = ICON_LAYOUT[id];
  const base =
    iconSheet.getSprite(col, row) ??
    iconSheet.getSprite(ICON_LAYOUT.dummy.col, ICON_LAYOUT.dummy.row)!;
  const sprite = base.clone();
  sprite.width = size;
  sprite.height = size;
  return sprite;
}

/**
 * Maps resource types (plus the synthetic `'food'` display key) to their icon ID.
 * Unmapped types fall back to `'dummy'`.
 */
const RESOURCE_ICON_IDS: Partial<Record<ResourceType | 'food', IconId>> = {
  gold: 'money',
  wood: 'lumber',
  stone: 'stone',
  jewelry: 'jewelry',
  ironOre: 'ironOre',
  population: 'population',
  wheat: 'wheat',
  meat: 'food',
  bread: 'food',
  food: 'food',
};

/**
 * Convenience wrapper: returns the icon Sprite for a resource type (or the
 * synthetic `'food'` key used by the resource display).
 */
export function getResourceIcon(
  resourceType: ResourceType | 'food',
  size?: number
): Sprite {
  const id = RESOURCE_ICON_IDS[resourceType] ?? 'dummy';
  return getIconSprite(id, size);
}
