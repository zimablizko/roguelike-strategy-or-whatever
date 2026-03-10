import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  Rectangle,
  ScreenElement,
  Text,
  vec,
} from 'excalibur';
import type { TurnDisplayOptions } from '../../_common/models/ui.models';
import { TurnManager } from '../../managers/TurnManager';

/**
 * UI component that displays the current date/turn label.
 * Focus indicator is now a separate FocusDisplay.
 */
export class TurnDisplay extends ScreenElement {
  private turnManager: TurnManager;
  private anchorX: number;
  private anchorY: number;
  private textColor: Color;
  private panelBgColor: Color;
  private panelBorderColor: Color;

  private lastRendered: { turnNumber: number } | undefined;

  constructor(options: TurnDisplayOptions) {
    super({ x: options.x, y: options.y });
    this.turnManager = options.turnManager;
    this.anchorX = options.x;
    this.anchorY = options.y;
    this.textColor = options.textColor ?? Color.White;
    this.panelBgColor = options.panelBgColor ?? Color.fromRGB(12, 20, 28, 0.72);
    this.panelBorderColor =
      options.panelBorderColor ?? Color.fromRGB(170, 196, 220, 0.55);
  }

  onInitialize(): void {
    this.updateDisplay(true);
  }

  onPreUpdate(): void {
    this.updateDisplay(false);
  }

  private updateDisplay(force: boolean): void {
    const turnData = this.turnManager.getTurnDataRef();
    const next = { turnNumber: turnData.turnNumber };

    if (
      !force &&
      this.lastRendered &&
      this.lastRendered.turnNumber === next.turnNumber
    ) {
      return;
    }
    this.lastRendered = next;

    const turnText = new Text({
      text: this.turnManager.getDateLabel(),
      font: new Font({
        size: 16,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    const panelPaddingX = 14;
    const panelPaddingY = 8;
    const borderWidth = 1;

    const panelWidth = turnText.width + panelPaddingX * 2;
    const panelHeight = turnText.height + panelPaddingY * 2;

    // Anchor: right-aligned (anchorX is the right edge, anchorY is vertical center)
    this.pos = vec(this.anchorX - panelWidth, this.anchorY - panelHeight / 2);

    const members: GraphicsGrouping[] = [];

    // Panel background + border
    members.push(
      {
        graphic: new Rectangle({
          width: panelWidth,
          height: panelHeight,
          color: this.panelBgColor,
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: panelWidth,
          height: borderWidth,
          color: this.panelBorderColor,
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: panelWidth,
          height: borderWidth,
          color: this.panelBorderColor,
        }),
        offset: vec(0, panelHeight - borderWidth),
      },
      {
        graphic: new Rectangle({
          width: borderWidth,
          height: panelHeight,
          color: this.panelBorderColor,
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: borderWidth,
          height: panelHeight,
          color: this.panelBorderColor,
        }),
        offset: vec(panelWidth - borderWidth, 0),
      }
    );

    // Turn text (centered)
    members.push({
      graphic: turnText,
      offset: vec(panelPaddingX, panelPaddingY),
    });

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );
  }
}
