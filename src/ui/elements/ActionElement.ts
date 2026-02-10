import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  ImageSource,
  Rectangle,
  Sprite,
  Text,
  vec,
} from 'excalibur';
import {
  InteractivePanelElement,
  type InteractivePanelOptions,
} from './InteractivePanelElement';

export interface ActionElementOptions extends InteractivePanelOptions {
  title: string;
  description: string;
  outcomes?: ActionOutcome[];
  width?: number;
  height?: number;
  icon?: ImageSource;
  iconSize?: number;
  textColor?: Color;
  tooltipBgColor?: Color;
  tooltipTextColor?: Color;
  tooltipWidth?: number;
}

export interface ActionOutcome {
  label: string;
  value: string | number;
  icon?: ImageSource;
  color?: Color;
}

/**
 * Reusable interactive action row:
 * - Optional icon at the left side
 * - Action title next to icon
 * - Description tooltip on hover (with optional outcome rows)
 */
export class ActionElement extends InteractivePanelElement {
  private readonly title: string;
  private readonly description: string;
  private readonly outcomes: ActionOutcome[];
  private readonly actionWidth: number;
  private readonly actionHeight: number;
  private readonly icon?: ImageSource;
  private readonly iconSize: number;
  private readonly textColor: Color;
  private readonly tooltipBgColor: Color;
  private readonly tooltipTextColor: Color;
  private readonly tooltipWidth: number;

  private cachedIcon?: { source: ImageSource; sprite: Sprite };
  private outcomeIconCache = new Map<ImageSource, Sprite>();
  private lastVisualState:
    | { hovered: boolean; pressed: boolean }
    | undefined;

  constructor(options: ActionElementOptions) {
    super(options);
    this.title = options.title;
    this.description = options.description;
    this.outcomes = options.outcomes ?? [];
    this.actionWidth = options.width ?? 260;
    this.actionHeight = options.height ?? 44;
    this.icon = options.icon;
    this.iconSize = options.iconSize ?? 24;
    this.textColor = options.textColor ?? Color.White;
    this.tooltipBgColor = options.tooltipBgColor ?? Color.fromHex('#12202d');
    this.tooltipTextColor = options.tooltipTextColor ?? Color.fromHex('#ecf3fa');
    this.tooltipWidth = options.tooltipWidth ?? 300;
  }

  protected redraw(force: boolean): void {
    const visualState = { hovered: this.isHovered, pressed: this.isPressed };
    if (
      !force &&
      this.lastVisualState &&
      this.lastVisualState.hovered === visualState.hovered &&
      this.lastVisualState.pressed === visualState.pressed
    ) {
      return;
    }
    this.lastVisualState = visualState;

    const pressOffset = this.getPressOffset();
    const padding = 10;
    const iconGap = 8;

    this.pos = vec(this.anchorX, this.anchorY);

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: this.actionWidth,
          height: this.actionHeight,
          color: this.getPanelBackgroundColor(),
        }),
        offset: vec(pressOffset, pressOffset),
      },
    ];

    let contentX = padding;

    const iconSprite = this.getIconSprite();
    if (iconSprite) {
      members.push({
        graphic: iconSprite,
        offset: vec(
          contentX + pressOffset,
          (this.actionHeight - this.iconSize) / 2 + pressOffset
        ),
      });
      contentX += this.iconSize + iconGap;
    }

    const titleText = new Text({
      text: this.title,
      font: new Font({
        size: 16,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    members.push({
      graphic: titleText,
      offset: vec(
        contentX + pressOffset,
        (this.actionHeight - titleText.height) / 2 + pressOffset
      ),
    });

    this.addHoverBorder(members, this.actionWidth, this.actionHeight);

    if (this.isHovered) {
      this.addTooltip(members, pressOffset);
    }

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );
  }

  private addTooltip(members: GraphicsGrouping[], pressOffset: number): void {
    const tooltipPadding = 10;
    const lineGap = 3;
    const fontSize = 13;
    const outcomeGap = 6;
    const outcomeRowHeight = 18;
    const outcomeIconSize = 14;
    const tooltipX = this.actionWidth + 10 + pressOffset;
    const tooltipY = pressOffset;
    const lines = this.wrapTooltipText(this.description, 46);

    const textGraphics = lines.map(
      (line) =>
        new Text({
          text: line,
          font: new Font({
            size: fontSize,
            unit: FontUnit.Px,
            color: this.tooltipTextColor,
          }),
        })
    );

    const descriptionHeight = textGraphics.reduce((sum, g) => sum + g.height, 0);
    const outcomeHeight =
      this.outcomes.length > 0
        ? outcomeGap + this.outcomes.length * outcomeRowHeight
        : 0;
    const tooltipHeight =
      tooltipPadding * 2 +
      descriptionHeight +
      Math.max(0, textGraphics.length - 1) * lineGap +
      outcomeHeight;

    members.push({
      graphic: new Rectangle({
        width: this.tooltipWidth,
        height: tooltipHeight,
        color: this.tooltipBgColor,
      }),
      offset: vec(tooltipX, tooltipY),
    });

    let y = tooltipY + tooltipPadding;
    for (const textGraphic of textGraphics) {
      members.push({
        graphic: textGraphic,
        offset: vec(tooltipX + tooltipPadding, y),
      });
      y += textGraphic.height + lineGap;
    }

    if (this.outcomes.length > 0) {
      y += outcomeGap;
      for (const outcome of this.outcomes) {
        let outcomeX = tooltipX + tooltipPadding;
        const iconSprite = this.getOutcomeIconSprite(outcome.icon, outcomeIconSize);
        if (iconSprite) {
          members.push({
            graphic: iconSprite,
            offset: vec(outcomeX, y + (outcomeRowHeight - outcomeIconSize) / 2),
          });
          outcomeX += outcomeIconSize + 6;
        }

        const outcomeText = new Text({
          text: `${outcome.label}: ${outcome.value}`,
          font: new Font({
            size: 13,
            unit: FontUnit.Px,
            color: outcome.color ?? this.tooltipTextColor,
          }),
        });
        members.push({
          graphic: outcomeText,
          offset: vec(outcomeX, y + (outcomeRowHeight - outcomeText.height) / 2),
        });
        y += outcomeRowHeight;
      }
    }
  }

  private getIconSprite(): Sprite | undefined {
    if (!this.icon || !this.icon.isLoaded()) {
      return undefined;
    }

    if (this.cachedIcon && this.cachedIcon.source === this.icon) {
      return this.cachedIcon.sprite;
    }

    const sprite = this.icon.toSprite();
    sprite.width = this.iconSize;
    sprite.height = this.iconSize;
    this.cachedIcon = { source: this.icon, sprite };
    return sprite;
  }

  private getOutcomeIconSprite(
    source: ImageSource | undefined,
    iconSize: number
  ): Sprite | undefined {
    if (!source || !source.isLoaded()) {
      return undefined;
    }

    const cached = this.outcomeIconCache.get(source);
    if (cached) {
      return cached;
    }

    const sprite = source.toSprite();
    sprite.width = iconSize;
    sprite.height = iconSize;
    this.outcomeIconCache.set(source, sprite);
    return sprite;
  }

  private wrapTooltipText(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) {
      return [''];
    }

    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines;
  }
}
