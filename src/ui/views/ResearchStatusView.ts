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
import { researchTreeInfo } from '../../data/researches';
import { ResearchManager } from '../../managers/ResearchManager';
import { TurnManager } from '../../managers/TurnManager';
import { InteractivePanelElement } from '../elements/InteractivePanelElement';

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
      headerText = `Research: ${active.name}`;
      headerColor = Color.fromHex(tree.colorHex);
      subText = `${active.remainingTurns} turns left`;
      subColor = Color.fromHex('#dce6ef');
    } else if (completed === total) {
      headerText = 'Research complete';
      headerColor = Color.fromHex('#9fe6aa');
      subText = `All projects finished (${completed}/${total})`;
      subColor = Color.fromHex('#dce6ef');
    } else {
      headerText = this.researchManager.hasAnyStartableResearch()
        ? 'Research idle'
        : 'Research locked';
      headerColor = Color.fromHex('#f5c179');
      subText = latest
        ? `Last: ${latest.name} (Turn ${latest.completedOnTurn})`
        : ' ';
      subColor = Color.fromHex('#9fe6aa');
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
