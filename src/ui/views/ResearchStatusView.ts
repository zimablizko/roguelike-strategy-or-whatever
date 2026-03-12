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
import type { ResearchStatusViewOptions } from '../../_common/models/ui.models';
import { FONT_FAMILY } from '../../_common/text';
import { researchTreeInfo } from '../../data/researches';
import { ResearchManager } from '../../managers/ResearchManager';
import { TurnManager } from '../../managers/TurnManager';
import { InteractivePanelElement } from '../elements/InteractivePanelElement';

export class ResearchStatusView extends InteractivePanelElement {
  private readonly researchManager: ResearchManager;
  private readonly turnManager: TurnManager;
  private readonly fallbackWidth: number;
  private readonly widthProvider?: () => number;
  private readonly yProvider?: () => number;

  private lastResearchVersion = -1;
  private lastTurnVersion = -1;
  private lastPanelWidth = -1;
  private lastHovered = false;
  private lastPressed = false;

  constructor(options: ResearchStatusViewOptions) {
    super(options);
    this.researchManager = options.researchManager;
    this.turnManager = options.turnManager;
    this.fallbackWidth = options.width ?? 420;
    this.widthProvider = options.widthProvider;
    this.yProvider = options.yProvider;
  }

  protected redraw(force: boolean): void {
    // Always update position so Y tracks provider (panel above may resize)
    this.pos = vec(this.anchorX, this.yProvider?.() ?? this.anchorY);

    const researchVersion = this.researchManager.getResearchVersion();
    const turnVersion = this.turnManager.getTurnVersion();
    const panelWidth = this.widthProvider
      ? Math.floor(this.widthProvider())
      : Math.max(220, this.fallbackWidth);
    if (
      !force &&
      researchVersion === this.lastResearchVersion &&
      turnVersion === this.lastTurnVersion &&
      panelWidth === this.lastPanelWidth &&
      this.lastHovered === this.isHovered &&
      this.lastPressed === this.isPressed
    ) {
      return;
    }
    this.lastResearchVersion = researchVersion;
    this.lastTurnVersion = turnVersion;
    this.lastPanelWidth = panelWidth;
    this.lastHovered = this.isHovered;
    this.lastPressed = this.isPressed;

    const active = this.researchManager.getActiveResearch();
    const latest = this.researchManager.getLatestCompletion();
    const completed = this.researchManager.getCompletedCount();
    const total = this.researchManager.getTotalCount();

    let headerText: string;
    let headerColor: Color;
    let subText: string;
    let subColor: Color;

    if (active) {
      const tree = researchTreeInfo[active.tree];
      headerText = active.name;
      headerColor = Color.fromHex(tree.colorHex);
      subText = `${active.remainingTurns} turns left`;
      subColor = Color.fromHex('#a7bacb');
    } else if (completed === total) {
      headerText = 'All research complete';
      headerColor = Color.fromHex('#4caf73');
      subText = `All projects finished (${completed}/${total})`;
      subColor = Color.fromHex('#a7bacb');
    } else {
      headerText = this.researchManager.hasAnyStartableResearch()
        ? 'Idle'
        : 'Locked';
      headerColor = Color.fromHex('#e7edf3');
      subText = latest ? `Last: ${latest.name}` : ' ';
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
    const accentColor = Color.fromHex('#4caf73');
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
        text: '📚 RESEARCH',
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

    // Header (status/name)
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
