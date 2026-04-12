import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  type GraphicsGrouping,
  Rectangle,
  ScreenElement,
  type Sprite,
  Text,
  vec,
} from 'excalibur';
import { getIconSprite } from '../../_common/icons';
import type { TurnDisplayOptions } from '../../_common/models/ui.models';
import { FONT_FAMILY } from '../../_common/text';
import { TurnManager } from '../../managers/TurnManager';
import type { TooltipProvider } from '../tooltip/TooltipProvider';

/** Floating red text shown when focus is spent. */
interface FocusSpendPulse {
  ageMs: number;
  durationMs: number;
  liftPx: number;
  text: Text;
  shadow: Text;
  textWidth: number;
  textHeight: number;
}

import {
  SHAKE_AMPLITUDE_PX,
  SHAKE_ANGULAR_SPEED,
  SHAKE_DURATION_MS,
  SPEND_PULSE_DURATION_MS,
  SPEND_PULSE_LIFT_PX,
} from '../constants/SpendFeedbackConstants';

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
  private spendPulses: FocusSpendPulse[] = [];
  private shake: { ageMs: number; durationMs: number } | undefined;

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

  onPreUpdate(_engine: unknown, elapsedMs: number): void {
    const notifications = this.turnManager.drainFocusSpendNotifications();
    if (notifications.length > 0) {
      let total = 0;
      for (const n of notifications) total += n;
      this.createSpendPulse(total);
      this.shake = { ageMs: 0, durationMs: SHAKE_DURATION_MS };
    }

    const hasActiveEffects = this.tickEffects(elapsedMs);
    this.updateDisplay(false, hasActiveEffects);
  }

  private updateDisplay(force: boolean, effectsActive = false): void {
    const turnData = this.turnManager.getTurnDataRef();
    const next = {
      turnNumber: turnData.turnNumber,
      focusCurrent: turnData.focus.current,
      focusMax: turnData.focus.max,
    };

    if (
      !force &&
      !effectsActive &&
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
    const shakeX = this.getShakeOffset();

    if (focusIconSprite) {
      members.push({
        graphic: focusIconSprite,
        offset: vec(
          xOffset + shakeX,
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
      offset: vec(focusTextOffsetX + shakeX, focusTextOffsetY),
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

    // Floating spend pulse text below the focus section
    const focusR = this.focusRect;
    for (const pulse of this.spendPulses) {
      const progress = Math.min(1, pulse.ageMs / pulse.durationMs);
      const alpha = 1 - progress;
      const floatY = pulse.liftPx * progress;
      const centerX = focusR
        ? focusR.x + focusR.width / 2 - pulse.textWidth / 2
        : panelWidth / 2 - pulse.textWidth / 2;
      const startY = panelHeight;

      pulse.shadow.opacity = alpha * 0.8;
      pulse.text.opacity = alpha;

      members.push({
        graphic: pulse.shadow,
        offset: vec(centerX + 1, startY + floatY + 1),
      });
      members.push({
        graphic: pulse.text,
        offset: vec(centerX, startY + floatY),
      });
    }

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
    return (
      focusText.width + (focusIconSprite ? focusIconSprite.width + gap : 0)
    );
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

  // ============ Focus spend-feedback effects ============

  private createSpendPulse(amount: number): void {
    const displayText = `-${amount}`;
    const text = new Text({
      text: displayText,
      font: new Font({
        size: 18,
        unit: FontUnit.Px,
        color: Color.fromHex('#e05252'),
        family: FONT_FAMILY,
      }),
    });
    const shadow = new Text({
      text: displayText,
      font: new Font({
        size: 18,
        unit: FontUnit.Px,
        color: Color.fromRGB(8, 12, 16),
        family: FONT_FAMILY,
      }),
    });
    this.spendPulses.push({
      ageMs: 0,
      durationMs: SPEND_PULSE_DURATION_MS,
      liftPx: SPEND_PULSE_LIFT_PX,
      text,
      shadow,
      textWidth: text.width,
      textHeight: text.height,
    });
  }

  private tickEffects(elapsedMs: number): boolean {
    let write = 0;
    for (let i = 0; i < this.spendPulses.length; i++) {
      const pulse = this.spendPulses[i];
      pulse.ageMs += elapsedMs;
      if (pulse.ageMs < pulse.durationMs) {
        this.spendPulses[write++] = pulse;
      }
    }
    this.spendPulses.length = write;

    if (this.shake) {
      this.shake.ageMs += elapsedMs;
      if (this.shake.ageMs >= this.shake.durationMs) {
        this.shake = undefined;
      }
    }

    return this.spendPulses.length > 0 || this.shake !== undefined;
  }

  private getShakeOffset(): number {
    if (!this.shake) return 0;
    const progress = this.shake.ageMs / this.shake.durationMs;
    const decay = 1 - progress;
    return (
      SHAKE_AMPLITUDE_PX *
      Math.sin(this.shake.ageMs * SHAKE_ANGULAR_SPEED) *
      decay
    );
  }
}
