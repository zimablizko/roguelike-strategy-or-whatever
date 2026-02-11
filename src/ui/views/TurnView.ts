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
import { TurnManager } from '../../managers/TurnManager';

export interface TurnDisplayOptions {
  x: number;
  y: number;
  turnManager: TurnManager;
  textColor?: Color;
  panelBgColor?: Color;
  panelBorderColor?: Color;
  separatorColor?: Color;
  segmentColor?: Color;
  spentSegmentColor?: Color;
  barWidth?: number;
}

/**
 * UI component that displays current turn and action points.
 */
export class TurnDisplay extends ScreenElement {
  private turnManager: TurnManager;
  private anchorX: number;
  private anchorY: number;
  private textColor: Color;
  private panelBgColor: Color;
  private panelBorderColor: Color;
  private separatorColor: Color;
  private segmentColor: Color;
  private spentSegmentColor: Color;
  private barWidth: number;

  private lastRendered:
    | { turnNumber: number; apCurrent: number; apMax: number }
    | undefined;

  constructor(options: TurnDisplayOptions) {
    super({ x: options.x, y: options.y });
    this.turnManager = options.turnManager;
    this.anchorX = options.x;
    this.anchorY = options.y;
    this.textColor = options.textColor ?? Color.White;
    this.panelBgColor = options.panelBgColor ?? Color.fromRGB(12, 20, 28, 0.72);
    this.panelBorderColor =
      options.panelBorderColor ?? Color.fromRGB(170, 196, 220, 0.55);
    this.separatorColor = options.separatorColor ?? Color.fromHex('#233241');
    this.segmentColor = options.segmentColor ?? Color.Green;
    this.spentSegmentColor =
      options.spentSegmentColor ?? Color.fromHex('#1a252f');
    this.barWidth = options.barWidth ?? 280;
  }

  onInitialize(): void {
    this.updateDisplay(true);
  }

  onPreUpdate(): void {
    this.updateDisplay(false);
  }

  private updateDisplay(force: boolean): void {
    const turnData = this.turnManager.getTurnDataRef();
    const next = {
      turnNumber: turnData.turnNumber,
      apCurrent: turnData.actionPoints.current,
      apMax: turnData.actionPoints.max,
    };

    if (
      !force &&
      this.lastRendered &&
      this.lastRendered.turnNumber === next.turnNumber &&
      this.lastRendered.apCurrent === next.apCurrent &&
      this.lastRendered.apMax === next.apMax
    ) {
      return;
    }
    this.lastRendered = next;

    const turnText = new Text({
      text: `Turn: ${turnData.turnNumber}`,
      font: new Font({
        size: 18,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    const apText = new Text({
      text: `ActionPoints: ${turnData.actionPoints.current} / ${turnData.actionPoints.max}`,
      font: new Font({
        size: 14,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    const textGap = 4;
    const barGap = 8;
    const barHeight = 14;
    const panelPaddingX = 14;
    const panelPaddingY = 10;
    const borderWidth = 1;

    const contentWidth = Math.max(this.barWidth, turnText.width, apText.width);
    const panelWidth = contentWidth + panelPaddingX * 2;
    const barX = (contentWidth - this.barWidth) / 2;
    const panelHeight =
      panelPaddingY * 2 + turnText.height + textGap + apText.height + barGap + barHeight;

    // Treat x/y as an anchor point (top-center).
    this.pos = vec(this.anchorX - panelWidth / 2, this.anchorY);

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
      offset: vec(
        panelPaddingX + (contentWidth - turnText.width) / 2,
        panelPaddingY
      ),
    });

    // Action points text (centered)
    const apY = panelPaddingY + turnText.height + textGap;
    members.push({
      graphic: apText,
      offset: vec(panelPaddingX + (contentWidth - apText.width) / 2, apY),
    });

    // Bar geometry
    const barY = apY + apText.height + barGap;
    const maxSegments = Math.max(1, turnData.actionPoints.max);
    const currentSegments = Math.max(
      0,
      Math.min(turnData.actionPoints.current, maxSegments)
    );

    const separatorW = 1;
    const segmentW =
      (this.barWidth - (maxSegments - 1) * separatorW) / maxSegments;

    // Outline (to keep bar visible even when all segments spent)
    members.push(
      {
        graphic: new Rectangle({
          width: this.barWidth,
          height: 1,
          color: this.separatorColor,
      }),
      offset: vec(panelPaddingX + barX, barY),
    },
      {
        graphic: new Rectangle({
          width: this.barWidth,
          height: 1,
          color: this.separatorColor,
        }),
        offset: vec(panelPaddingX + barX, barY + barHeight - 1),
      },
      {
        graphic: new Rectangle({
          width: 1,
          height: barHeight,
          color: this.separatorColor,
        }),
        offset: vec(panelPaddingX + barX, barY),
      },
      {
        graphic: new Rectangle({
          width: 1,
          height: barHeight,
          color: this.separatorColor,
        }),
        offset: vec(panelPaddingX + barX + this.barWidth - 1, barY),
      }
    );

    // Segments: unspent are green; spent use a dark background
    for (let i = 0; i < maxSegments; i++) {
      const x = barX + i * (segmentW + separatorW);
      const color =
        i < currentSegments ? this.segmentColor : this.spentSegmentColor;
      members.push({
        graphic: new Rectangle({
          width: segmentW,
          height: barHeight,
          color,
        }),
        offset: vec(panelPaddingX + x, barY),
      });
    }

    // Segment separators
    for (let i = 1; i < maxSegments; i++) {
      const x = barX + i * segmentW + (i - 1) * separatorW;
      members.push({
        graphic: new Rectangle({
          width: separatorW,
          height: barHeight,
          color: this.separatorColor,
        }),
        offset: vec(panelPaddingX + x, barY),
      });
    }

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );
  }
}
