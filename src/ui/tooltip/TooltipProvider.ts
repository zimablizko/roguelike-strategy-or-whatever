import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  ImageSource,
  Rectangle,
  ScreenElement,
  Sprite,
  Text,
  vec,
} from 'excalibur';
import { measureTextWidth } from '../../_common/text';
import { UI_Z } from '../constants/ZLayers';

export interface TooltipAnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TooltipOutcome {
  label: string;
  value: string | number;
  icon?: ImageSource;
  color?: Color;
}

export interface TooltipRequest {
  owner: unknown;
  getAnchorRect: () => TooltipAnchorRect;
  description: string;
  outcomes?: TooltipOutcome[];
  placement?: TooltipPlacement;
  width?: number;
  bgColor?: Color;
  textColor?: Color;
}

interface TooltipProviderOptions {
  z?: number;
}

type TooltipPlacement = 'right' | 'bottom' | 'left' | 'top';

export class TooltipProvider extends ScreenElement {
  private readonly defaultTooltipWidth = 300;
  private readonly minTooltipWidth = 140;
  private readonly defaultBgColor = Color.fromHex('#12202d');
  private readonly defaultTextColor = Color.fromHex('#ecf3fa');
  private readonly tooltipPadding = 10;
  private readonly lineGap = 3;
  private readonly fontSize = 13;
  private readonly outcomeGap = 6;
  private readonly outcomeRowHeight = 18;
  private readonly outcomeIconSize = 14;
  private readonly tooltipGap = 10;
  private readonly viewportPadding = 8;
  private readonly placementOrder: TooltipPlacement[] = [
    'right',
    'bottom',
    'left',
    'top',
  ];

  private activeTooltip?: TooltipRequest;
  private tooltipWidth = this.defaultTooltipWidth;
  private tooltipHeight = 0;
  private lastPositionKey?: string;
  private lastContentKey?: string;
  private outcomeIconCache = new Map<ImageSource, Sprite>();

  constructor(options?: TooltipProviderOptions) {
    super({ x: 0, y: 0 });
    this.z = options?.z ?? UI_Z.tooltip;
    this.graphics.isVisible = false;
    this.pointer.useGraphicsBounds = false;
    this.pointer.useColliderShape = false;
  }

  show(request: TooltipRequest): void {
    this.activeTooltip = request;
    this.graphics.isVisible = true;

    const contentKey = this.buildContentKey(request);
    if (contentKey !== this.lastContentKey) {
      this.lastContentKey = contentKey;
      this.rebuildGraphics(request);
    }

    this.updatePosition();
  }

  hide(owner?: unknown): void {
    if (owner !== undefined && this.activeTooltip?.owner !== owner) {
      return;
    }

    this.activeTooltip = undefined;
    this.lastContentKey = undefined;
    this.lastPositionKey = undefined;
    this.graphics.isVisible = false;
    this.graphics.use(new GraphicsGroup({ members: [] }));
  }

  onPreUpdate(): void {
    if (!this.activeTooltip || !this.graphics.isVisible) {
      return;
    }

    this.updatePosition();
  }

