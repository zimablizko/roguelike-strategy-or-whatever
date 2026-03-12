export const MAP_VIEW_DEFAULTS = {
  tileSize: 56,
  panSpeed: 620,
  minZoom: 0.45,
  maxZoom: 0.9,
  zoomStep: 0.12,
  initialPlayerStateCoverage: 2 / 3,
  minPlayerStateCoverage: 0.2,
  maxPlayerStateCoverage: 0.95,
  mapBorderCells: 3,
  playerStatePaddingTiles: 1,
} as const;
