import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  Rectangle,
  ScreenElement,
  Text,
  vec,
  type GraphicsGrouping,
} from 'excalibur';
import type { GameLogEntry } from '../../_common/models/log.models';
import { FONT_FAMILY } from '../../_common/text';
import { GameLogManager } from '../../managers/GameLogManager';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenList } from '../elements/ScreenList';
import { renderGameLogListItem } from '../logs/GameLogListRenderer';

interface LogViewOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  logManager: GameLogManager;
  onOpenHistory: () => void;
}

export class LogView extends ScreenElement {
  private readonly panelWidth: number;
  private readonly panelHeight: number;
  private readonly logManager: GameLogManager;
  private readonly onOpenHistory: () => void;
  private list?: ScreenList<GameLogEntry>;
  private lastLogVersion = -1;

  constructor(options: LogViewOptions) {
    super({ x: options.x, y: options.y });
    this.anchor = vec(0, 0);
    this.panelWidth = options.width;
    this.panelHeight = options.height;
    this.logManager = options.logManager;
    this.onOpenHistory = options.onOpenHistory;
  }

  onInitialize(): void {
    this.graphics.use(
      new GraphicsGroup({
        members: this.buildBackgroundMembers(),
      })
    );

    const header = new ScreenElement({ x: 10, y: 8 });
    header.graphics.use(
      new Text({
        text: 'Logs',
        font: new Font({
          size: 15,
          unit: FontUnit.Px,
          color: Color.fromHex('#f0f4f8'),
          family: FONT_FAMILY,
        }),
      })
    );
    this.addChild(header);

    const historyButton = new ScreenButton({
      x: this.panelWidth - 82,
      y: 5,
      width: 72,
      height: 24,
      title: 'History',
      onClick: this.onOpenHistory,
    });
    this.addChild(historyButton);

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
    this.syncEntries(true);
  }

  onPreUpdate(): void {
    this.syncEntries(false);
  }

  private syncEntries(force: boolean): void {
    const version = this.logManager.getVersion();
    if (!force && version === this.lastLogVersion) {
      return;
    }

    this.lastLogVersion = version;
    this.list?.setItems(this.logManager.getEntries());
    this.list?.scrollToTop();
  }

  private buildBackgroundMembers(): GraphicsGrouping[] {
    return [
      {
        graphic: new Rectangle({
          width: this.panelWidth,
          height: this.panelHeight,
          color: Color.fromHex('#162635'),
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: this.panelWidth,
          height: 1,
          color: Color.fromHex('#2a4158'),
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: this.panelWidth,
          height: 1,
          color: Color.fromHex('#2a4158'),
        }),
        offset: vec(0, this.panelHeight - 1),
      },
      {
        graphic: new Rectangle({
          width: 1,
          height: this.panelHeight,
          color: Color.fromHex('#2a4158'),
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: 1,
          height: this.panelHeight,
          color: Color.fromHex('#2a4158'),
        }),
        offset: vec(this.panelWidth - 1, 0),
      },
      {
        graphic: new Rectangle({
          width: this.panelWidth,
          height: 1,
          color: Color.fromHex('#2a4158'),
        }),
        offset: vec(0, 33),
      },
    ];
  }
}
