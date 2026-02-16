import type {
  BuildingActionContext,
  BuildingPassiveIncome,
  StateBuildingDefinition,
  StateBuildingId,
} from '../_common/models/buildings.models';
import type { MapTileType } from '../_common/models/map.models';

// ─── Passive income config per building type ─────────────────────────

export const buildingPassiveIncome: Record<string, BuildingPassiveIncome[]> = {
  castle: [
    { resourceType: 'gold', amount: 5 },
    { resourceType: 'food', amount: 5 },
    { resourceType: 'materials', amount: 5 },
  ],
  lumbermill: [{ resourceType: 'materials', amount: 10 }],
  mine: [{ resourceType: 'materials', amount: 'random:5:20' }],
  farm: [{ resourceType: 'food', amount: 10 }],
};

// ─── Building definitions ────────────────────────────────────────────

export const stateBuildingDefinitions = {
  castle: {
    id: 'castle',
    name: 'Castle',
    shortName: 'Csl',
    description:
      'Capital fortification that anchors settlement growth. Only one Castle can exist. Provides +10 population. Passive income each end turn: +5 Gold, +5 Food, +5 Materials.',
    buildCost: {
      gold: 150,
      materials: 120,
    },
    costGrowth: 1.2,
    unique: true,
    populationProvided: 10,
    placementRule: {
      width: 3,
      height: 3,
      allowedTiles: ['plains', 'sand'] as MapTileType[],
      fallbackReplacementTile: 'plains' as MapTileType,
    },
    placementDescription: 'Requires 3x3 free Plains/Sand area.',
    requiredTechnologies: [],
    getStats: (_state: unknown, count: number) => [
      `Built: ${count}/1`,
      'Occupies 3x3 tiles',
    ],
    actions: [
      {
        id: 'expand-border',
        name: 'Expand',
        description:
          'Expand state borders by 1 cell in all directions if no edge or ocean blocks expansion.',
        run: () => {},
      },
    ],
  },
  house: {
    id: 'house',
    name: 'House',
    shortName: 'Hse',
    description:
      'Residential dwelling that shelters settlers and grows your workforce. Provides +5 population.',
    buildCost: {
      gold: 25,
      materials: 15,
    },
    costGrowth: 1.15,
    unique: false,
    populationProvided: 5,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['plains', 'sand'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Plains/Sand area.',
    requiredTechnologies: [],
    getStats: (_state: unknown, count: number) => [
      `Built: ${count}`,
      `Population provided: +${count * 5}`,
    ],
    actions: [],
  },
  lumbermill: {
    id: 'lumbermill',
    shortName: 'Lmb',
    name: 'Lumbermill',
    description:
      'Processes nearby forests into construction-grade materials. Requires 2 population to operate. Passive income each end turn: +10 Materials.',
    buildCost: {
      gold: 35,
      materials: 20,
    },
    costGrowth: 1.2,
    unique: false,
    populationRequired: 2,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['forest'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Forest area.',
    requiredTechnologies: [],
    getStats: (state: { tiles: { forest: number } }, count: number) => {
      const baseYield = Math.max(1, Math.floor(state.tiles.forest / 4));
      return [
        `Built: ${count}`,
        `Forests: ${state.tiles.forest}`,
        `Action yield: +${baseYield * Math.max(1, count)} Materials`,
      ];
    },
    actions: [
      {
        id: 'process-timber',
        name: 'Process Timber',
        description:
          'Convert nearby timber supply into materials based on forest tiles.',
        run: ({ state, resources, buildingCount }: BuildingActionContext) => {
          const gain =
            Math.max(1, Math.floor(state.tiles.forest / 4)) *
            Math.max(1, buildingCount);
          resources.addResource('materials', gain);
        },
      },
    ],
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    shortName: 'Min',
    description:
      'Extracts ore and stone from rocky terrain, improving material throughput. Requires 3 population to operate. Passive income each end turn: +5 to +20 Materials.',
    buildCost: {
      gold: 45,
      materials: 30,
    },
    costGrowth: 1.2,
    unique: false,
    populationRequired: 3,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['rocks'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Rocks area.',
    requiredTechnologies: [],
    getStats: (state: { tiles: { stone: number } }, count: number) => {
      const baseYield = Math.max(1, Math.floor(state.tiles.stone / 4));
      return [
        `Built: ${count}`,
        `Stone tiles: ${state.tiles.stone}`,
        `Action yield: +${baseYield * Math.max(1, count)} Materials`,
      ];
    },
    actions: [
      {
        id: 'extract-ore',
        name: 'Extract Ore',
        description: 'Mine stone deposits and add materials to your stockpile.',
        run: ({ state, resources, buildingCount }: BuildingActionContext) => {
          const gain =
            Math.max(1, Math.floor(state.tiles.stone / 4)) *
            Math.max(1, buildingCount);
          resources.addResource('materials', gain);
        },
      },
    ],
  },
  farm: {
    id: 'farm',
    shortName: 'Frm',
    name: 'Farm',
    description:
      'Stores and preserves food gathered from fertile plains for future turns. Requires 2 population to operate. Passive income each end turn: +10 Food.',
    buildCost: {
      gold: 40,
      materials: 24,
    },
    costGrowth: 1.2,
    unique: false,
    populationRequired: 2,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['plains'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Plains area.',
    requiredTechnologies: ['eco-agriculture'],
    getStats: (state: { tiles: { plains: number } }, count: number) => {
      const baseYield = Math.max(1, Math.floor(state.tiles.plains / 4));
      return [
        `Built: ${count}`,
        `Plains: ${state.tiles.plains}`,
        `Action yield: +${baseYield * Math.max(1, count)} Food`,
      ];
    },
    actions: [
      {
        id: 'gather-harvest',
        name: 'Gather Harvest',
        description: 'Collect and store harvest from plains tiles.',
        run: ({ state, resources, buildingCount }: BuildingActionContext) => {
          const gain =
            Math.max(1, Math.floor(state.tiles.plains / 4)) *
            Math.max(1, buildingCount);
          resources.addResource('food', gain);
        },
      },
    ],
  },
} as const satisfies Record<string, StateBuildingDefinition>;

/** Helper to create an empty building count record. */
export function createEmptyBuildingRecord(): Record<StateBuildingId, number> {
  const record = {} as Record<StateBuildingId, number>;
  for (const key of Object.keys(
    stateBuildingDefinitions
  ) as StateBuildingId[]) {
    record[key] = 0;
  }
  return record;
}
