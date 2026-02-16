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
import type {
  TooltipOutcomeRenderItem,
  TooltipOutcomeRenderRow,
  TooltipProviderOptions,
} from '../../_common/models/ui.models';
import type {
  TooltipAnchorRect,
  TooltipOutcome,
  TooltipPlacement,
  TooltipRequest,
} from '../../_common/models/tooltip.models';
import { measureTextWidth } from '../../_common/text';
import {
  TOOLTIP_COLORS,
  TOOLTIP_LAYOUT,
  TOOLTIP_PLACEMENT_ORDER,
} from '../constants/TooltipConstants';
import { UI_Z } from '../constants/ZLayers';

export class TooltipProvider extends ScreenElement {
  private readonly defaultTooltipWidth = TOOLTIP_LAYOUT.defaultWidth;
  private readonly minTooltipWidth = TOOLTIP_LAYOUT.minWidth;
  private readonly defaultBgColor = TOOLTIP_COLORS.background;
  private readonly defaultTextColor = TOOLTIP_COLORS.text;
  private readonly defaultHeaderColor = TOOLTIP_COLORS.headerText;
  private readonly separatorColor = TOOLTIP_COLORS.separator;
  private readonly tooltipPadding = TOOLTIP_LAYOUT.padding;
  private readonly lineGap = TOOLTIP_LAYOUT.lineGap;
  private readonly headerGap = TOOLTIP_LAYOUT.headerGap;
  private readonly fontSize = TOOLTIP_LAYOUT.fontSize;
  private readonly headerFontSize = TOOLTIP_LAYOUT.headerFontSize;
  private readonly outcomeGap = TOOLTIP_LAYOUT.outcomeGap;
  private readonly outcomeRowHeight = TOOLTIP_LAYOUT.outcomeRowHeight;
  private readonly outcomeInlineItemGap = TOOLTIP_LAYOUT.outcomeInlineItemGap;
  private readonly outcomeRowGap = TOOLTIP_LAYOUT.outcomeRowGap;
  private readonly outcomeIconSize = TOOLTIP_LAYOUT.outcomeIconSize;
  private readonly tooltipGap = TOOLTIP_LAYOUT.tooltipGap;
  private readonly viewportPadding = TOOLTIP_LAYOUT.viewportPadding;
  private readonly placementOrder: TooltipPlacement[] = [
    ...TOOLTIP_PLACEMENT_ORDER,
  ];

  private activeTooltip?: TooltipRequest;
  private tooltipWidth: number = this.defaultTooltipWidth;
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
    const headerText = request.header?.trim() ?? '';
    const maxTooltipWidth = request.width ?? this.defaultTooltipWidth;
    const maxTextWidth = Math.max(
      40,
      maxTooltipWidth - this.tooltipPadding * 2
    );

    const headerGraphic = headerText
      ? new Text({
          text: headerText,
          font: new Font({
            size: this.headerFontSize,
            unit: FontUnit.Px,
            color: this.defaultHeaderColor,
          }),
        })
      : undefined;

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

