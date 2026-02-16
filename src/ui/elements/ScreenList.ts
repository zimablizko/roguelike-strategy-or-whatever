import type { PointerEvent, WheelEvent } from 'excalibur';
import { Canvas, Color, ScreenElement, vec } from 'excalibur';
import type {
  ScreenListButtonItem,
  ScreenListOptions,
  ScreenListRenderItem,
} from '../../_common/models/ui.models';

/**
 * Generic scrollable vertical list for UI.
 *
 * WebGL note: clipping child Actors is fragile because Excalibur batches draw calls.
 * This list draws into an offscreen 2D canvas (Canvas graphic) and renders as one texture,
 * so clipping is deterministic even under WebGL.
 */
export class ScreenList<TItem = unknown> extends ScreenElement {
  private viewportWidth: number;
  private viewportHeight: number;
  private padding: number;
  private gap: number;
  private itemHeight: number;
  private bgColor: Color;
  private textColor: string;
  private fontCss: string;
  private scrollStep: number;
  private transparent: boolean;
  private renderItem?: ScreenListRenderItem<TItem>;

  private items: TItem[] = [];
  private scrollOffset: number = 0;
  private contentHeight: number = 0;

  private canvasGraphic?: Canvas;

  private hoveredIndex: number | null = null;
  private pressedIndex: number | null = null;
  private onItemActivate?: (item: TItem, index: number) => void;
  private getItemLabel?: (item: TItem, index: number) => string;
  private isItemDisabled?: (item: TItem, index: number) => boolean;
  private isItemSelected?: (item: TItem, index: number) => boolean;

  private showScrollbar: boolean;
  private scrollbarWidth: number;
  private scrollbarMinThumbHeight: number;
  private scrollbarTrackColor: string;
  private scrollbarThumbColor: string;
  private scrollbarThumbActiveColor: string;
  private isDraggingScrollbar: boolean = false;
  private scrollbarDragOffsetY: number = 0;
  private isScrollbarHovered: boolean = false;

  constructor(options: ScreenListOptions<TItem>) {
    super({ x: options.x, y: options.y });

    this.anchor = vec(0, 0);

    this.viewportWidth = options.width;
    this.viewportHeight = options.height;
    this.padding = options.padding ?? 10;
    this.gap = options.gap ?? 8;
    this.itemHeight = options.itemHeight ?? 40;
    this.bgColor = options.bgColor ?? Color.fromHex('#1a252f');
    this.textColor = options.textColor ?? '#ffffff';
    this.fontCss = options.fontCss ?? '14px sans-serif';
    this.scrollStep = options.scrollStep ?? 40;
    this.transparent = options.transparent ?? false;
    this.renderItem = options.renderItem;

    this.onItemActivate = options.onItemActivate;
    this.getItemLabel = options.getItemLabel;
    this.isItemDisabled = options.isItemDisabled;
    this.isItemSelected = options.isItemSelected;

    this.showScrollbar = options.showScrollbar ?? true;
    this.scrollbarWidth = options.scrollbarWidth ?? 10;
    this.scrollbarMinThumbHeight = options.scrollbarMinThumbHeight ?? 18;
    this.scrollbarTrackColor =
      options.scrollbarTrackColor ?? 'rgba(255,255,255,0.10)';
    this.scrollbarThumbColor =
      options.scrollbarThumbColor ?? 'rgba(255,255,255,0.22)';
    this.scrollbarThumbActiveColor =
      options.scrollbarThumbActiveColor ?? 'rgba(255,255,255,0.35)';

    this.setItems(options.items);
  }

