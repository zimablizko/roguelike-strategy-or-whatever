import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  Rectangle,
  ScreenElement,
  Text,
  vec,
} from 'excalibur';
import type { ScreenButtonOptions } from '../../_common/models/ui.models';

export class ScreenButton extends ScreenElement {
  title: string;
  buttonWidth: number;
  buttonHeight: number;
  idleBgColor: Color;
  hoverBgColor: Color;
  clickedBgColor: Color;
  disabledBgColor: Color = Color.Gray;
  idleTextColor: Color = Color.White;
  hoverTextColor: Color = Color.White;
  clickedTextColor: Color = Color.White;
  disabledTextColor: Color = Color.LightGray;
  enabled: boolean = true;
  onClick?: () => void;
  private handlePointerDown = () => {
    this.graphics.use('clicked');
  };
  private handlePointerEnter = () => {
    this.graphics.use('hover');
  };
  private handlePointerLeave = () => {
    this.graphics.use('idle');
  };
  private handlePointerUp = () => {
    this.graphics.use('hover');
    this.onClick?.();
  };

  constructor(options: ScreenButtonOptions) {
    super({ x: options.x, y: options.y });
    this.title = options.title ?? 'Screen Button';
    this.buttonWidth = options.width ?? 100;
    this.buttonHeight = options.height ?? 50;
    this.idleBgColor = options.idleBgColor ?? Color.fromHex('#4a6fa5');
    this.hoverBgColor = options.hoverBgColor ?? Color.fromHex('#5b8abf');
    this.clickedBgColor = options.clickedBgColor ?? Color.fromHex('#3a5a8a');
    this.disabledBgColor = options.disabledBgColor ?? Color.fromHex('#6b7b8d');
    this.idleTextColor = options.idleTextColor ?? Color.fromHex('#e8edf2');
    this.hoverTextColor = options.hoverTextColor ?? Color.fromHex('#ffffff');
    this.clickedTextColor =
      options.clickedTextColor ?? Color.fromHex('#c8d6e5');
    this.disabledTextColor =
      options.disabledTextColor ?? Color.fromHex('#99a8b8');
    this.onClick = options.onClick;
  }
  /**
   * Wrap the title into lines that fit within the button width,
   * using a static font size. Falls back to 2 lines max.
   */
  private wrapText(fontSize: number): string[] {
    const maxCharsPerLine = Math.floor(this.buttonWidth / (fontSize * 0.6));

    if (this.title.length <= maxCharsPerLine) {
      return [this.title];
    }

    // Try to split at a space near the midpoint
    const words = this.title.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (test.length > maxCharsPerLine && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Limit to 2 lines
    return lines.slice(0, 2);
  }

  private buildButtonGraphic(
    bgColor: Color,
    textColor: Color,
    pressOffset: number = 0
  ): GraphicsGroup {
    const fontSize = 16;
    const lines = this.wrapText(fontSize);
    const font = new Font({
      size: fontSize,
      unit: FontUnit.Px,
      color: textColor,
    });

    const lineHeight = fontSize * 1.1;
    const totalTextHeight = lines.length * lineHeight;

    const textMembers = lines.map((line, i) => {
      const textGraphic = new Text({ text: line, font });
      const textWidth = textGraphic.width;
      const offsetX = (this.buttonWidth - textWidth) / 2 + 2;
      const offsetY =
        (this.buttonHeight - totalTextHeight) / 2 + i * lineHeight + 1;
      return {
        graphic: textGraphic,
        offset: vec(offsetX + pressOffset, offsetY + pressOffset),
      };
    });

    return new GraphicsGroup({
      members: [
        {
          graphic: new Rectangle({
            width: this.buttonWidth,
            height: this.buttonHeight,
            color: bgColor,
          }),
          offset: vec(pressOffset, pressOffset),
        },
        ...textMembers,
      ],
    });
  }

  onInitialize() {
    this.graphics.add(
      'idle',
      this.buildButtonGraphic(this.idleBgColor, this.idleTextColor)
    );
    this.graphics.add(
      'hover',
      this.buildButtonGraphic(this.hoverBgColor, this.hoverTextColor)
    );
    this.graphics.add(
      'clicked',
      this.buildButtonGraphic(this.clickedBgColor, this.clickedTextColor, 2)
    );
    this.graphics.add(
      'disabled',
      this.buildButtonGraphic(this.disabledBgColor, this.disabledTextColor)
    );

    this.graphics.use('idle');
    this.updateEvents();
  }

  toggle(value?: boolean) {
    if (value !== undefined) {
      this.enabled = value;
    } else {
      this.enabled = !this.enabled;
    }
    console.log(`Button ${this.title} enabled: ${this.enabled}`);
    this.updateEvents();
  }

  private updateEvents() {
    // Ensure event handlers are not duplicated on repeated toggle() calls.
    this.off('pointerdown', this.handlePointerDown);
    this.off('pointerenter', this.handlePointerEnter);
    this.off('pointerleave', this.handlePointerLeave);
    this.off('pointerup', this.handlePointerUp);

    if (this.enabled) {
      this.on('pointerdown', this.handlePointerDown);
      this.on('pointerenter', this.handlePointerEnter);
      this.on('pointerleave', this.handlePointerLeave);
      this.on('pointerup', this.handlePointerUp);
    } else {
      this.graphics.use('disabled');
    }
  }
}
