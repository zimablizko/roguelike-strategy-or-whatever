import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  Rectangle,
  Text,
  vec,
  type GraphicsGrouping,
} from 'excalibur';
import type { GameLogEntry } from '../../_common/models/log.models';
import { FONT_FAMILY } from '../../_common/text';
import { GameLogManager } from '../../managers/GameLogManager';
import { InteractivePanelElement } from '../elements/InteractivePanelElement';
import { ScreenList } from '../elements/ScreenList';
import { renderGameLogListItem } from '../logs/GameLogListRenderer';

interface LogViewOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  logManager: GameLogManager;
  onClick: () => void;
}

export class LogView extends InteractivePanelElement {
  private readonly panelWidth: number;
  private readonly panelHeight: number;
  private readonly logManager: GameLogManager;
  private list?: ScreenList<GameLogEntry>;
  private lastLogVersion = -1;
  private lastHovered = false;
  private lastPressed = false;

  constructor(options: LogViewOptions) {
    super({ x: options.x, y: options.y, onClick: options.onClick });
    this.panelWidth = options.width;
    this.panelHeight = options.height;
    this.logManager = options.logManager;
  }

  onInitialize(): void {
    this.list = new ScreenList<GameLogEntry>({
      x: 0,
      y: 34,
      width: this.panelWidth,
      height: this.panelHeight - 34,
      items: [],
      itemHeight: 54,
      gap: 0,
      padding: 0,
      transparent: true,
      scrollStep: 36,
      renderItem: renderGameLogListItem,
      showScrollbar: true,
    });
    this.addChild(this.list);

    super.onInitialize();
  }

  protected redraw(force: boolean): void {
    const version = this.logManager.getVersion();
    if (
      !force &&
      version === this.lastLogVersion &&
      this.lastHovered === this.isHovered &&
      this.lastPressed === this.isPressed
    ) {
      return;
    }
    this.lastLogVersion = version;
    this.lastHovered = this.isHovered;
    this.lastPressed = this.isPressed;

    this.list?.setItems(this.logManager.getEntries());
    this.list?.scrollToTop();

    const borderW = 1;
    const accentW = 3;
    const labelPadX = 8;
    const labelPadY = 5;
    const labelSize = 11;
    const sectionH = labelPadY * 2 + labelSize;
    const sepH = 1;

    const pressOffset = this.getPressOffset();

    const borderColor = Color.fromHex('#2a4158');
    const accentColor = Color.fromHex('#4a7fb8');
    const secondaryColor = Color.fromHex('#a7bacb');

    const members: GraphicsGrouping[] = [];

    // Border
    members.push({
      graphic: new Rectangle({
        width: this.panelWidth,
        height: this.panelHeight,
        color: borderColor,
      }),
      offset: vec(pressOffset, pressOffset),
    });

    // Panel background
    members.push({
      graphic: new Rectangle({
        width: this.panelWidth - borderW * 2,
        height: this.panelHeight - borderW * 2,
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
        text: '📜 LOGS [H]',
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

    // Separator line
    members.push({
      graphic: new Rectangle({
        width: this.panelWidth - borderW * 2,
        height: sepH,
        color: borderColor,
      }),
      offset: vec(borderW + pressOffset, borderW + sectionH + pressOffset),
    });

    // Hover border
    this.addHoverBorder(members, this.panelWidth, this.panelHeight);

    this.graphics.use(new GraphicsGroup({ members }));
  }
}