  onInitialize(): void {
    this.pointer.useGraphicsBounds = true;
    this.pointer.useColliderShape = false;

    this.canvasGraphic = new Canvas({
      width: this.viewportWidth,
      height: this.viewportHeight,
      cache: false,
      draw: (ctx) => this.drawList(ctx),
    });

    this.graphics.use(this.canvasGraphic);
    this.flagRedraw();

    this.on('pointerwheel', (ev: WheelEvent) => {
      const direction = Math.sign(ev.deltaY);
      if (direction !== 0) {
        this.applyScroll(direction * this.scrollStep);
        ev.cancel();
      }
    });

    // Pointer interaction for "button-like" list rows + scrollbar
    this.on('pointermove', (ev: PointerEvent) => {
      if (this.isDraggingScrollbar) {
        this.updateScrollFromScrollbarDrag(ev);
        return;
      }

      const hoverScrollbar = this.hitTestScrollbar(ev) !== null;
      const nextHoveredIndex = hoverScrollbar ? null : this.hitTestIndex(ev);

      const changed =
        hoverScrollbar !== this.isScrollbarHovered ||
        nextHoveredIndex !== this.hoveredIndex;

      this.isScrollbarHovered = hoverScrollbar;
      this.hoveredIndex = nextHoveredIndex;

      if (changed) this.flagRedraw();
    });

    this.on('pointerleave', () => {
      if (
        this.hoveredIndex !== null ||
        this.pressedIndex !== null ||
        this.isDraggingScrollbar ||
        this.isScrollbarHovered
      ) {
        this.hoveredIndex = null;
        this.pressedIndex = null;
        this.isDraggingScrollbar = false;
        this.isScrollbarHovered = false;
        this.flagRedraw();
      }
    });

    this.on('pointerdown', (ev: PointerEvent) => {
      // Scrollbar gets first priority
      if (this.handleScrollbarPointerDown(ev)) {
        ev.cancel();
        return;
      }

      const index = this.hitTestIndex(ev);
      if (index === null) return;
      if (this.isDisabled(index)) return;

      const canActivate = this.canActivateItem(index);
      if (!canActivate) return;

      this.pressedIndex = index;
      this.flagRedraw();
    });

    this.on('pointerup', (ev: PointerEvent) => {
      if (this.isDraggingScrollbar) {
        this.isDraggingScrollbar = false;
        this.flagRedraw();
        return;
      }

      const index = this.hitTestIndex(ev);
      const pressed = this.pressedIndex;
      this.pressedIndex = null;

      if (pressed === null) {
        this.flagRedraw();
        return;
      }

      // Only activate if released on same item
      if (index !== pressed) {
        this.flagRedraw();
        return;
      }

      if (this.isDisabled(pressed)) {
        this.flagRedraw();
        return;
      }

      this.activateItem(pressed);
      this.flagRedraw();
    });
  }

  private canActivateItem(index: number): boolean {
    if (this.onItemActivate) return true;
    const item = this.items[index] as unknown;
    return (
      typeof (item as Partial<ScreenListButtonItem>)?.onClick === 'function'
    );
  }

  private activateItem(index: number): void {
    const item = this.items[index];
    if (this.onItemActivate) {
      this.onItemActivate(item, index);
      return;
    }

    const maybeButton = item as unknown as Partial<ScreenListButtonItem>;
    maybeButton.onClick?.();
  }

  private isDisabled(index: number): boolean {
    const item = this.items[index] as unknown;
    if (this.isItemDisabled)
      return this.isItemDisabled(this.items[index], index);
    return (item as Partial<ScreenListButtonItem>)?.disabled === true;
  }

  private isSelected(index: number): boolean {
    if (!this.isItemSelected) {
      return false;
    }
    return this.isItemSelected(this.items[index], index);
  }

  private hitTestIndex(ev: PointerEvent): number | null {
    // ScreenElement pointer events are delivered in screen coordinates
    const localX = ev.screenPos.x - this.globalPos.x;
    const localY = ev.screenPos.y - this.globalPos.y;

    const innerX = this.padding;
    const innerY = this.padding;
    const innerW = this.getInnerWidth();
    const innerH = this.getInnerHeight();

    const scrollbar = this.getScrollbarGeometry();
    const contentW = scrollbar ? innerW - (scrollbar.trackW + 4) : innerW;

    if (
      localX < innerX ||
      localX > innerX + contentW ||
      localY < innerY ||
      localY > innerY + innerH
    ) {
      return null;
    }

    const rowSpan = this.itemHeight + this.gap;
    const yInContent = localY - innerY + this.scrollOffset;
    const index = Math.floor(yInContent / rowSpan);
    if (index < 0 || index >= this.items.length) return null;

    const withinRow = yInContent - index * rowSpan;
    if (withinRow > this.itemHeight) return null; // in the gap area

    return index;
  }

