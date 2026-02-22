import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  Rectangle,
  ScreenElement,
  Sprite,
  Text,
  vec,
} from 'excalibur';
import type { TurnDisplayOptions } from '../../_common/models/ui.models';
import { Resources } from '../../_common/resources';
import { TurnManager } from '../../managers/TurnManager';
import type { TooltipProvider } from '../tooltip/TooltipProvider';

/**
 * UI component that displays current turn and focus.
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
  private tooltipProvider?: TooltipProvider;
  private lastPanelWidth = 0;
  private lastPanelHeight = 0;

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
    this.tooltipProvider = options.tooltipProvider;
  }

  onInitialize(): void {
    this.updateDisplay(true);

    if (this.tooltipProvider) {
      const provider = this.tooltipProvider;
      this.pointer.useGraphicsBounds = true;
      this.on('pointerenter', () => {
        provider.show({
          owner: this,
          getAnchorRect: () => ({
            x: this.globalPos.x,
            y: this.globalPos.y,
            width: this.lastPanelWidth,
            height: this.lastPanelHeight,
          }),
          header: 'Focus',
          description:
            'The Ruler has limited focus each turn. Each action — construction, border expansion, or personal deed — demands their attention. Focus fully recovers at the start of a new turn.',
          placement: 'bottom',
          width: 280,
        });
      });
      this.on('pointerleave', () => {
        provider.hide(this);
      });
      this.on('prekill', () => {
        provider.hide(this);
      });
    }
  }

  onPreUpdate(): void {
    this.updateDisplay(false);
  }

  private updateDisplay(force: boolean): void {
    const turnData = this.turnManager.getTurnDataRef();
    const next = {
      turnNumber: turnData.turnNumber,
      apCurrent: turnData.focus.current,
      apMax: turnData.focus.max,
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
      text: `Focus: ${turnData.focus.current} / ${turnData.focus.max}`,
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
    const focusIconSize = 14;
    const focusIconGap = 4;

    const focusIconSprite = Resources.FocusIcon.isLoaded()
      ? new Sprite({
          image: Resources.FocusIcon,
          destSize: { width: focusIconSize, height: focusIconSize },
        })
      : undefined;
    const focusRowWidth =
      apText.width + (focusIconSprite ? focusIconSize + focusIconGap : 0);

    const contentWidth = Math.max(this.barWidth, turnText.width, focusRowWidth);
    const panelWidth = contentWidth + panelPaddingX * 2;
    const barX = (contentWidth - this.barWidth) / 2;
    const panelHeight =
      panelPaddingY * 2 +
      turnText.height +
      textGap +
      apText.height +
      barGap +
      barHeight;

    // Treat x/y as an anchor point (top-center).
    this.pos = vec(this.anchorX - panelWidth / 2, this.anchorY);
    this.lastPanelWidth = panelWidth;
    this.lastPanelHeight = panelHeight;

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

    // Focus icon + text (centered as a group)
    const apY = panelPaddingY + turnText.height + textGap;
    const focusRowX = panelPaddingX + (contentWidth - focusRowWidth) / 2;
    if (focusIconSprite) {
      members.push({
        graphic: focusIconSprite,
        offset: vec(focusRowX, apY + (apText.height - focusIconSize) / 2),
      });
    }
    members.push({
      graphic: apText,
      offset: vec(
        focusRowX + (focusIconSprite ? focusIconSize + focusIconGap : 0),
        apY
      ),
    });

    // Bar geometry
    const barY = apY + apText.height + barGap;
    const maxSegments = Math.max(1, turnData.focus.max);
    const currentSegments = Math.max(
      0,
      Math.min(turnData.focus.current, maxSegments)
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
