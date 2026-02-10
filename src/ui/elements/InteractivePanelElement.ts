import {
  Color,
  GraphicsGrouping,
  type PointerEvent,
  Rectangle,
  ScreenElement,
  vec,
} from 'excalibur';

export interface InteractivePanelOptions {
  x: number;
  y: number;
  bgColor?: Color;
  hoverBgColor?: Color;
  pressedBgColor?: Color;
  hoverBorderColor?: Color;
  onClick?: () => void;
}

/**
 * Shared interactive panel behavior:
 * - Hover/press visual state
 * - Click callback
 * - Hover border rendering helper
 * - Press offset helper
 */
export abstract class InteractivePanelElement extends ScreenElement {
  protected readonly anchorX: number;
  protected readonly anchorY: number;

  private idleBgColor: Color;
  private hoverBgColor: Color;
  private pressedBgColor: Color;
  private hoverBorderColor: Color;
  private onClick?: () => void;

  protected isHovered = false;
  protected isPressed = false;

  constructor(options: InteractivePanelOptions) {
    super({ x: options.x, y: options.y });
    this.anchorX = options.x;
    this.anchorY = options.y;
    this.idleBgColor = options.bgColor ?? Color.fromHex('#1a252f');
    this.hoverBgColor = options.hoverBgColor ?? Color.fromHex('#2a3a47');
    this.pressedBgColor = options.pressedBgColor ?? Color.fromHex('#334859');
    this.hoverBorderColor =
      options.hoverBorderColor ?? Color.fromHex('#f1c40f');
    this.onClick = options.onClick;
  }

  onInitialize(): void {
    this.pointer.useGraphicsBounds = true;
    this.pointer.useColliderShape = false;

    this.on('pointerenter', () => {
      this.isHovered = true;
      this.redraw(true);
    });
    this.on('pointerleave', () => {
      this.isHovered = false;
      this.isPressed = false;
      this.redraw(true);
    });
    this.on('pointerdown', () => {
      this.isHovered = true;
      this.isPressed = true;
      this.redraw(true);
    });
    this.on('pointerup', (_evt: PointerEvent) => {
      this.isHovered = true;
      this.isPressed = false;
      this.redraw(true);
      this.onClick?.();
    });

    this.redraw(true);
  }

  onPreUpdate(): void {
    this.redraw(false);
  }

  /**
   * One-shot hover sync used when UI is rebuilt under a stationary cursor.
   */
  public syncHoverFromScreenPoint(screenX: number, screenY: number): void {
    const bounds = this.graphics.localBounds;
    const left = this.globalPos.x + bounds.left;
    const right = this.globalPos.x + bounds.right;
    const top = this.globalPos.y + bounds.top;
    const bottom = this.globalPos.y + bounds.bottom;

    const isInside =
      screenX >= left && screenX <= right && screenY >= top && screenY <= bottom;

    if (isInside === this.isHovered) {
      return;
    }

    this.isHovered = isInside;
    if (!isInside) {
      this.isPressed = false;
    }
    this.redraw(true);
  }

  protected getPanelBackgroundColor(): Color {
    if (this.isPressed) return this.pressedBgColor;
    if (this.isHovered) return this.hoverBgColor;
    return this.idleBgColor;
  }

  protected getPressOffset(): number {
    return this.isPressed ? 2 : 0;
  }

  protected addHoverBorder(
    members: GraphicsGrouping[],
    width: number,
    height: number
  ): void {
    if (!this.isHovered) return;

    const borderWidth = 2;
    const offset = this.getPressOffset();
    members.push(
      {
        graphic: new Rectangle({
          width,
          height: borderWidth,
          color: this.hoverBorderColor,
        }),
        offset: vec(offset, offset),
      },
      {
        graphic: new Rectangle({
          width,
          height: borderWidth,
          color: this.hoverBorderColor,
        }),
        offset: vec(offset, offset + height - borderWidth),
      },
      {
        graphic: new Rectangle({
          width: borderWidth,
          height,
          color: this.hoverBorderColor,
        }),
        offset: vec(offset, offset),
      },
      {
        graphic: new Rectangle({
          width: borderWidth,
          height,
          color: this.hoverBorderColor,
        }),
        offset: vec(offset + width - borderWidth, offset),
      }
    );
  }

  protected abstract redraw(force: boolean): void;
}
