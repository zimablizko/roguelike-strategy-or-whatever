import type { MapTileType } from '../_common/models/map.models';
import type { RareResourceDefinition } from '../_common/models/rare-resource.models';

export const rareResourceDefinitions = {
  'iron-ore': {
    id: 'iron-ore',
    name: 'Iron Ore',
    description:
      'A rich iron deposit. Build a Mine on it for +2 Iron Ore per turn.',
    spawnOnTiles: ['rocks'] as MapTileType[],
    spawnChance: 0.06,
    visible: true,
    icon: 'ironOre',
    requiresContiguous2x2: true,
    bonusBuilding: 'mine',
    bonus: {
      resourceType: 'ironOre',
      amount: 2,
    },
  },
  'golden-ore': {
    id: 'golden-ore',
    name: 'Golden Ore',
    description:
      'A vein of rare gold-bearing rock. Build a Mine on it for +5 Gold per turn.',
    spawnOnTiles: ['rocks'] as MapTileType[],
    spawnChance: 0.03,
    visible: true,
    icon: 'goldenOre',
    requiresContiguous2x2: true,
    bonusBuilding: 'mine',
    bonus: {
      resourceType: 'gold',
      amount: 5,
    },
  },
  jewelry: {
    id: 'jewelry',
    name: 'Jewelry Cache',
    description:
      'A rare seam of gemstones and worked ornaments. Build a Mine on it for +1 Jewelry per turn.',
    spawnOnTiles: ['rocks'] as MapTileType[],
    spawnChance: 0.015,
    visible: true,
    icon: 'jewelry',
    requiresContiguous2x2: true,
    bonusBuilding: 'mine',
    bonus: {
      resourceType: 'jewelry',
      amount: 1,
    },
  },
} as const satisfies Record<string, RareResourceDefinition>;

export type RareResourceId = keyof typeof rareResourceDefinitions;
