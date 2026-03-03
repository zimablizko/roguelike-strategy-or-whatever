import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  Rectangle,
  Text,
  vec,
} from 'excalibur';
import type { MilitaryStatusViewOptions } from '../../_common/models/ui.models';
import { BuildingManager } from '../../managers/BuildingManager';
import { MilitaryManager } from '../../managers/MilitaryManager';
import { InteractivePanelElement } from '../elements/InteractivePanelElement';

/**
 * Small HUD panel showing aggregated military status.
 * Clicking opens the Military popup.
 */
export class MilitaryStatusView extends InteractivePanelElement {
  private readonly militaryManager: MilitaryManager;
  private readonly buildingManager: BuildingManager;
  private readonly fallbackWidth: number;
  private readonly widthProvider?: () => number;

  private lastMilitaryVersion = -1;
  private lastPanelWidth = -1;
  private lastHovered = false;
  private lastPressed = false;

  constructor(options: MilitaryStatusViewOptions) {
    super(options);
    this.militaryManager = options.militaryManager;
    this.buildingManager = options.buildingManager;
    this.fallbackWidth = options.width ?? 360;
    this.widthProvider = options.widthProvider;
  }

  protected redraw(force: boolean): void {
    const milVer = this.militaryManager.getMilitaryVersion();
    const panelWidth = Math.max(
      220,
      Math.floor(this.widthProvider?.() ?? this.fallbackWidth)
    );
    if (
      !force &&
      milVer === this.lastMilitaryVersion &&
      panelWidth === this.lastPanelWidth &&
      this.lastHovered === this.isHovered &&
      this.lastPressed === this.isPressed
    ) {
      return;
    }
    this.lastMilitaryVersion = milVer;
    this.lastPanelWidth = panelWidth;
    this.lastHovered = this.isHovered;
    this.lastPressed = this.isPressed;

    const snapshot = this.militaryManager.getSnapshot();
    const totalUnits =
      snapshot.availableCount + snapshot.assignedCount + snapshot.trainingCount;

    const lines: { text: string; color: Color; size: number }[] = [];

    if (
      totalUnits === 0 &&
      this.buildingManager.getBuildingCount('barracks') === 0
    ) {
      lines.push({
        text: 'Military: —',
        color: Color.fromHex('#8a96a3'),
        size: 14,
      });
      lines.push({
        text: 'No barracks built',
        color: Color.fromHex('#8a96a3'),
        size: 11,
      });
    } else {
      lines.push({
        text: `Military Power: ${snapshot.totalPower}`,
        color: Color.fromHex('#cf5d5d'),
        size: 15,
      });
      const parts: string[] = [];
      if (snapshot.availableCount > 0)
        parts.push(`${snapshot.availableCount} avail`);
      if (snapshot.assignedCount > 0)
        parts.push(`${snapshot.assignedCount} assigned`);
      if (snapshot.trainingCount > 0)
        parts.push(`${snapshot.trainingCount} training`);
      lines.push({
        text: parts.length > 0 ? parts.join('  |  ') : 'No units',
        color: Color.fromHex('#dce6ef'),
        size: 12,
      });
    }

    // Build composite graphic
    const lineHeight = 4;
    let totalHeight = 0;
    for (const l of lines) {
      totalHeight += l.size + lineHeight;
    }
    totalHeight = Math.max(totalHeight, 20);

    const padX = 10;
    const padY = 6;
    const bgColor = this.getPanelBackgroundColor();

    const members: GraphicsGrouping[] = [];
    members.push({
      graphic: new Rectangle({
        width: panelWidth,
        height: totalHeight + padY * 2,
        color: bgColor,
      }),
      offset: vec(0, 0),
    });

    let yOff = padY;
    for (const l of lines) {
      members.push({
        graphic: new Text({
          text: l.text,
          font: new Font({
            size: l.size,
            unit: FontUnit.Px,
            color: l.color,
          }),
        }),
        offset: vec(padX, yOff),
      });
      yOff += l.size + lineHeight;
    }

    this.graphics.use(new GraphicsGroup({ members }));
  }
}