    const outcomeRows = this.buildOutcomeRows(outcomes, textColor);
    const outcomesContentWidth = outcomeRows.reduce(
      (max, row) => Math.max(max, row.width),
      0
    );
    const contentWidth = Math.max(
      headerGraphic?.width ?? 0,
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
    const headerBlockHeight = headerGraphic
      ? headerGraphic.height + this.headerGap + 1 + this.headerGap
      : 0;
    const outcomeHeight =
      outcomeRows.length > 0
        ? this.outcomeGap +
          outcomeRows.reduce((sum, row) => sum + row.height, 0) +
          Math.max(0, outcomeRows.length - 1) * this.outcomeRowGap
        : 0;
    this.tooltipHeight =
      this.tooltipPadding * 2 +
      headerBlockHeight +
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
    if (headerGraphic) {
      members.push({
        graphic: headerGraphic,
        offset: vec(this.tooltipPadding, y),
      });
      y += headerGraphic.height + this.headerGap;
      members.push({
        graphic: new Rectangle({
          width: this.tooltipWidth - this.tooltipPadding * 2,
          height: 1,
          color: this.separatorColor,
        }),
        offset: vec(this.tooltipPadding, y),
      });
      y += this.headerGap + 1;
    }

    for (const textGraphic of textGraphics) {
      members.push({
        graphic: textGraphic,
        offset: vec(this.tooltipPadding, y),
      });
      y += textGraphic.height + this.lineGap;
    }

    if (outcomeRows.length > 0) {
      y += this.outcomeGap;
      for (const row of outcomeRows) {
        let outcomeX = this.tooltipPadding;
        if (row.labelGraphic) {
          members.push({
            graphic: row.labelGraphic,
            offset: vec(
              outcomeX,
              y + (row.height - row.labelGraphic.height) / 2
            ),
          });
          outcomeX += row.labelGraphic.width + 8;
        }

        for (let i = 0; i < row.items.length; i++) {
          const item = row.items[i];
          if (item.iconSprite) {
            members.push({
              graphic: item.iconSprite,
              offset: vec(
                outcomeX,
                y + (row.height - this.outcomeIconSize) / 2
              ),
            });
            outcomeX += this.outcomeIconSize + 6;
          }

          members.push({
            graphic: item.textGraphic,
            offset: vec(
              outcomeX,
              y + (row.height - item.textGraphic.height) / 2
            ),
          });
          outcomeX += item.textGraphic.width;
          if (i < row.items.length - 1) {
            outcomeX += this.outcomeInlineItemGap;
          }
        }

        y += row.height + this.outcomeRowGap;
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

  private buildOutcomeRows(
    outcomes: TooltipOutcome[],
    defaultTextColor: Color
  ): TooltipOutcomeRenderRow[] {
    const rows: TooltipOutcomeRenderRow[] = [];

    let i = 0;
    while (i < outcomes.length) {
      const current = outcomes[i];
      if (current.inline) {
        const inlineGroup: TooltipOutcome[] = [];
        while (i < outcomes.length && outcomes[i].inline) {
          inlineGroup.push(outcomes[i]);
          i++;
        }
        rows.push(this.buildInlineOutcomeRow(inlineGroup, defaultTextColor));
        continue;
      }

      rows.push(this.buildSingleOutcomeRow(current, defaultTextColor));
      i++;
    }

    return rows;
  }

  private buildInlineOutcomeRow(
    outcomes: TooltipOutcome[],
    defaultTextColor: Color
  ): TooltipOutcomeRenderRow {
    const first = outcomes[0];
    const labelGraphic =
      first && first.label
        ? new Text({
            text: `${first.label}:`,
            font: new Font({
              size: this.fontSize,
              unit: FontUnit.Px,
              color: defaultTextColor,
            }),
          })
        : undefined;

    const items: TooltipOutcomeRenderItem[] = outcomes.map((outcome) => {
      const iconSprite = this.getOutcomeIconSprite(outcome.icon);
      const textGraphic = new Text({
        text: `${outcome.value}`,
        font: new Font({
          size: this.fontSize,
          unit: FontUnit.Px,
          color: outcome.color ?? defaultTextColor,
        }),
      });
      const width =
        (iconSprite ? this.outcomeIconSize + 6 : 0) + textGraphic.width;
      return { iconSprite, textGraphic, width };
    });

    const itemsWidth =
      items.reduce((sum, item) => sum + item.width, 0) +
      Math.max(0, items.length - 1) * this.outcomeInlineItemGap;
    const width = (labelGraphic?.width ?? 0) + (labelGraphic ? 8 : 0) + itemsWidth;

    const maxItemHeight = items.reduce(
      (max, item) =>
        Math.max(max, item.textGraphic.height, item.iconSprite ? this.outcomeIconSize : 0),
      0
    );
    const height = Math.max(
      this.outcomeRowHeight,
      labelGraphic?.height ?? 0,
      maxItemHeight
    );

    return { labelGraphic, items, width, height };
  }

  private buildSingleOutcomeRow(
    outcome: TooltipOutcome,
    defaultTextColor: Color
  ): TooltipOutcomeRenderRow {
    const iconSprite = this.getOutcomeIconSprite(outcome.icon);
    const textGraphic = new Text({
      text: outcome.label ? `${outcome.label}: ${outcome.value}` : `${outcome.value}`,
      font: new Font({
        size: this.fontSize,
        unit: FontUnit.Px,
        color: outcome.color ?? defaultTextColor,
      }),
    });
    const width = (iconSprite ? this.outcomeIconSize + 6 : 0) + textGraphic.width;
    const height = Math.max(
      this.outcomeRowHeight,
      textGraphic.height,
      iconSprite ? this.outcomeIconSize : 0
    );

    return {
      items: [{ iconSprite, textGraphic, width }],
      width,
      height,
    };
  }

  private buildContentKey(request: TooltipRequest): string {
    const outcomes = (request.outcomes ?? [])
      .map((outcome) => {
        const iconPath = outcome.icon?.path ?? '';
        const color = outcome.color?.toHex() ?? '';
        return `${outcome.label}:${outcome.value}:${iconPath}:${color}:${
          outcome.inline ? 1 : 0
        }`;
      })
      .join('|');

    const bgColor = request.bgColor?.toHex() ?? '';
    const textColor = request.textColor?.toHex() ?? '';

    return [
      request.header ?? '',
      request.description,
      request.width ?? this.defaultTooltipWidth,
      bgColor,
      textColor,
      outcomes,
    ].join('::');
  }
}
