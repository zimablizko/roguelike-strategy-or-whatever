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
  SIDEBAR_WIDTH: 280,
  /** Fixed topbar height at the top. */
  TOPBAR_HEIGHT: 50,
  /** Padding inside the sidebar. */
  SIDEBAR_PADDING: 12,
  /** Vertical gap between sidebar panels. */
  PANEL_GAP: 8,
  /** General margin from edges. */
  MARGIN: 12,
} as const;

/**
 * Centralized sidebar stacking data.
 * Keep all sidebar placement numbers here so collisions are obvious.
 */
export const SIDEBAR_LAYOUT = {
  panelX: LAYOUT.SIDEBAR_PADDING,
  panelWidth: LAYOUT.SIDEBAR_WIDTH - LAYOUT.SIDEBAR_PADDING * 2,
  topY: LAYOUT.TOPBAR_HEIGHT + LAYOUT.SIDEBAR_PADDING,
  gap: LAYOUT.PANEL_GAP,
  /**
   * Panel heights are fixed by each view's internal drawing metrics:
   * - State = 87 (section header + 3 content lines)
   * - Ruler / Research / Military = 71 (section header + 2 content lines)
   */
  stateHeight: 87,
  rulerHeight: 71,
  researchHeight: 71,
  militaryHeight: 71,
  logMinHeight: 150,
} as const;

export const SIDEBAR_STACK = {
  stateY: SIDEBAR_LAYOUT.topY,
  rulerY: SIDEBAR_LAYOUT.topY + SIDEBAR_LAYOUT.stateHeight + SIDEBAR_LAYOUT.gap,
  researchY:
    SIDEBAR_LAYOUT.topY +
    SIDEBAR_LAYOUT.stateHeight +
    SIDEBAR_LAYOUT.gap +
    SIDEBAR_LAYOUT.rulerHeight +
    SIDEBAR_LAYOUT.gap,
  militaryY:
    SIDEBAR_LAYOUT.topY +
    SIDEBAR_LAYOUT.stateHeight +
    SIDEBAR_LAYOUT.gap +
    SIDEBAR_LAYOUT.rulerHeight +
    SIDEBAR_LAYOUT.gap +
    SIDEBAR_LAYOUT.researchHeight +
    SIDEBAR_LAYOUT.gap,
  logY:
    SIDEBAR_LAYOUT.topY +
    SIDEBAR_LAYOUT.stateHeight +
    SIDEBAR_LAYOUT.gap +
    SIDEBAR_LAYOUT.rulerHeight +
    SIDEBAR_LAYOUT.gap +
    SIDEBAR_LAYOUT.researchHeight +
    SIDEBAR_LAYOUT.gap +
    SIDEBAR_LAYOUT.militaryHeight +
    SIDEBAR_LAYOUT.gap,
  getLogHeight(drawHeight: number): number {
    return Math.max(
      SIDEBAR_LAYOUT.logMinHeight,
      drawHeight - SIDEBAR_STACK.logY - LAYOUT.SIDEBAR_PADDING
    );
  },
} as const;
