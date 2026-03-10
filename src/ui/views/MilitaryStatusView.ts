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
    const panelWidth = this.widthProvider
      ? Math.floor(this.widthProvider())
      : Math.max(220, this.fallbackWidth);
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

    let headerText: string;
    let headerColor: Color;
    let subText: string;
    let subColor: Color;

    if (
      totalUnits === 0 &&
      this.buildingManager.getBuildingCount('barracks') === 0
    ) {
      headerText = 'Military: —';
      headerColor = Color.fromHex('#8a96a3');
      subText = 'No barracks built';
      subColor = Color.fromHex('#8a96a3');
    } else {
      headerText = `Military Power: ${snapshot.totalPower}`;
      headerColor = Color.fromHex('#cf5d5d');
      const parts: string[] = [];
      if (snapshot.availableCount > 0)
        parts.push(`${snapshot.availableCount} avail`);
      if (snapshot.assignedCount > 0)
        parts.push(`${snapshot.assignedCount} assigned`);
      if (snapshot.trainingCount > 0)
        parts.push(`${snapshot.trainingCount} training`);
      subText = parts.length > 0 ? parts.join('  |  ') : 'No units';
      subColor = Color.fromHex('#dce6ef');
    }

    const padding = 10;
    const lineGap = 4;
    const headerSize = 15;
    const subSize = 12;
    const panelHeight = padding * 2 + headerSize + lineGap + subSize;
    const pressOffset = this.getPressOffset();

    this.pos = vec(this.anchorX, this.anchorY);

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: panelWidth,
          height: panelHeight,
          color: this.getPanelBackgroundColor(),
        }),
        offset: vec(pressOffset, pressOffset),
      },
      {
        graphic: new Text({
          text: headerText,
          font: new Font({
            size: headerSize,
            unit: FontUnit.Px,
            color: headerColor,
          }),
        }),
        offset: vec(padding + pressOffset, padding + pressOffset),
      },
      {
        graphic: new Text({
          text: subText,
          font: new Font({
            size: subSize,
            unit: FontUnit.Px,
            color: subColor,
          }),
        }),
        offset: vec(
          padding + pressOffset,
          padding + headerSize + lineGap + pressOffset
        ),
      },
    ];

    this.addHoverBorder(members, panelWidth, panelHeight);

    this.graphics.use(new GraphicsGroup({ members }));
  }
}
