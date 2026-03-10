/**
 * Gameplay screen layout constants.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Game Menu    │     Resources              │   Date, turn    │ ← Topbar
 * ├───────────────┼──────────────────────────────────────────────┤
 * │ State view    │                                              │
 * │ Ruler view    │              Map View                        │
 * │ Research view │                                              │
 * │ Military view │                                              │
 * │               │                                              │
 * │ Log messages  │   Entity selection (centered on map)         │
 * │ [Build]       │                              [End Turn]      │
 * └───────────────┴──────────────────────────────────────────────┘
 */
export const LAYOUT = {
  /** Fixed sidebar width on the left side. */
  SIDEBAR_WIDTH: 220,
  /** Fixed topbar height at the top. */
  TOPBAR_HEIGHT: 50,
  /** Padding inside the sidebar. */
  SIDEBAR_PADDING: 12,
  /** Vertical gap between sidebar panels. */
  PANEL_GAP: 8,
  /** General margin from edges. */
  MARGIN: 12,
} as const;