  private rebuildGraphics(request: TooltipRequest): void {
    const outcomes = request.outcomes ?? [];
    const textColor = request.textColor ?? this.defaultTextColor;
    const maxTooltipWidth = request.width ?? this.defaultTooltipWidth;
    const maxTextWidth = Math.max(
      40,
      maxTooltipWidth - this.tooltipPadding * 2
    );

    const lines = this.wrapTextToWidth(
      request.description,
      maxTextWidth,
      textColor
    );
    const textGraphics = lines.map(
      (line) =>
        new Text({
          text: line,
          font: new Font({
            size: this.fontSize,
            unit: FontUnit.Px,
            color: textColor,
          }),
        })
    );
    const descriptionContentWidth = textGraphics.reduce(
      (max, g) => Math.max(max, g.width),
      0
    );

    const outcomeRows = outcomes.map((outcome) => {
      const iconSprite = this.getOutcomeIconSprite(outcome.icon);
      const outcomeText = new Text({
        text: `${outcome.label}: ${outcome.value}`,
        font: new Font({
          size: this.fontSize,
          unit: FontUnit.Px,
          color: outcome.color ?? textColor,
        }),
      });
      const rowWidth =
        (iconSprite ? this.outcomeIconSize + 6 : 0) + outcomeText.width;

      return {
        iconSprite,
        outcomeText,
        rowWidth,
      };
    });
    const outcomesContentWidth = outcomeRows.reduce(
      (max, row) => Math.max(max, row.rowWidth),
      0
    );
    const contentWidth = Math.max(
      descriptionContentWidth,
      outcomesContentWidth
    );
    const minWidth = Math.min(this.minTooltipWidth, maxTooltipWidth);
    this.tooltipWidth = Math.max(
      minWidth,
      Math.min(maxTooltipWidth, contentWidth + this.tooltipPadding * 2)
    );

    const descriptionHeight = textGraphics.reduce(
      (sum, g) => sum + g.height,
      0
    );
    const outcomeHeight =
      outcomes.length > 0
        ? this.outcomeGap + outcomes.length * this.outcomeRowHeight
        : 0;
    this.tooltipHeight =
      this.tooltipPadding * 2 +
      descriptionHeight +
      Math.max(0, textGraphics.length - 1) * this.lineGap +
      outcomeHeight;

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: this.tooltipWidth,
          height: this.tooltipHeight,
          color: request.bgColor ?? this.defaultBgColor,
        }),
        offset: vec(0, 0),
      },
    ];

    let y = this.tooltipPadding;
    for (const textGraphic of textGraphics) {
      members.push({
        graphic: textGraphic,
        offset: vec(this.tooltipPadding, y),
      });
      y += textGraphic.height + this.lineGap;
    }

    if (outcomes.length > 0) {
      y += this.outcomeGap;
      for (const row of outcomeRows) {
        let outcomeX = this.tooltipPadding;
        const iconSprite = row.iconSprite;
        if (iconSprite) {
          members.push({
            graphic: iconSprite,
            offset: vec(
              outcomeX,
              y + (this.outcomeRowHeight - this.outcomeIconSize) / 2
            ),
          });
          outcomeX += this.outcomeIconSize + 6;
        }
        const outcomeText = row.outcomeText;

        members.push({
          graphic: outcomeText,
          offset: vec(
            outcomeX,
            y + (this.outcomeRowHeight - outcomeText.height) / 2
          ),
        });

        y += this.outcomeRowHeight;
      }
    }

    this.graphics.use(new GraphicsGroup({ members }));
  }

  private updatePosition(): void {
    if (!this.activeTooltip) {
      return;
    }

    const engine = this.scene?.engine;
    if (!engine) {
      return;
    }

    const anchor = this.activeTooltip.getAnchorRect();
    const viewportWidth = engine.drawWidth;
    const viewportHeight = engine.drawHeight;
    const placement = this.choosePlacement(
      anchor,
      viewportWidth,
      viewportHeight,
      this.activeTooltip.placement
    );
    const proposed = this.getPlacementPosition(placement, anchor);
    const clamped = this.clampToViewport(
      proposed,
      viewportWidth,
      viewportHeight
    );

    const key = [
      clamped.x.toFixed(2),
      clamped.y.toFixed(2),
      placement,
      viewportWidth,
      viewportHeight,
    ].join('|');

    if (key === this.lastPositionKey) {
      return;
    }

    this.lastPositionKey = key;
    this.pos = vec(clamped.x, clamped.y);
  }

  private choosePlacement(
    anchor: TooltipAnchorRect,
    viewportWidth: number,
    viewportHeight: number,
    forcedPlacement?: TooltipPlacement
  ): TooltipPlacement {
    if (forcedPlacement) {
      return forcedPlacement;
    }

    for (const placement of this.placementOrder) {
      const candidate = this.getPlacementPosition(placement, anchor);
      if (
        this.fitsInViewport(
          candidate.x,
          candidate.y,
          viewportWidth,
          viewportHeight
        )
      ) {
        return placement;
      }
    }

    return this.placementOrder[0];
  }

  private getPlacementPosition(
    placement: TooltipPlacement,
    anchor: TooltipAnchorRect
  ): { x: number; y: number } {
    if (placement === 'right') {
      return {
        x: anchor.x + anchor.width + this.tooltipGap,
        y: anchor.y + (anchor.height - this.tooltipHeight) / 2,
      };
    }

    if (placement === 'bottom') {
      return {
        x: anchor.x + (anchor.width - this.tooltipWidth) / 2,
        y: anchor.y + anchor.height + this.tooltipGap,
      };
    }

    if (placement === 'left') {
      return {
        x: anchor.x - this.tooltipWidth - this.tooltipGap,
        y: anchor.y + (anchor.height - this.tooltipHeight) / 2,
      };
    }

    return {
      x: anchor.x + (anchor.width - this.tooltipWidth) / 2,
      y: anchor.y - this.tooltipHeight - this.tooltipGap,
    };
  }

  private fitsInViewport(
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number
  ): boolean {
    return (
      x >= this.viewportPadding &&
      y >= this.viewportPadding &&
      x + this.tooltipWidth <= viewportWidth - this.viewportPadding &&
      y + this.tooltipHeight <= viewportHeight - this.viewportPadding
    );
  }

  private clampToViewport(
    position: { x: number; y: number },
    viewportWidth: number,
    viewportHeight: number
  ): { x: number; y: number } {
    const minX = this.viewportPadding;
    const minY = this.viewportPadding;
    const maxX = Math.max(
      minX,
      viewportWidth - this.tooltipWidth - this.viewportPadding
    );
    const maxY = Math.max(
      minY,
      viewportHeight - this.tooltipHeight - this.viewportPadding
    );

    return {
      x: Math.min(Math.max(position.x, minX), maxX),
      y: Math.min(Math.max(position.y, minY), maxY),
    };
  }

  private getOutcomeIconSprite(
    source: ImageSource | undefined
  ): Sprite | undefined {
    if (!source || !source.isLoaded()) {
      return undefined;
    }

    const cached = this.outcomeIconCache.get(source);
    if (cached) {
      return cached;
    }

    const sprite = source.toSprite();
    sprite.width = this.outcomeIconSize;
    sprite.height = this.outcomeIconSize;
    this.outcomeIconCache.set(source, sprite);
    return sprite;
  }

  private wrapTextToWidth(
    text: string,
    maxTextWidth: number,
    textColor: Color
  ): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) {
      return [''];
    }

    const lines: string[] = [];
    let current = '';
    const widthLimit = Math.max(40, maxTextWidth);

    for (const word of words) {
      if (measureTextWidth(word, this.fontSize, textColor) > widthLimit) {
        const chunks = this.breakWordToWidth(word, widthLimit, textColor);
        if (current) {
          lines.push(current);
          current = '';
        }

        for (let i = 0; i < chunks.length - 1; i++) {
          lines.push(chunks[i]);
        }
        current = chunks[chunks.length - 1] ?? '';
        continue;
      }

      const next = current ? `${current} ${word}` : word;
      if (
        measureTextWidth(next, this.fontSize, textColor) > widthLimit &&
        current
      ) {
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

  private breakWordToWidth(
    word: string,
    maxTextWidth: number,
    textColor: Color
  ): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const char of word) {
      const next = `${current}${char}`;
      if (
        current &&
        measureTextWidth(next, this.fontSize, textColor) > maxTextWidth
      ) {
        chunks.push(current);
        current = char;
      } else {
        current = next;
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks.length > 0 ? chunks : [''];
  }

  private buildContentKey(request: TooltipRequest): string {
    const outcomes = (request.outcomes ?? [])
      .map((outcome) => {
        const iconPath = outcome.icon?.path ?? '';
        const color = outcome.color?.toHex() ?? '';
        return `${outcome.label}:${outcome.value}:${iconPath}:${color}`;
      })
      .join('|');

    const bgColor = request.bgColor?.toHex() ?? '';
    const textColor = request.textColor?.toHex() ?? '';

    return [
      request.description,
      request.width ?? this.defaultTooltipWidth,
      bgColor,
      textColor,
      outcomes,
    ].join('::');
  }
}
