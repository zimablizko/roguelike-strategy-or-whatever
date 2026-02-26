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
  'hunters-hut': [{ resourceType: 'food', amount: 'random:5:10' }],
};

// ─── Building definitions ────────────────────────────────────────────

export const stateBuildingDefinitions = {
  castle: {
    id: 'castle',
    name: 'Castle',
    shortName: 'Csl',
    description:
      'Capital fortification that anchors settlement growth. Only one Castle can exist.',
    buildCost: {
      gold: 150,
      materials: 120,
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
        id: 'expand-border',
        name: 'Expand',
        description:
          'Expand state borders by 1 cell in all directions if no edge or ocean blocks expansion.',
        charges: 2,
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
      gold: 25,
      materials: 15,
    },
    costGrowth: 1.15,
    unique: false,
    buildingTime: 2,
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
    description: 'Processes nearby forests into construction-grade materials.',
    buildCost: {
      gold: 35,
      materials: 20,
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
          'Fell the nearest Forest tile within range 3 of this Lumbermill, converting it to Plains. Yields 3 Materials per Forest tile in range (with slight diminishing returns).',
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

          // Collect unique forest tiles in range, tracking min sq-dist to any lumbermill.
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

          // Sort by distance to find the nearest forest tile.
          const sorted = Array.from(forestInRange.values()).sort(
            (a, b) => a.distSq - b.distSq
          );
          const nearest = sorted[0];

          // Convert nearest forest to plains.
          mapSetTile(nearest.x, nearest.y, 'plains');

          // Yield: 3 Materials per in-range forest tile, with slight diminishing.
          const N = sorted.length;
          let totalYield = 0;
          for (let i = 0; i < N; i++) {
            totalYield += Math.max(1, Math.round(3 * Math.pow(0.9, i)));
          }
          resources.addResource('materials', totalYield);
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
      'Extracts ore and stone from rocky terrain, improving material throughput.',
    buildCost: {
      gold: 45,
      materials: 30,
    },
    costGrowth: 1.2,
    unique: false,
    buildingTime: 2,
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
      'A farming commune on fertile plains. Each adjacent Field adds +3 Food/turn. With Crop Harvesting: manually harvest ready Fields for instant food.',
    buildCost: {
      gold: 40,
      materials: 24,
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
    actions: [
      {
        id: 'sow-field',
        name: 'Sow Field',
        description:
          "Cultivate a 2x2 Plains area near the Farm into a Field, increasing this Farm's passive food income by +3/turn.",
        requiresTilePlacement: true,
        canRun: ({ buildingInstances, mapGetTile, isInPlayerZone }) => {
          const RANGE = 2;
          for (const inst of buildingInstances) {
            const minTlX = inst.x - RANGE;
            const maxTlX = inst.x + inst.width + RANGE - 2;
            const minTlY = inst.y - RANGE;
            const maxTlY = inst.y + inst.height + RANGE - 2;
            for (let ty = minTlY; ty <= maxTlY; ty++) {
              for (let tx = minTlX; tx <= maxTlX; tx++) {
                if (
                  mapGetTile(tx, ty) === 'plains' &&
                  mapGetTile(tx + 1, ty) === 'plains' &&
                  mapGetTile(tx, ty + 1) === 'plains' &&
                  mapGetTile(tx + 1, ty + 1) === 'plains' &&
                  isInPlayerZone(tx, ty) &&
                  isInPlayerZone(tx + 1, ty) &&
                  isInPlayerZone(tx, ty + 1) &&
                  isInPlayerZone(tx + 1, ty + 1)
                ) {
                  return { activatable: true };
                }
              }
            }
          }
          return {
            activatable: false,
            reason: 'No free 2x2 Plains area in vicinity.',
          };
        },
        run: () => {},
      },
      {
        id: 'gather-harvest',
        name: 'Gather Harvest',
        description:
          'Immediately harvest all ready Fields near this Farm: gain 10 + 10 per ready Field Food. Harvested Fields go fallow for 3 turns before regrowing.',
        canRun: ({ buildingInstances, mapGetTile, isTechnologyUnlocked }) => {
          if (!isTechnologyUnlocked('eco-crop-harvesting')) {
            return {
              activatable: false,
              reason: 'Requires Crop Harvesting technology.',
            };
          }
          const RANGE = 2;
          for (const inst of buildingInstances) {
            const minX = inst.x - RANGE;
            const maxX = inst.x + inst.width - 1 + RANGE;
            const minY = inst.y - RANGE;
            const maxY = inst.y + inst.height - 1 + RANGE;
            for (let ty = minY; ty <= maxY; ty++) {
              for (let tx = minX; tx <= maxX; tx++) {
                if (mapGetTile(tx, ty) === 'field') {
                  return { activatable: true };
                }
              }
            }
          }
          return {
            activatable: false,
            reason: 'No ready Fields nearby.',
          };
        },
        run: ({ buildingInstances, mapGetTile, mapSetTile, resources }) => {
          const RANGE = 2;
          const fieldTiles: Array<{ x: number; y: number }> = [];
          for (const inst of buildingInstances) {
            const minX = inst.x - RANGE;
            const maxX = inst.x + inst.width - 1 + RANGE;
            const minY = inst.y - RANGE;
            const maxY = inst.y + inst.height - 1 + RANGE;
            for (let ty = minY; ty <= maxY; ty++) {
              for (let tx = minX; tx <= maxX; tx++) {
                if (mapGetTile(tx, ty) === 'field') {
                  fieldTiles.push({ x: tx, y: ty });
                }
              }
            }
          }
          // Each 2×2 block of field tiles counts as one field.
          const fieldBlockCount = Math.floor(fieldTiles.length / 4);
          const foodGain = 10 + 10 * fieldBlockCount;
          resources.addResource('food', foodGain);
          // Convert harvested fields to fallow.
          for (const tile of fieldTiles) {
            mapSetTile(tile.x, tile.y, 'field-empty');
          }
        },
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
      materials: 18,
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
      "Passive income: +5 to +10 Food/turn per Hunter's Hut",
      'Occupies 2x2 forest tiles',
    ],
    actions: [],
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
