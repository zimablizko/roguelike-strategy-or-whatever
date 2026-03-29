import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  Rectangle,
  ScreenElement,
  Text,
  TextAlign,
  vec,
} from 'excalibur';
import { FONT_FAMILY } from '../../_common/text';
import type { TooltipProvider } from '../tooltip/TooltipProvider';

export interface AutoTurnControlViewOptions {
  x: number;
  y: number;
  enabledProvider: () => boolean;
  progressProvider: () => number;
  onToggle: () => void;
  tooltipProvider?: TooltipProvider;
  buttonWidth?: number;
  buttonHeight?: number;
  buttonOffsetY?: number;
  progressWidth?: number;
  progressHeight?: number;
  progressOffsetX?: number;
  progressOffsetY?: number;
}

export class AutoTurnControlView extends ScreenElement {
  private readonly enabledProvider: () => boolean;
  private readonly progressProvider: () => number;
  private readonly onToggle: () => void;
  private readonly tooltipProvider?: TooltipProvider;
  private readonly buttonWidth: number;
  private readonly buttonHeight: number;
  private readonly buttonOffsetY: number;
  private readonly progressWidth: number;
  private readonly progressHeight: number;
  private readonly progressOffsetX: number;
  private readonly progressOffsetY: number;

  private isHovered = false;
  private isPressed = false;
  private isTooltipVisible = false;
  private lastRenderKey = '';

  constructor(options: AutoTurnControlViewOptions) {
    super({ x: options.x, y: options.y });
    this.enabledProvider = options.enabledProvider;
    this.progressProvider = options.progressProvider;
    this.onToggle = options.onToggle;
    this.tooltipProvider = options.tooltipProvider;
    this.buttonWidth = options.buttonWidth ?? 48;
    this.buttonHeight = options.buttonHeight ?? 40;
    this.buttonOffsetY = options.buttonOffsetY ?? 8;
    this.progressWidth = options.progressWidth ?? 150;
    this.progressHeight = options.progressHeight ?? 5;
    this.progressOffsetX = options.progressOffsetX ?? 56;
    this.progressOffsetY = options.progressOffsetY ?? 0;
  }

  onInitialize(): void {
    this.on('pointerenter', (evt) => {
      this.isHovered = this.isWithinButton(evt.screenPos.x, evt.screenPos.y);
      this.syncTooltip();
      this.render(true);
    });

    this.on('pointermove', (evt) => {
      const nextHovered = this.isWithinButton(evt.screenPos.x, evt.screenPos.y);
      if (nextHovered === this.isHovered) {
        return;
      }
      this.isHovered = nextHovered;
      if (!nextHovered) {
        this.isPressed = false;
      }
      this.syncTooltip();
      this.render(true);
    });

    this.on('pointerdown', (evt) => {
      if (!this.isWithinButton(evt.screenPos.x, evt.screenPos.y)) {
        return;
      }
      this.isPressed = true;
      this.render(true);
    });

    this.on('pointerup', (evt) => {
      const clicked = this.isPressed && this.isWithinButton(evt.screenPos.x, evt.screenPos.y);
      this.isPressed = false;
      if (clicked) {
        this.onToggle();
      }
      this.render(true);
    });

    this.on('pointerleave', () => {
      this.isHovered = false;
      this.isPressed = false;
      this.syncTooltip();
      this.render(true);
    });

    this.on('prekill', () => {
      this.tooltipProvider?.hide(this);
      this.isTooltipVisible = false;
    });

    this.render(true);
  }

  onPreUpdate(): void {
    this.render(false);
  }

  private render(force: boolean): void {
    const enabled = this.enabledProvider();
    const progress = this.clampProgress(this.progressProvider());
    const roundedProgress = Math.round(progress * 1000) / 1000;
    const renderKey = [
      enabled ? '1' : '0',
      roundedProgress,
      this.isHovered ? '1' : '0',
      this.isPressed ? '1' : '0',
    ].join(':');

    if (!force && renderKey === this.lastRenderKey) {
      return;
    }
    this.lastRenderKey = renderKey;

    const buttonBg = enabled
      ? this.isPressed
        ? Color.fromHex('#1f4330')
        : this.isHovered
          ? Color.fromHex('#2d6543')
          : Color.fromHex('#255338')
      : this.isPressed
        ? Color.fromHex('#1a2834')
        : this.isHovered
          ? Color.fromHex('#294154')
          : Color.fromHex('#203344');
    const buttonBorder = enabled
      ? Color.fromHex('#7acb92')
      : Color.fromHex('#4f6476');
    const buttonText = enabled
      ? Color.fromHex('#eef8f1')
      : Color.fromHex('#cad6df');

    const members = [
      {
        graphic: new Rectangle({
          width: this.buttonWidth,
          height: this.buttonHeight,
          color: buttonBg,
          strokeColor: buttonBorder,
          lineWidth: 1,
        }),
        offset: vec(0, this.buttonOffsetY),
      },
      {
        graphic: new Text({
          text: 'Auto',
          font: new Font({
            size: 13,
            unit: FontUnit.Px,
            color: buttonText,
            family: FONT_FAMILY,
            textAlign: TextAlign.Center,
          }),
        }),
        offset: vec(this.buttonWidth / 2, this.buttonOffsetY + 11),
      },
    ];

    if (enabled || progress > 0) {
      members.push(
        {
          graphic: new Rectangle({
            width: this.progressWidth,
            height: this.progressHeight,
            color: Color.fromHex('#13202a'),
            strokeColor: Color.fromHex('#314b5d'),
            lineWidth: 1,
          }),
          offset: vec(this.progressOffsetX, this.progressOffsetY),
        },
        {
          graphic: new Rectangle({
            width: Math.max(0, this.progressWidth * progress),
            height: this.progressHeight,
            color: enabled ? Color.fromHex('#7ad08f') : Color.fromHex('#4f6476'),
          }),
          offset: vec(this.progressOffsetX, this.progressOffsetY),
        }
      );
    }

    this.graphics.use(new GraphicsGroup({ members }));
    this.syncTooltip();
  }

  private isWithinButton(screenX: number, screenY: number): boolean {
    const localX = screenX - this.globalPos.x;
    const localY = screenY - this.globalPos.y;
    return (
      localX >= 0 &&
      localX <= this.buttonWidth &&
      localY >= this.buttonOffsetY &&
      localY <= this.buttonOffsetY + this.buttonHeight
    );
  }

  private syncTooltip(): void {
    if (!this.tooltipProvider) {
      return;
    }

    if (!this.isHovered) {
      if (this.isTooltipVisible) {
        this.tooltipProvider.hide(this);
        this.isTooltipVisible = false;
      }
      return;
    }

    this.tooltipProvider.show({
      owner: this,
      getAnchorRect: () => ({
        x: this.globalPos.x,
        y: this.globalPos.y + this.buttonOffsetY,
        width: this.buttonWidth,
        height: this.buttonHeight,
      }),
      header: 'Auto Turn',
      description:
        'When enabled, untouched turns end automatically after 10 seconds. Important interruptions such as random events stop the timer.',
      placement: 'top',
      width: 300,
    });
    this.isTooltipVisible = true;
  }

  private clampProgress(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }
}
