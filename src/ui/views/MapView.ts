import {
  Actor,
  Canvas,
  Engine,
  Keys,
  PointerButton,
  type Subscription,
  type PointerEvent,
  type WheelEvent,
  vec,
} from 'excalibur';
import type { MapData, MapTileType } from '../../managers/MapManager';
import { UI_Z } from '../constants/ZLayers';

export interface MapViewOptions {
  map: MapData;
  tileSize?: number;
  panSpeed?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  showGrid?: boolean;
}

/**
 * World map renderer with camera pan/zoom controls.
 * Controls:
 * - Mouse wheel: zoom in/out
 * - Right mouse drag: pan
 * - WASD/Arrow keys: pan
 */
export class MapView extends Actor {
  private readonly map: MapData;
  private readonly tileSize: number;
  private readonly panSpeed: number;
  private readonly configuredMinZoom: number;
  private readonly maxZoom: number;
  private readonly zoomStep: number;
  private readonly showGrid: boolean;
  private readonly mapBorderCells = 2;

  private readonly mapWidthPx: number;
  private readonly mapHeightPx: number;
  private readonly mapBorderPx: number;
  private readonly contentWidth: number;
  private readonly contentHeight: number;

  private dragging = false;
  private dragStartScreen = vec(0, 0);
  private dragStartView = vec(0, 0);
  private pointerSubscriptions: Subscription[] = [];
  private contextMenuHandler?: (evt: MouseEvent) => void;
  private viewX = 0;
  private viewY = 0;
  private zoom = 1;

  constructor(options: MapViewOptions) {
    super({ x: 0, y: 0 });
    this.anchor = vec(0, 0);
    this.z = UI_Z.map;

    this.map = options.map;
    this.tileSize = options.tileSize ?? 56;
    this.panSpeed = options.panSpeed ?? 620;
    this.configuredMinZoom = options.minZoom ?? 0.45;
    this.maxZoom = options.maxZoom ?? 2.4;
    this.zoomStep = options.zoomStep ?? 0.12;
    this.showGrid = options.showGrid ?? false;

    this.mapWidthPx = this.map.width * this.tileSize;
    this.mapHeightPx = this.map.height * this.tileSize;
    this.mapBorderPx = this.tileSize * this.mapBorderCells;
    this.contentWidth = this.mapWidthPx + this.mapBorderPx * 2;
    this.contentHeight = this.mapHeightPx + this.mapBorderPx * 2;
  }

  onInitialize(engine: Engine): void {
    // Important: keep map out of object hit-testing so HUD/UI remains clickable.
    this.pointer.useGraphicsBounds = false;
    this.pointer.useColliderShape = false;

    this.graphics.use(
      new Canvas({
        width: this.contentWidth,
        height: this.contentHeight,
        cache: true,
        draw: (ctx) => this.drawMap(ctx),
      })
    );

    this.initializeView(engine);
    this.setupPointerControls();
    this.installContextMenuBlock(engine);
  }

  onPreUpdate(engine: Engine, elapsedMs: number): void {
    this.applyKeyboardPan(engine, elapsedMs);
    this.clampView(engine);
    this.applyViewTransform();
  }

  override onPreKill(): void {
    this.dragging = false;
    for (const sub of this.pointerSubscriptions) {
      sub.close();
    }
    this.pointerSubscriptions = [];
    this.removeContextMenuBlock();
  }

