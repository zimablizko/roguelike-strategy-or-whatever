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
import { FONT_FAMILY } from '../../_common/text';
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
  private readonly yProvider?: () => number;

  private lastMilitaryVersion = -1;
  private lastBuildingsVersion = -1;
  private lastPanelWidth = -1;
  private lastHovered = false;
  private lastPressed = false;

  constructor(options: MilitaryStatusViewOptions) {
    super(options);
    this.militaryManager = options.militaryManager;
    this.buildingManager = options.buildingManager;
    this.fallbackWidth = options.width ?? 360;
    this.widthProvider = options.widthProvider;
    this.yProvider = options.yProvider;
  }

  protected redraw(force: boolean): void {
    // Always update position so Y tracks provider (panel above may resize)
    this.pos = vec(this.anchorX, this.yProvider?.() ?? this.anchorY);

    const milVer = this.militaryManager.getMilitaryVersion();
    const buildingsVer = this.buildingManager.getBuildingsVersion();
    const panelWidth = this.widthProvider
      ? Math.floor(this.widthProvider())
      : Math.max(220, this.fallbackWidth);
    if (
      !force &&
      milVer === this.lastMilitaryVersion &&
      buildingsVer === this.lastBuildingsVersion &&
      panelWidth === this.lastPanelWidth &&
      this.lastHovered === this.isHovered &&
      this.lastPressed === this.isPressed
    ) {
      return;
    }
    this.lastMilitaryVersion = milVer;
    this.lastBuildingsVersion = buildingsVer;
    this.lastPanelWidth = panelWidth;
    this.lastHovered = this.isHovered;
    this.lastPressed = this.isPressed;

    const snapshot = this.militaryManager.getSnapshot();
    const totalUnits = Object.values(snapshot.composition).reduce(
      (sum, count) => sum + (count ?? 0),
      0
    );
    const activeMusters = this.buildingManager.getBuildingActionProgresses().length;

    let headerText: string;
    let headerColor: Color;
    let subText: string;
    let subColor: Color;

    if (totalUnits === 0 && activeMusters === 0) {
      headerText = 'No army';
      headerColor = Color.fromHex('#a7bacb');
      subText = '';
      subColor = Color.fromHex('#a7bacb');
    } else {
      headerText = `Power: ${snapshot.totalPower}`;
      headerColor = Color.fromHex('#c94a4a');
      const parts: string[] = [];
      if (snapshot.availableCount > 0)
        parts.push(`${snapshot.availableCount} ready`);
      if (activeMusters > 0) parts.push(`${activeMusters} mustering`);
      subText = parts.length > 0 ? parts.join('  |  ') : 'No units';
      subColor = Color.fromHex('#a7bacb');
    }

    const panelW = panelWidth;
    const borderW = 1;
    const accentW = 3;
    const labelPadX = 8;
    const labelPadY = 5;
    const labelSize = 11;
    const sectionH = labelPadY * 2 + labelSize;
    const sepH = 1;
    const contentPadX = 10;
    const contentPadY = 8;
    const headerSize = 15;
    const lineGap = 4;
    const subSize = 12;
    const contentH = contentPadY + headerSize + lineGap + subSize + contentPadY;
    const panelH = borderW + sectionH + sepH + contentH + borderW;

    const pressOffset = this.getPressOffset();

    const borderColor = Color.fromHex('#2a4158');
    const accentColor = Color.fromHex('#c94a4a');
    const secondaryColor = Color.fromHex('#a7bacb');

    const members: GraphicsGrouping[] = [];

    // Idle border
    members.push({
      graphic: new Rectangle({
        width: panelW,
        height: panelH,
        color: borderColor,
      }),
      offset: vec(pressOffset, pressOffset),
    });

    // Panel background
    members.push({
      graphic: new Rectangle({
        width: panelW - borderW * 2,
        height: panelH - borderW * 2,
        color: this.getPanelBackgroundColor(),
      }),
      offset: vec(borderW + pressOffset, borderW + pressOffset),
    });

    // Left accent bar
    members.push({
      graphic: new Rectangle({
        width: accentW,
        height: sectionH,
        color: accentColor,
      }),
      offset: vec(borderW + pressOffset, borderW + pressOffset),
    });

    // Section label
    members.push({
      graphic: new Text({
        text: '⚔ MILITARY',
        font: new Font({
          size: labelSize,
          unit: FontUnit.Px,
          color: secondaryColor,
          family: FONT_FAMILY,
        }),
      }),
      offset: vec(
        borderW + accentW + labelPadX + pressOffset,
        borderW + labelPadY + pressOffset
      ),
    });

    // Separator
    members.push({
      graphic: new Rectangle({
        width: panelW - borderW * 2,
        height: sepH,
        color: borderColor,
      }),
      offset: vec(borderW + pressOffset, borderW + sectionH + pressOffset),
    });

    const contentY = borderW + sectionH + sepH + pressOffset;

    // Header
    members.push({
      graphic: new Text({
        text: headerText,
        font: new Font({
          size: headerSize,
          unit: FontUnit.Px,
          color: headerColor,
          family: FONT_FAMILY,
        }),
      }),
      offset: vec(contentPadX + pressOffset, contentY + contentPadY),
    });

    // Sub-line
    members.push({
      graphic: new Text({
        text: subText,
        font: new Font({
          size: subSize,
          unit: FontUnit.Px,
          color: subColor,
          family: FONT_FAMILY,
        }),
      }),
      offset: vec(
        contentPadX + pressOffset,
        contentY + contentPadY + headerSize + lineGap
      ),
    });

    this.addHoverBorder(members, panelW, panelH);

    this.graphics.use(new GraphicsGroup({ members }));
  }
}
