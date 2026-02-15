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
import { researchTreeInfo } from '../../data/researches';
import { ResearchManager } from '../../managers/ResearchManager';
import { TurnManager } from '../../managers/TurnManager';
import {
  InteractivePanelElement,
  type InteractivePanelOptions,
} from '../elements/InteractivePanelElement';

export interface ResearchStatusViewOptions extends InteractivePanelOptions {
  researchManager: ResearchManager;
  turnManager: TurnManager;
  width?: number;
  widthProvider?: () => number;
}

export class ResearchStatusView extends InteractivePanelElement {
  private readonly researchManager: ResearchManager;
  private readonly turnManager: TurnManager;
  private readonly fallbackWidth: number;
  private readonly widthProvider?: () => number;

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
  }

  protected redraw(force: boolean): void {
    const researchVersion = this.researchManager.getResearchVersion();
    const turnVersion = this.turnManager.getTurnVersion();
    const panelWidth = Math.max(
      220,
      Math.floor(this.widthProvider?.() ?? this.fallbackWidth)
    );
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

    const lines: { text: string; color: Color; size: number }[] = [];
    if (active) {
      const tree = researchTreeInfo[active.tree];
      lines.push({
        text: `Research: ${active.name}`,
        color: Color.fromHex(tree.colorHex),
        size: 15,
      });
      lines.push({
        text: `${active.remainingTurns} turns left`,
        color: Color.fromHex('#dce6ef'),
        size: 12,
      });
    } else if (completed === total) {
      lines.push({
        text: 'Research complete',
        color: Color.fromHex('#9fe6aa'),
        size: 15,
      });
      lines.push({
        text: `All projects finished (${completed}/${total})`,
        color: Color.fromHex('#dce6ef'),
        size: 12,
      });
    } else if (this.researchManager.hasAnyStartableResearch()) {
      lines.push({
        text: 'Research idle',
        color: Color.fromHex('#f5c179'),
        size: 15,
      });
      lines.push({
        text: 'Reminder: open Research and start a project',
        color: Color.fromHex('#dce6ef'),
        size: 12,
      });
    } else {
      lines.push({
        text: 'Research locked',
        color: Color.fromHex('#f5c179'),
        size: 15,
      });
      lines.push({
        text: 'No available project right now',
        color: Color.fromHex('#dce6ef'),
        size: 12,
      });
    }

    if (latest && !active) {
      lines.push({
        text: `Last completed: ${latest.name} (Turn ${latest.completedOnTurn})`,
        color: Color.fromHex('#9fe6aa'),
        size: 11,
      });
    }

    const paddingX = 12;
    const paddingY = 8;
    const lineGap = 4;
    const panelHeight =
      paddingY * 2 +
      lines.reduce((sum, line, index) => {
        return sum + line.size + (index < lines.length - 1 ? lineGap : 0);
      }, 0);

    this.pos = vec(this.anchorX, this.anchorY);
    const pressOffset = this.getPressOffset();

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: panelWidth,
          height: panelHeight,
          color: this.getPanelBackgroundColor(),
        }),
        offset: vec(pressOffset, pressOffset),
      },
    ];

    let y = paddingY;
    for (const line of lines) {
      members.push({
        graphic: new Text({
          text: line.text,
          font: new Font({
            size: line.size,
            unit: FontUnit.Px,
            color: line.color,
          }),
        }),
        offset: vec(paddingX + pressOffset, y + pressOffset),
      });
      y += line.size + lineGap;
    }

    this.addHoverBorder(members, panelWidth, panelHeight);

    this.graphics.use(new GraphicsGroup({ members }));
  }
}
