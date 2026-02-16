import { Color, Keys } from 'excalibur';
import type { StateBuildingId } from '../../_common/models/buildings.models';
import type { BuildingHotkeyConfig } from '../../_common/models/ui.models';

export const QUICK_BUILD_LAYOUT = {
  leftMargin: 20,
  bottomMargin: 160,
  panelWidth: 260,
  toggleWidth: 100,
  toggleHeight: 40,
  panelPadding: 8,
  panelGap: 6,
  rowHeight: 30,
  rowGap: 4,
  headerHeight: 20,
} as const;

export const QUICK_BUILD_HOTKEYS: Partial<
  Record<StateBuildingId, BuildingHotkeyConfig>
> = {
  castle: { key: Keys.C, label: 'C' },
  house: { key: Keys.H, label: 'H' },
  lumbermill: { key: Keys.L, label: 'L' },
  mine: { key: Keys.M, label: 'M' },
  farm: { key: Keys.F, label: 'F' },
};

export const QUICK_BUILD_COLORS = {
  panelBackground: Color.fromRGB(14, 24, 35, 0.9),
  panelBorder: Color.fromRGB(170, 196, 220, 0.55),
  headerText: Color.fromHex('#d9e4ef'),
  costOk: Color.fromHex('#9fe6aa'),
  costBad: Color.fromHex('#f2b0a6'),
  neutral: Color.fromHex('#d9e4ef'),
} as const;
