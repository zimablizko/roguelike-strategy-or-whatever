import type { MapTileType } from '../_common/models/map.models';
import type { RareResourceDefinition } from '../_common/models/rare-resource.models';
import { Resources } from '../_common/resources';

export const rareResourceDefinitions = {
  'golden-ore': {
    id: 'golden-ore',
    name: 'Golden Ore',
    description:
      'A vein of rare gold-bearing rock. Build a Mine on it for +5 Gold per turn.',
    spawnOnTiles: ['rocks'] as MapTileType[],
    spawnChance: 0.03,
    visible: true,
    icon: Resources.GoldenOreIcon,
    requiresContiguous2x2: true,
    bonusBuilding: 'mine',
    bonus: {
      resourceType: 'gold',
      amount: 5,
    },
  },
} as const satisfies Record<string, RareResourceDefinition>;

export type RareResourceId = keyof typeof rareResourceDefinitions;
