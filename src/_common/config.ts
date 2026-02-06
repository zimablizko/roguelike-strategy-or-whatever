export const CONFIG = {
  // Game settings
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  DEBUG: true,
  DEBUG_OPTIONS: {
    START_SCENE: 'gameplay',
  },
} as const;

export type Config = typeof CONFIG;
