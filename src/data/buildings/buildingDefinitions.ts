import type {
  BuildingActionContext,
  StateBuildingDefinition,
} from '../../_common/models/buildings.models';
import type { MapTileType } from '../../_common/models/map.models';
import {
  getTurnsUntilNextMarketCaravan,
  isMarketCaravanActive,
} from '../marketCommerce';

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
      'Tax Collection: +1 Gold/turn per House',
    ],
    actions: [],
  },
  lumbermill: {
    id: 'lumbermill',
    shortName: 'Lmb',
    name: 'Lumbermill',
    description:
      'Processes nearby forests into construction-grade lumber. Set work mode to Harvest Timber or Plant Trees.',
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
    actions: [],
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
      width: 2,
      height: 2,
      allowedTiles: ['plains', 'sand'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Plains/Sand area.',
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
  market: {
    id: 'market',
    shortName: 'Mkt',
    name: 'Market',
    description:
      'A chartered trade square that attracts merchants, coin, and guild influence. When Trade Caravans is researched, visiting caravans open a temporary trade action here.',
    buildCost: {
      gold: 60,
      wood: 20,
      stone: 10,
    },
    costGrowth: 1.2,
    unique: true,
    buildingTime: 3,
    populationRequired: 2,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['plains', 'sand'] as MapTileType[],
    },
    placementDescription: 'Requires 2x2 free Plains/Sand area.',
    requiredTechnologies: ['eco-market-charters'],
    getStats: (_state: unknown, count: number) => [
      `Built: ${count}/1`,
      'Passive income: +3 Gold/turn',
      'Guild Influence: +1 Political Power/turn',
    ],
    actions: [
      {
        id: 'trade',
        name: 'Trade',
        description:
          'Open the market exchange while a caravan is in town. Available once per day during active caravan visits.',
        requiredTechnologies: ['eco-trade-caravans'],
        popupId: 'market-trade',
        canRun: (context: BuildingActionContext) => {
          if (isMarketCaravanActive(context.currentTurn)) {
            return { activatable: true };
          }

          const turnsUntilNext = getTurnsUntilNextMarketCaravan(
            context.currentTurn
          );
          return {
            activatable: false,
            reason: `No caravan in town. Next caravan arrives in ${turnsUntilNext} turn${turnsUntilNext === 1 ? '' : 's'}.`,
          };
        },
        run: () => {},
      },
    ],
  },
  fishery: {
    id: 'fishery',
    shortName: 'Fsh',
    name: "Fisherman's Hut",
    description:
      'A small riverside hut where fishermen ply their trade, providing fresh fish to the settlement.',
    buildCost: {
      gold: 25,
      wood: 15,
    },
    costGrowth: 1.2,
    unique: false,
    buildingTime: 2,
    populationRequired: 1,
    placementRule: {
      width: 2,
      height: 2,
      allowedTiles: ['plains', 'sand'] as MapTileType[],
      adjacentToTiles: ['river', 'ocean'] as MapTileType[],
    },
    placementDescription:
      'Requires 2x2 Plains/Sand area adjacent to River or Ocean.',
    requiredTechnologies: ['eco-fishing'],
    getStats: (state: { tiles: { river: number } }, count: number) => [
      `Built: ${count}`,
      `River tiles in territory: ${state.tiles.river}`,
      'Passive income: +1–2 Fish/turn (Line), +2–3 Fish/turn (Net, costs Wood)',
    ],
    actions: [],
  },
} as const satisfies Record<string, StateBuildingDefinition>;
