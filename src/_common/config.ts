import type { ResourceCost } from '../managers/ResourceManager';

export const CONFIG = {
  // Game settings
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  MAP_SHOW_GRID: false,
  DEBUG: import.meta.env.DEV,
  DEBUG_OPTIONS: {
    START_SCENE: 'gameplay',
  },
  /** Resources deducted at the end of each turn. */
  UPKEEP_COST: {
    food: 10,
    gold: 5,
  } satisfies ResourceCost,
} as const;

export type Config = typeof CONFIG;
