import type { ResourceCost } from './models/resource.models';

export const CONFIG = {
  // Game settings
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  MAP_SHOW_GRID: false,
  MAP_INITIAL_STATE_COVERAGE: 0.8,
  DEBUG: import.meta.env.DEV,
  DEBUG_OPTIONS: {
    START_SCENE: 'gameplay',
    QUICK_RESEARCH: true,
  },
  /** Resources deducted at the end of each turn. */
  UPKEEP_COST: {
    food: 10,
  } satisfies ResourceCost,
} as const;
export type Config = typeof CONFIG;
