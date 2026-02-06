export const CONFIG = {
  // Game settings
  GAME_WIDTH: 800,
  GAME_HEIGHT: 600,
  DEBUG: true,
  DEBUG_OPTIONS: {
    START_SCENE: 'gameplay',
  },
} as const;

export type Config = typeof CONFIG;
