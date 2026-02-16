import { Color } from 'excalibur';

export const TOOLTIP_LAYOUT = {
  defaultWidth: 300,
  minWidth: 140,
  padding: 10,
  lineGap: 3,
  headerGap: 6,
  fontSize: 13,
  headerFontSize: 15,
  outcomeGap: 6,
  outcomeRowHeight: 18,
  outcomeInlineItemGap: 10,
  outcomeRowGap: 2,
  outcomeIconSize: 14,
  tooltipGap: 10,
  viewportPadding: 8,
} as const;

export const TOOLTIP_COLORS = {
  background: Color.fromHex('#12202d'),
  text: Color.fromHex('#ecf3fa'),
  headerText: Color.fromHex('#f7fbff'),
  separator: Color.fromRGB(190, 210, 228, 0.38),
} as const;

export const TOOLTIP_PLACEMENT_ORDER = [
  'right',
  'bottom',
  'left',
  'top',
] as const;
