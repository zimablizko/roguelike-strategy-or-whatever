import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  type GraphicsGrouping,
  Rectangle,
  ScreenElement,
  Text,
  vec,
} from 'excalibur';
import { getIconSprite } from '../../_common/icons';
import type { FocusDisplayOptions } from '../../_common/models/ui.models';
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

const SPEND_PULSE_DURATION_MS = 2000;
const SPEND_PULSE_LIFT_PX = 40;
const SHAKE_DURATION_MS = 350;
const SHAKE_AMPLITUDE_PX = 3;
const SHAKE_ANGULAR_SPEED = 0.07;

/**
 * UI component that displays the focus (action-point) bar.
 * Positioned independently from the date display.
 */
export class FocusDisplay extends ScreenElement {
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

  private lastRendered: { apCurrent: number; apMax: number } | undefined;
  private spendPulses: FocusSpendPulse[] = [];
  private shake: { ageMs: number; durationMs: number } | undefined;

  constructor(options: FocusDisplayOptions) {
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
    this.barWidth = options.barWidth ?? 200;
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
      apCurrent: turnData.focus.current,
      apMax: turnData.focus.max,
    };

    if (
      !force &&
      !effectsActive &&
      this.lastRendered &&
      this.lastRendered.apCurrent === next.apCurrent &&
      this.lastRendered.apMax === next.apMax
    ) {
      return;
    }
    this.lastRendered = next;

    const apText = new Text({
      text: `Focus: ${turnData.focus.current} / ${turnData.focus.max}`,
      font: new Font({
        size: 16,
        unit: FontUnit.Px,
        color: this.textColor,
        family: FONT_FAMILY,
      }),
    });

    const barGap = 6;
    const barHeight = 14;
    const panelPaddingX = 12;
    const panelPaddingY = 8;
    const borderWidth = 1;
    const focusIconSize = 24;
    const focusIconGap = 4;

    const focusIconSprite = getIconSprite('focus', focusIconSize);
    const focusRowWidth =
      apText.width + (focusIconSprite ? focusIconSize + focusIconGap : 0);

    const contentWidth = Math.max(this.barWidth, focusRowWidth);
    const panelWidth = contentWidth + panelPaddingX * 2;
    const barX = (contentWidth - this.barWidth) / 2;
    const panelHeight = panelPaddingY * 2 + apText.height + barGap + barHeight;

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

    // Focus icon + text (centered) with shake offset
    const shakeX = this.getShakeOffset();
    const focusRowX = panelPaddingX + (contentWidth - focusRowWidth) / 2;
    if (focusIconSprite) {
      members.push({
        graphic: focusIconSprite,
        offset: vec(
          focusRowX + shakeX,
          panelPaddingY + (apText.height - focusIconSize) / 2
        ),
      });
    }
    members.push({
      graphic: apText,
      offset: vec(
        focusRowX +
          (focusIconSprite ? focusIconSize + focusIconGap : 0) +
          shakeX,
        panelPaddingY
      ),
    });

    // Bar geometry
    const barY = panelPaddingY + apText.height + barGap;
    const maxSegments = Math.max(1, turnData.focus.max);
    const currentSegments = Math.max(
      0,
      Math.min(turnData.focus.current, maxSegments)
    );

    const separatorW = 1;
    const segmentW =
      (this.barWidth - (maxSegments - 1) * separatorW) / maxSegments;

    // Outline
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

    // Segments
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

    // Floating spend pulse text below the panel
    for (const pulse of this.spendPulses) {
      const progress = Math.min(1, pulse.ageMs / pulse.durationMs);
      const alpha = 1 - progress;
      const floatY = pulse.liftPx * progress;
      const centerX = panelWidth / 2 - pulse.textWidth / 2;
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

  // ============ Spend-feedback effects ============

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