  private drawMap(ctx: CanvasRenderingContext2D): void {
    const offset = this.mapBorderPx;

    this.drawMapFrame(ctx);

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        ctx.fillStyle = this.getTileColor(this.map.tiles[y][x]);
        ctx.fillRect(
          offset + x * this.tileSize,
          offset + y * this.tileSize,
          this.tileSize,
          this.tileSize
        );
      }
    }

    if (this.showGrid) {
      // Optional subtle grid lines to keep tile readability at medium/high zoom.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;
      for (let y = 0; y <= this.map.height; y++) {
        const py = offset + y * this.tileSize + 0.5;
        ctx.beginPath();
        ctx.moveTo(offset, py);
        ctx.lineTo(offset + this.mapWidthPx, py);
        ctx.stroke();
      }
      for (let x = 0; x <= this.map.width; x++) {
        const px = offset + x * this.tileSize + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, offset);
        ctx.lineTo(px, offset + this.mapHeightPx);
        ctx.stroke();
      }
    }

    this.drawPlayerStateBorder(ctx);
  }

  private drawMapFrame(ctx: CanvasRenderingContext2D): void {
    const frameFill = 'rgba(14, 21, 31, 0.48)';
    const frameLine = 'rgba(178, 197, 216, 0.42)';
    const borderPx = this.mapBorderPx;

    // Frame bands outside the actual map area.
    ctx.fillStyle = frameFill;
    ctx.fillRect(0, 0, this.contentWidth, borderPx);
    ctx.fillRect(
      0,
      this.contentHeight - borderPx,
      this.contentWidth,
      borderPx
    );
    ctx.fillRect(0, borderPx, borderPx, this.mapHeightPx);
    ctx.fillRect(
      this.contentWidth - borderPx,
      borderPx,
      borderPx,
      this.mapHeightPx
    );

    ctx.strokeStyle = frameLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      borderPx + 0.5,
      borderPx + 0.5,
      this.mapWidthPx - 1,
      this.mapHeightPx - 1
    );
  }

  private drawPlayerStateBorder(ctx: CanvasRenderingContext2D): void {
    const playerZoneId = this.map.playerZoneId;
    if (playerZoneId === null) {
      return;
    }

    const baseBorderWidth = Math.max(2, Math.floor(this.tileSize * 0.08));
    // Keep border visually stable when zoomed out: guarantee minimum on-screen thickness.
    const minScreenBorderPx = 1.8;
    const zoomSafeWidth = Math.ceil(
      minScreenBorderPx / Math.max(this.zoom, 0.0001)
    );
    const borderWidth = Math.max(baseBorderWidth, zoomSafeWidth);
    const zones = this.map.zones;
    const offset = this.mapBorderPx;

    ctx.fillStyle = '#ff3b3b';
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (zones[y][x] !== playerZoneId) {
          continue;
        }

        const left = offset + x * this.tileSize;
        const top = offset + y * this.tileSize;
        const right = left + this.tileSize;
        const bottom = top + this.tileSize;

        const topNeighbor = y > 0 ? zones[y - 1][x] : null;
        const rightNeighbor = x < this.map.width - 1 ? zones[y][x + 1] : null;
        const bottomNeighbor = y < this.map.height - 1 ? zones[y + 1][x] : null;
        const leftNeighbor = x > 0 ? zones[y][x - 1] : null;

        if (topNeighbor !== playerZoneId) {
          ctx.fillRect(left, top, this.tileSize, borderWidth);
        }
        if (rightNeighbor !== playerZoneId) {
          ctx.fillRect(right - borderWidth, top, borderWidth, this.tileSize);
        }
        if (bottomNeighbor !== playerZoneId) {
          ctx.fillRect(left, bottom - borderWidth, this.tileSize, borderWidth);
        }
        if (leftNeighbor !== playerZoneId) {
          ctx.fillRect(left, top, borderWidth, this.tileSize);
        }
      }
    }
  }

  private initializeView(engine: Engine): void {
    const fitZoom = this.getFitZoom(engine);
    const minZoom = this.getEffectiveMinZoom(engine);
    this.zoom = this.clamp(fitZoom * 0.96, minZoom, this.maxZoom);

    this.viewX = (engine.drawWidth - this.contentWidth * this.zoom) / 2;
    this.viewY = (engine.drawHeight - this.contentHeight * this.zoom) / 2;
    this.clampView(engine);
    this.applyViewTransform();
  }

  private setupPointerControls(): void {
    const pointers = this.scene?.input.pointers;
    if (!pointers) {
      return;
    }

    this.pointerSubscriptions.push(
      pointers.on('down', (evt: PointerEvent) => {
      if (
        evt.button !== PointerButton.Right &&
        evt.button !== PointerButton.Middle
      ) {
        return;
      }

      this.dragging = true;
      this.dragStartScreen = vec(evt.screenPos.x, evt.screenPos.y);
      this.dragStartView = vec(this.viewX, this.viewY);
      const nativeEvt = evt.nativeEvent as MouseEvent | undefined;
      nativeEvt?.preventDefault?.();
      })
    );

    this.pointerSubscriptions.push(
      pointers.on('move', (evt: PointerEvent) => {
      if (!this.dragging) {
        return;
      }

      const dx = evt.screenPos.x - this.dragStartScreen.x;
      const dy = evt.screenPos.y - this.dragStartScreen.y;
      this.viewX = this.dragStartView.x + dx;
      this.viewY = this.dragStartView.y + dy;
      })
    );

    this.pointerSubscriptions.push(
      pointers.on('up', (evt: PointerEvent) => {
      if (
        evt.button === PointerButton.Right ||
        evt.button === PointerButton.Middle
      ) {
        this.dragging = false;
      }
      })
    );

    this.pointerSubscriptions.push(
      pointers.on('wheel', (evt: WheelEvent) => {
      const engine = this.scene?.engine;
      if (!engine) {
        return;
      }

      const direction = Math.sign(evt.deltaY);
      if (direction === 0) {
        return;
      }

      const prevZoom = this.zoom;
      const factor = direction > 0 ? 1 - this.zoomStep : 1 + this.zoomStep;
      const minZoom = this.getEffectiveMinZoom(engine);
      const nextZoom = this.clamp(this.zoom * factor, minZoom, this.maxZoom);
      if (nextZoom === prevZoom) {
        return;
      }

      // Keep the world point under cursor stable during zoom.
      const cursorX = evt.screenX;
      const cursorY = evt.screenY;
      const worldX = (cursorX - this.viewX) / prevZoom;
      const worldY = (cursorY - this.viewY) / prevZoom;

      this.zoom = nextZoom;
      this.viewX = cursorX - worldX * this.zoom;
      this.viewY = cursorY - worldY * this.zoom;
      this.clampView(engine);
      this.applyViewTransform();
      })
    );
  }

  private applyKeyboardPan(engine: Engine, elapsedMs: number): void {
    let dx = 0;
    let dy = 0;
    const keyboard = engine.input.keyboard;

    if (keyboard.isHeld(Keys.Left) || keyboard.isHeld(Keys.A)) dx -= 1;
    if (keyboard.isHeld(Keys.Right) || keyboard.isHeld(Keys.D)) dx += 1;
    if (keyboard.isHeld(Keys.Up) || keyboard.isHeld(Keys.W)) dy -= 1;
    if (keyboard.isHeld(Keys.Down) || keyboard.isHeld(Keys.S)) dy += 1;

    if (dx === 0 && dy === 0) {
      return;
    }

    const length = Math.hypot(dx, dy);
    const dt = elapsedMs / 1000;
    const speed = this.panSpeed * dt;

    // Invert map transform movement so key direction matches world pan direction.
    this.viewX -= (dx / length) * speed;
    this.viewY -= (dy / length) * speed;
  }

  private clampView(engine: Engine): void {
    const scaledW = this.contentWidth * this.zoom;
    const scaledH = this.contentHeight * this.zoom;

    if (scaledW <= engine.drawWidth) {
      // Map fits horizontally: keep it draggable within viewport bounds.
      this.viewX = this.clamp(this.viewX, 0, engine.drawWidth - scaledW);
    } else {
      const minX = engine.drawWidth - scaledW;
      const maxX = 0;
      this.viewX = this.clamp(this.viewX, minX, maxX);
    }

    if (scaledH <= engine.drawHeight) {
      // Map fits vertically: keep it draggable within viewport bounds.
      this.viewY = this.clamp(this.viewY, 0, engine.drawHeight - scaledH);
    } else {
      const minY = engine.drawHeight - scaledH;
      const maxY = 0;
      this.viewY = this.clamp(this.viewY, minY, maxY);
    }
  }

  private applyViewTransform(): void {
    this.pos = vec(this.viewX, this.viewY);
    this.scale = vec(this.zoom, this.zoom);
  }

  private getTileColor(type: MapTileType): string {
    if (type === 'plains') return '#9bd47f';
    if (type === 'forest') return '#2f7d32';
    if (type === 'rocks') return '#8b8f94';
    if (type === 'sand') return '#e5d178';
    if (type === 'river') return '#89d5ff';
    return '#2f6fc9';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private getFitZoom(engine: Engine): number {
    return Math.min(
      engine.drawWidth / this.contentWidth,
      engine.drawHeight / this.contentHeight
    );
  }

  private getEffectiveMinZoom(engine: Engine): number {
    // Never block zooming out to full-map fit on large maps.
    return Math.min(this.configuredMinZoom, this.getFitZoom(engine));
  }

  private installContextMenuBlock(engine: Engine): void {
    if (this.contextMenuHandler) {
      return;
    }

    this.contextMenuHandler = (evt: MouseEvent) => {
      evt.preventDefault();
    };
    engine.canvas.addEventListener('contextmenu', this.contextMenuHandler);
  }

  private removeContextMenuBlock(): void {
    const canvas = this.scene?.engine.canvas;
    if (!canvas || !this.contextMenuHandler) {
      this.contextMenuHandler = undefined;
      return;
    }

    canvas.removeEventListener('contextmenu', this.contextMenuHandler);
    this.contextMenuHandler = undefined;
  }
}
