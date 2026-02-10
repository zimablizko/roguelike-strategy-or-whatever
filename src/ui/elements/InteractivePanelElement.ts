import {
  Color,
  GraphicsGrouping,
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
    this.hoverBorderColor = options.hoverBorderColor ?? Color.fromHex('#f1c40f');
    this.onClick = options.onClick;
  }

  onInitialize(): void {
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
      this.isPressed = true;
      this.redraw(true);
    });
    this.on('pointerup', () => {
      this.isPressed = false;
      this.redraw(true);
      if (this.isHovered) {
        this.onClick?.();
      }
    });

    this.redraw(true);
  }

  onPreUpdate(): void {
    this.redraw(false);
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