  private isOverflowing(): boolean {
    return this.getMaxScroll() > 0;
  }

  private getScrollbarGeometry(): {
    trackX: number;
    trackY: number;
    trackW: number;
    trackH: number;
    thumbX: number;
    thumbY: number;
    thumbW: number;
    thumbH: number;
  } | null {
    if (!this.showScrollbar) return null;
    if (!this.isOverflowing()) return null;

    const innerX = this.padding;
    const innerY = this.padding;
    const innerW = this.getInnerWidth();
    const innerH = this.getInnerHeight();

    const trackW = this.scrollbarWidth;
    const trackH = innerH;
    const trackX = innerX + innerW - trackW;
    const trackY = innerY;

    const maxScroll = this.getMaxScroll();
    const ratio = innerH / Math.max(innerH, this.contentHeight);
    const thumbH = Math.max(
      this.scrollbarMinThumbHeight,
      Math.floor(trackH * ratio)
    );
    const travel = Math.max(1, trackH - thumbH);
    const t = maxScroll > 0 ? this.scrollOffset / maxScroll : 0;
    const thumbY = trackY + t * travel;

    return {
      trackX,
      trackY,
      trackW,
      trackH,
      thumbX: trackX,
      thumbY,
      thumbW: trackW,
      thumbH,
    };
  }

  private hitTestScrollbar(ev: PointerEvent): { overThumb: boolean } | null {
    const geo = this.getScrollbarGeometry();
    if (!geo) return null;

    const localX = ev.screenPos.x - this.globalPos.x;
    const localY = ev.screenPos.y - this.globalPos.y;

    const withinTrack =
      localX >= geo.trackX &&
      localX <= geo.trackX + geo.trackW &&
      localY >= geo.trackY &&
      localY <= geo.trackY + geo.trackH;

    if (!withinTrack) return null;

    const overThumb = localY >= geo.thumbY && localY <= geo.thumbY + geo.thumbH;

    return { overThumb };
  }

  private handleScrollbarPointerDown(ev: PointerEvent): boolean {
    const hit = this.hitTestScrollbar(ev);
    if (!hit) return false;

    const geo = this.getScrollbarGeometry();
    if (!geo) return false;

    const localY = ev.screenPos.y - this.globalPos.y;
    const maxScroll = this.getMaxScroll();
    if (maxScroll <= 0) return true;

    if (hit.overThumb) {
      this.isDraggingScrollbar = true;
      this.scrollbarDragOffsetY = localY - geo.thumbY;
      this.pressedIndex = null;
      this.hoveredIndex = null;
      this.flagRedraw();
      return true;
    }

    // Click on track jumps (thumb centers on click)
    this.isDraggingScrollbar = true;
    this.scrollbarDragOffsetY = geo.thumbH / 2;
    this.updateScrollFromScrollbarDrag(ev);
    this.pressedIndex = null;
    this.hoveredIndex = null;
    this.flagRedraw();
    return true;
  }

  private updateScrollFromScrollbarDrag(ev: PointerEvent): void {
    const geo = this.getScrollbarGeometry();
    if (!geo) return;

    const localY = ev.screenPos.y - this.globalPos.y;
    const maxScroll = this.getMaxScroll();
    if (maxScroll <= 0) return;

    const travel = Math.max(1, geo.trackH - geo.thumbH);
    const unclampedThumbY = localY - this.scrollbarDragOffsetY;
    const thumbY = Math.max(
      geo.trackY,
      Math.min(geo.trackY + travel, unclampedThumbY)
    );

    const t = (thumbY - geo.trackY) / travel;
    const nextScroll = t * maxScroll;

    if (nextScroll !== this.scrollOffset) {
      this.scrollOffset = nextScroll;
      this.clampScroll();
      this.flagRedraw();
    }
  }

  setItems(items: TItem[]): void {
    this.items = items;
    this.recalculateContentHeight();
    this.clampScroll();
    this.flagRedraw();
  }

  scrollToTop(): void {
    this.scrollOffset = 0;
    this.flagRedraw();
  }

  scrollToBottom(): void {
    this.scrollOffset = this.getMaxScroll();
    this.flagRedraw();
  }

