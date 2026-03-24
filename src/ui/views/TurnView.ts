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
import { getIconSprite } from '../../_common/icons';
import type { TurnDisplayOptions } from '../../_common/models/ui.models';
import { FONT_FAMILY } from '../../_common/text';
import { TurnManager } from '../../managers/TurnManager';
import type { TooltipProvider } from '../tooltip/TooltipProvider';

/**
 * UI component that displays the current date plus a compact focus readout.
 */
export class TurnDisplay extends ScreenElement {
  private turnManager: TurnManager;
  private anchorX: number;
  private anchorY: number;
  private textColor: Color;
  private panelBgColor: Color;
  private panelBorderColor: Color;
  private tooltipProvider?: TooltipProvider;
  private focusRect:
    | { x: number; y: number; width: number; height: number }
    | undefined;
  private isFocusHovered = false;

  private lastRendered:
    | { turnNumber: number; focusCurrent: number; focusMax: number }
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
    this.tooltipProvider = options.tooltipProvider;
  }

  onInitialize(): void {
    this.on('pointerenter', (evt) => {
      this.updateFocusHover(evt.screenPos.x, evt.screenPos.y);
    });
    this.on('pointermove', (evt) => {
      this.updateFocusHover(evt.screenPos.x, evt.screenPos.y);
    });
    this.on('pointerleave', () => {
      this.clearFocusHover();
    });
    this.on('prekill', () => {
      this.clearFocusHover();
    });
    this.updateDisplay(true);
  }

  onPreUpdate(): void {
    this.updateDisplay(false);
  }

  private updateDisplay(force: boolean): void {
    const turnData = this.turnManager.getTurnDataRef();
    const next = {
      turnNumber: turnData.turnNumber,
      focusCurrent: turnData.focus.current,
      focusMax: turnData.focus.max,
    };

    if (
      !force &&
      this.lastRendered &&
      this.lastRendered.turnNumber === next.turnNumber &&
      this.lastRendered.focusCurrent === next.focusCurrent &&
      this.lastRendered.focusMax === next.focusMax
    ) {
      return;
    }
    this.lastRendered = next;

    const focusIconSize = 20;
    const focusIconSprite = getIconSprite('focus', focusIconSize);
    const focusText = new Text({
      text: `${turnData.focus.current}/${turnData.focus.max}`,
      font: new Font({
        size: 16,
        unit: FontUnit.Px,
        color: Color.fromHex('#79d46b'),
        family: FONT_FAMILY,
      }),
    });
    const turnText = new Text({
      text: this.turnManager.getDateLabel(),
      font: new Font({
        size: 16,
        unit: FontUnit.Px,
        color: this.textColor,
        family: FONT_FAMILY,
      }),
    });

    const panelPaddingX = 14;
    const panelPaddingY = 8;
    const borderWidth = 1;
    const sectionGap = 8;
    const separatorGap = 10;
    const separatorWidth = 1;

    const focusSectionWidth = this.getFocusSectionWidth(
      focusIconSprite,
      focusText,
      sectionGap
    );
    const contentWidth =
      focusSectionWidth + separatorGap * 2 + separatorWidth + turnText.width;
    const panelWidth = contentWidth + panelPaddingX * 2;
    const panelHeight =
      Math.max(turnText.height, focusIconSize) + panelPaddingY * 2;

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

    let xOffset = panelPaddingX;

    if (focusIconSprite) {
      members.push({
        graphic: focusIconSprite,
        offset: vec(
          xOffset,
          panelPaddingY + (panelHeight - panelPaddingY * 2 - focusIconSize) / 2
        ),
      });
      xOffset += focusIconSize + sectionGap;
    }

    const focusTextOffsetX = xOffset;
    const focusTextOffsetY =
      panelPaddingY + (panelHeight - panelPaddingY * 2 - focusText.height) / 2;
    members.push({
      graphic: focusText,
      offset: vec(focusTextOffsetX, focusTextOffsetY),
    });
    xOffset += focusText.width + separatorGap;

    this.focusRect = {
      x: panelPaddingX,
      y: panelPaddingY,
      width: focusSectionWidth,
      height: panelHeight - panelPaddingY * 2,
    };

    members.push({
      graphic: new Rectangle({
        width: separatorWidth,
        height: panelHeight - panelPaddingY * 2,
        color: this.panelBorderColor,
      }),
      offset: vec(xOffset, panelPaddingY),
    });
    xOffset += separatorWidth + separatorGap;

    members.push({
      graphic: turnText,
      offset: vec(
        xOffset,
        panelPaddingY + (panelHeight - panelPaddingY * 2 - turnText.height) / 2
      ),
    });

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );
  }

  private getFocusSectionWidth(
    focusIconSprite: Sprite | undefined,
    focusText: Text,
    gap: number
  ): number {
    return focusText.width + (focusIconSprite ? focusIconSprite.width + gap : 0);
  }

  private updateFocusHover(screenX: number, screenY: number): void {
    const localX = screenX - this.globalPos.x;
    const localY = screenY - this.globalPos.y;
    const rect = this.focusRect;
    const hovered =
      !!rect &&
      localX >= rect.x &&
      localX <= rect.x + rect.width &&
      localY >= rect.y &&
      localY <= rect.y + rect.height;

    if (hovered === this.isFocusHovered) {
      return;
    }

    this.clearFocusHover();
    if (!hovered || !rect || !this.tooltipProvider) {
      return;
    }

    this.isFocusHovered = true;
    this.tooltipProvider.show({
      owner: this,
      getAnchorRect: () => ({
        x: this.globalPos.x + rect.x,
        y: this.globalPos.y + rect.y,
        width: rect.width,
        height: rect.height,
      }),
      header: 'Focus',
      description:
        'The Ruler has limited focus each turn. Each action - construction, border expansion, or personal deed - demands their attention. Focus fully recovers at the start of a new turn.',
      placement: 'bottom',
      width: 280,
    });
  }

  private clearFocusHover(): void {
    this.isFocusHovered = false;
    this.tooltipProvider?.hide(this);
  }
}
