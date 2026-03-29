import type {
  BuildingActionContext,
  StateBuildingDefinition,
} from '../../_common/models/buildings.models';
import type { MapTileType } from '../../_common/models/map.models';

export const stateBuildingDefinitions = {
  castle: {
    id: 'castle',
    name: 'Castle',
    shortName: 'Csl',
    description:
      'Capital fortification that anchors settlement growth. Only one Castle can exist.',
    buildCost: {
      gold: 150,
      wood: 60,
      stone: 60,
    },
    costGrowth: 1.2,
    unique: true,
    buildingTime: 2,
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
        id: 'call-to-arms',
        name: 'Call to Arms',
        description: 'Raise a levy of local militia.',
        run: () => {},
      },
    ],
  },
  house: {
    id: 'house',
    name: 'House',
    shortName: 'Hse',
    description:
      'Residential dwelling that shelters settlers and grows your workforce. With Tax Collection research: also generates gold each turn.',
    buildCost: {
      gold: 20,
      wood: 10,
    },
    costGrowth: 1.15,
    unique: false,
    buildingTime: 3,
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
      'Tax Collection: +2 Gold/turn per House',
    ],
    actions: [],
  },
  lumbermill: {
    id: 'lumbermill',
    shortName: 'Lmb',
    name: 'Lumbermill',
    description: 'Processes nearby forests into construction-grade lumber.',
    buildCost: {
      gold: 10,
      wood: 10,
    },
    costGrowth: 1.2,
    unique: false,
    buildingTime: 2,
    populationRequired: 2,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['forest'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Forest area.',
    requiredTechnologies: [],
    getStats: (_state: unknown, count: number) => [
      `Built: ${count}`,
      'Harvest range: 3 tiles',
    ],
    actions: [
      {
        id: 'harvest-timber',
        name: 'Harvest Timber',
        description:
          'Fell the nearest Forest tile within range 3 of this Lumbermill, converting it to Plains. Yields Wood based on forest density.',
        canRun: ({ buildingInstances, mapGetTile }) => {
          const RANGE = 3;
          for (const inst of buildingInstances) {
            const minTx = inst.x - RANGE;
            const maxTx = inst.x + inst.width - 1 + RANGE;
            const minTy = inst.y - RANGE;
            const maxTy = inst.y + inst.height - 1 + RANGE;
            for (let ty = minTy; ty <= maxTy; ty++) {
              for (let tx = minTx; tx <= maxTx; tx++) {
                if (mapGetTile(tx, ty) === 'forest') {
                  return { activatable: true };
                }
              }
            }
          }
          return {
            activatable: false,
            reason: 'No Forest tiles within range 3 of any Lumbermill.',
          };
        },
        run: ({ buildingInstances, mapGetTile, mapSetTile, resources }) => {
          const RANGE = 3;
          const forestInRange = new Map<
            number,
            { x: number; y: number; distSq: number }
          >();

          for (const inst of buildingInstances) {
            const cx = inst.x + inst.width / 2;
            const cy = inst.y + inst.height / 2;
            const minTx = inst.x - RANGE;
            const maxTx = inst.x + inst.width - 1 + RANGE;
            const minTy = inst.y - RANGE;
            const maxTy = inst.y + inst.height - 1 + RANGE;

            for (let ty = minTy; ty <= maxTy; ty++) {
              for (let tx = minTx; tx <= maxTx; tx++) {
                if (mapGetTile(tx, ty) !== 'forest') continue;
                const dx = tx + 0.5 - cx;
                const dy = ty + 0.5 - cy;
                const distSq = dx * dx + dy * dy;
                const key = ty * 100000 + tx;
                const existing = forestInRange.get(key);
                if (existing === undefined || existing.distSq > distSq) {
                  forestInRange.set(key, { x: tx, y: ty, distSq });
                }
              }
            }
          }

          if (forestInRange.size === 0) return;

          const sorted = Array.from(forestInRange.values()).sort(
            (a, b) => a.distSq - b.distSq
          );
          const nearest = sorted[0];

          mapSetTile(nearest.x, nearest.y, 'plains');

          const forestCount = sorted.length;
          let totalYield = 0;
          for (let i = 0; i < forestCount; i++) {
            totalYield += Math.max(1, Math.round(3 * Math.pow(0.9, i)));
          }
          resources.addResource('wood', totalYield);
        },
      },
      {
        id: 'plant-trees',
        name: 'Plant Trees',
        description:
          'Convert the nearest Plain or Sand tile within range 3 of this Lumbermill into a Forest tile. Costs 10 Gold.',
        canRun: ({
          buildingInstances,
          mapGetTile,
          isTechnologyUnlocked,
          getResource,
        }) => {
          if (!isTechnologyUnlocked('eco-forestry')) {
            return {
              activatable: false,
              reason: 'Requires Forestry research.',
            };
          }
          const RANGE = 3;
          for (const inst of buildingInstances) {
            const minTx = inst.x - RANGE;
            const maxTx = inst.x + inst.width - 1 + RANGE;
            const minTy = inst.y - RANGE;
            const maxTy = inst.y + inst.height - 1 + RANGE;
            for (let ty = minTy; ty <= maxTy; ty++) {
              for (let tx = minTx; tx <= maxTx; tx++) {
                const tile = mapGetTile(tx, ty);
                if (tile === 'plains' || tile === 'sand') {
                  if (getResource('gold') < 10) {
                    return { activatable: false, reason: 'Requires 10 Gold.' };
                  }
                  return { activatable: true };
                }
              }
            }
          }
          return {
            activatable: false,
            reason:
              'No Plains or Sand tiles within range 3 of this Lumbermill.',
          };
        },
        run: ({
          buildingInstances,
          mapGetTile,
          mapSetTile,
          resources,
          getResource,
        }) => {
          if (getResource('gold') < 10) return;

          const RANGE = 3;
          const candidates = new Map<
            number,
            { x: number; y: number; distSq: number }
          >();

          for (const inst of buildingInstances) {
            const cx = inst.x + inst.width / 2;
            const cy = inst.y + inst.height / 2;
            const minTx = inst.x - RANGE;
            const maxTx = inst.x + inst.width - 1 + RANGE;
            const minTy = inst.y - RANGE;
            const maxTy = inst.y + inst.height - 1 + RANGE;

            for (let ty = minTy; ty <= maxTy; ty++) {
              for (let tx = minTx; tx <= maxTx; tx++) {
                const tile = mapGetTile(tx, ty);
                if (tile !== 'plains' && tile !== 'sand') continue;
                const dx = tx + 0.5 - cx;
                const dy = ty + 0.5 - cy;
                const distSq = dx * dx + dy * dy;
                const key = ty * 100000 + tx;
                const existing = candidates.get(key);
                if (existing === undefined || existing.distSq > distSq) {
                  candidates.set(key, { x: tx, y: ty, distSq });
                }
              }
            }
          }

          if (candidates.size === 0) return;

          const nearest = Array.from(candidates.values()).sort(
            (a, b) => a.distSq - b.distSq
          )[0];

          mapSetTile(nearest.x, nearest.y, 'forest');
          resources.addResource('gold', -10);
        },
      },
    ],
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    shortName: 'Min',
    description:
      'Extracts ore and stone from rocky terrain, improving stone throughput.',
    buildCost: {
      gold: 30,
      wood: 15,
    },
    costGrowth: 1.2,
    unique: false,
    buildingTime: 4,
    populationRequired: 3,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['rocks'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Rocks area.',
    requiredTechnologies: ['eco-mining'],
    getStats: (state: { tiles: { stone: number } }, count: number) => {
      const baseYield = Math.max(1, Math.floor(state.tiles.stone / 4));
      return [
        `Built: ${count}`,
        `Stone tiles: ${state.tiles.stone}`,
        `Action yield: +${baseYield * Math.max(1, count)} Stone`,
      ];
    },
    actions: [
      {
        id: 'extract-ore',
        name: 'Extract Ore',
        description: 'Mine stone deposits and add stone to your stockpile.',
        run: ({ state, resources, buildingCount }: BuildingActionContext) => {
          const gain =
            Math.max(1, Math.floor(state.tiles.stone / 4)) *
            Math.max(1, buildingCount);
          resources.addResource('stone', gain);
        },
      },
    ],
  },
  farm: {
    id: 'farm',
    shortName: 'Frm',
    name: 'Farm',
    description:
      'A farming commune on fertile plains. Set a work mode: Sow Crops to automatically cultivate adjacent Fields (1 field every 3 turns), or Harvest to gather Wheat from ready Fields each turn.',
    buildCost: {
      gold: 20,
      wood: 20,
    },
    costGrowth: 1.2,
    unique: false,
    buildingTime: 2,
    populationRequired: 2,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['plains'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Plains area.',
    requiredTechnologies: ['eco-agriculture'],
    getStats: (_state: unknown, _count: number) => [],
    actions: [],
  },
  barracks: {
    id: 'barracks',
    shortName: 'Brk',
    name: 'Barracks',
    description:
      'Military training facility where recruits are drilled into soldiers.',
    buildCost: {
      gold: 60,
      wood: 20,
      stone: 20,
    },
    costGrowth: 1.25,
    unique: false,
    buildingTime: 3,
    populationRequired: 3,
    placementRule: {
      width: 3,
      height: 2,
      allowedTiles: ['plains', 'sand'] as MapTileType[],
    },
    placementDescription: 'Requires 3x2 free Plains/Sand area.',
    requiredTechnologies: ['mil-drill-doctrine'],
    getStats: (_state: unknown, count: number) => [
      `Built: ${count}`,
      'Trains one unit batch at a time per Barracks',
      'Occupies 3x2 tiles',
    ],
    actions: [
      {
        id: 'train-footmen',
        name: 'Train Footmen',
        description:
          'Begin drilling a batch of Footmen. Requires at least 1 free Population.',
        run: () => {},
      },
      {
        id: 'train-archers',
        name: 'Train Archers',
        description:
          'Begin drilling a batch of Archers. Requires Fletching and at least 1 free Population.',
        run: () => {},
      },
    ],
  },
  'hunters-hut': {
    id: 'hunters-hut',
    shortName: 'Hnt',
    name: "Hunter's Hut",
    description: 'A small hunting lodge that sends hunters into nearby woods.',
    buildCost: {
      gold: 30,
      wood: 18,
    },
    costGrowth: 1.2,
    unique: false,
    buildingTime: 2,
    populationRequired: 1,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['forest'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Forest area.',
    requiredTechnologies: [],
    getStats: (_state: unknown, count: number) => [
      `Built: ${count}`,
      "Passive income: +1 to +2 Meat/turn per Hunter's Hut",
      'Occupies 2x2 forest tiles',
    ],
    actions: [],
  },
  bakery: {
    id: 'bakery',
    shortName: 'Bkr',
    name: 'Bakery',
    description:
      'Converts Wheat into Bread each turn. Consumes 2 Wheat and produces 3 Bread passively.',
    buildCost: {
      gold: 30,
      wood: 16,
    },
    costGrowth: 1.2,
    unique: false,
    buildingTime: 2,
    populationRequired: 1,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['plains', 'sand'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Plains/Sand area.',
    requiredTechnologies: ['eco-agriculture'],
    getStats: (_state: unknown, count: number) => [
      `Built: ${count}`,
      'Converts 2 Wheat → 3 Bread per turn',
      'Occupies 2x2 tiles',
    ],
    actions: [],
  },
} as const satisfies Record<string, StateBuildingDefinition>;