  private applyScroll(delta: number): void {
    if (this.contentHeight <= this.getInnerHeight()) {
      this.scrollOffset = 0;
      this.flagRedraw();
      return;
    }

    this.scrollOffset += delta;
    this.clampScroll();
    this.flagRedraw();
  }

  private clampScroll(): void {
    const maxScroll = this.getMaxScroll();
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset));
  }

  private getInnerHeight(): number {
    return this.viewportHeight - this.padding * 2;
  }

  private getInnerWidth(): number {
    return this.viewportWidth - this.padding * 2;
  }

  private getMaxScroll(): number {
    return Math.max(0, this.contentHeight - this.getInnerHeight());
  }

  private recalculateContentHeight(): void {
    const count = this.items.length;
    this.contentHeight =
      count === 0 ? 0 : count * this.itemHeight + (count - 1) * this.gap;
  }

  private flagRedraw(): void {
    this.canvasGraphic?.flagDirty();
  }

  private getLabel(item: TItem, index: number): string {
    if (this.getItemLabel) return this.getItemLabel(item, index);

    const anyItem = item as any;
    if (typeof anyItem?.title === 'string') return anyItem.title;
    if (typeof anyItem?.text === 'string') return anyItem.text;
    if (typeof anyItem?.name === 'string' && anyItem.name) return anyItem.name;
    return `Item #${index + 1}`;
  }

  private drawList(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    if (!this.transparent) {
      const c = this.bgColor;
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
      ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    }

    const innerX = this.padding;
    const innerY = this.padding;
    const innerW = this.getInnerWidth();
    const innerH = this.getInnerHeight();

    const scrollbar = this.getScrollbarGeometry();
    const contentW = scrollbar ? innerW - (scrollbar.trackW + 4) : innerW;

    ctx.save();
    ctx.beginPath();
    ctx.rect(innerX, innerY, contentW, innerH);
    ctx.clip();

    const rowSpan = this.itemHeight + this.gap;
    const startIndex = Math.max(0, Math.floor(this.scrollOffset / rowSpan) - 1);
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollOffset + innerH) / rowSpan) + 1
    );

    for (let index = startIndex; index < endIndex; index++) {
      const item = this.items[index];
      const y = innerY + index * rowSpan - this.scrollOffset;

      if (this.renderItem) {
        this.renderItem({
          ctx,
          item,
          index,
          x: innerX,
          y,
          width: contentW,
          height: this.itemHeight,
        });
        continue;
      }

      const disabled = this.isDisabled(index);
      const selected = this.isSelected(index);
      const hovered = this.hoveredIndex === index;
      const pressed = this.pressedIndex === index;
      const interactive = !disabled && this.canActivateItem(index);

      // Default button-like row background when interactive (or when hovered/pressed)
      if (interactive || hovered || pressed || selected) {
        const bg = disabled
          ? 'rgba(120, 120, 120, 0.35)'
          : pressed
            ? 'rgba(40, 90, 140, 0.55)'
            : hovered
              ? 'rgba(60, 140, 210, 0.45)'
              : selected
                ? 'rgba(76, 132, 196, 0.45)'
                : 'rgba(60, 80, 100, 0.25)';
        ctx.fillStyle = bg;
        ctx.fillRect(innerX, y, contentW, this.itemHeight);
      }

      const label = this.getLabel(item, index);
      ctx.fillStyle = disabled ? 'rgba(200, 200, 200, 0.65)' : this.textColor;
      ctx.font = this.fontCss;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, innerX + 10, y + this.itemHeight / 2);
    }

    ctx.restore();

    // Scrollbar (draw outside the clip)
    if (scrollbar) {
      ctx.save();
      ctx.fillStyle = this.scrollbarTrackColor;
      ctx.fillRect(
        scrollbar.trackX,
        scrollbar.trackY,
        scrollbar.trackW,
        scrollbar.trackH
      );

      const thumbColor =
        this.isDraggingScrollbar || this.isScrollbarHovered
          ? this.scrollbarThumbActiveColor
          : this.scrollbarThumbColor;
      ctx.fillStyle = thumbColor;
      ctx.fillRect(
        scrollbar.thumbX,
        scrollbar.thumbY,
        scrollbar.thumbW,
        scrollbar.thumbH
      );
      ctx.restore();
    }
  }
}
