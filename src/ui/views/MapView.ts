import {
  Actor,
  Canvas,
  Engine,
  GraphicsGroup,
  Keys,
  PointerButton,
  type Subscription,
  type PointerEvent,
  type WheelEvent,
  vec,
} from 'excalibur';
import type { MapData, MapTileType } from '../../_common/models/map.models';
import type {
  MapBuildPlacementOverlay,
  MapBuildingOverlay,
  MapViewOptions,
} from '../../_common/models/ui.models';
import { MAP_VIEW_DEFAULTS } from '../constants/MapViewConstants';
import { UI_Z } from '../constants/ZLayers';
import { TooltipProvider } from '../tooltip/TooltipProvider';

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
  private readonly initialPlayerStateCoverage: number;
  private readonly mapBorderCells = MAP_VIEW_DEFAULTS.mapBorderCells;
  private readonly buildingsProvider?: () => ReadonlyArray<MapBuildingOverlay>;
  private readonly buildingsVersionProvider?: () => number;
  private readonly buildPlacementProvider?: () => MapBuildPlacementOverlay | undefined;
  private readonly buildPlacementVersionProvider?: () => number;
  private readonly onBuildPlacementConfirm?: (tileX: number, tileY: number) => void;
  private readonly onBuildPlacementCancel?: () => void;
  private readonly onBuildingSelected?: (instanceId: string | undefined) => void;
  private readonly shouldIgnoreLeftClick?: (screenX: number, screenY: number) => boolean;
  private readonly isInputBlocked?: () => boolean;
  private readonly tooltipProvider?: TooltipProvider;

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
  private renderedBuildingsVersion = -1;
  private renderedPlayerZoneTileCount = -1;
  private renderedBuildPlacementVersion = -1;
  private hoveredBuildingInstanceId?: string;
  private selectedBuildingInstanceId?: string;
  private buildPlacementPreviewTile?: { x: number; y: number };
  private buildPlacementPreviewValid = false;

  constructor(options: MapViewOptions) {
    super({ x: 0, y: 0 });
    this.anchor = vec(0, 0);
    this.z = UI_Z.map;

    this.map = options.map;
    this.tileSize = options.tileSize ?? MAP_VIEW_DEFAULTS.tileSize;
    this.panSpeed = options.panSpeed ?? MAP_VIEW_DEFAULTS.panSpeed;
    this.configuredMinZoom = options.minZoom ?? MAP_VIEW_DEFAULTS.minZoom;
    this.maxZoom = options.maxZoom ?? MAP_VIEW_DEFAULTS.maxZoom;
    this.zoomStep = options.zoomStep ?? MAP_VIEW_DEFAULTS.zoomStep;
    this.showGrid = options.showGrid ?? false;
    this.initialPlayerStateCoverage = this.clamp(
      options.initialPlayerStateCoverage ??
        MAP_VIEW_DEFAULTS.initialPlayerStateCoverage,
      MAP_VIEW_DEFAULTS.minPlayerStateCoverage,
      MAP_VIEW_DEFAULTS.maxPlayerStateCoverage
    );
    this.buildingsProvider = options.buildingsProvider;
    this.buildingsVersionProvider = options.buildingsVersionProvider;
    this.buildPlacementProvider = options.buildPlacementProvider;
    this.buildPlacementVersionProvider = options.buildPlacementVersionProvider;
    this.onBuildPlacementConfirm = options.onBuildPlacementConfirm;
    this.onBuildPlacementCancel = options.onBuildPlacementCancel;
    this.onBuildingSelected = options.onBuildingSelected;
    this.shouldIgnoreLeftClick = options.shouldIgnoreLeftClick;
    this.isInputBlocked = options.isInputBlocked;
    this.tooltipProvider = options.tooltipProvider;

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

    this.rebuildCachedMapCanvas();

    this.initializeView(engine);
    this.setupPointerControls();
    this.installContextMenuBlock(engine);
  }

  onPreUpdate(engine: Engine, elapsedMs: number): void {
    this.updateBuildPlacementPreview(engine);
    this.refreshMapCanvasIfNeeded();
    this.applyKeyboardPan(engine, elapsedMs);
    this.clampView(engine);
    this.applyViewTransform();
    this.updateBuildingTooltip(engine);
  }

  override onPreKill(): void {
    this.dragging = false;
    for (const sub of this.pointerSubscriptions) {
      sub.close();
    }
    this.pointerSubscriptions = [];
    this.removeContextMenuBlock();
    this.clearBuildingTooltip();
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
    this.drawBuildPlacementOverlay(ctx);
    this.drawBuildings(ctx);
  }

  private drawBuildPlacementOverlay(ctx: CanvasRenderingContext2D): void {
    const placement = this.buildPlacementProvider?.();
    if (!placement || placement.validTopLeftCells.size === 0) {
      return;
    }

    const offset = this.mapBorderPx;
    const strokeWidth = Math.max(1, Math.floor(this.tileSize * 0.02));

    // Warm yellow improves contrast against forest/river tiles.
    ctx.fillStyle = 'rgba(255, 214, 76, 0.28)';
    ctx.strokeStyle = 'rgba(255, 239, 153, 0.35)';
    ctx.lineWidth = strokeWidth;

    // Paint each tile once (union of all valid placements) to avoid darker
    // overlap in the center of large available zones.
    const coveredCells = new Set<number>();
    for (const key of placement.validTopLeftCells) {
      const tileX = key % this.map.width;
      const tileY = (key - tileX) / this.map.width;
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
        continue;
      }

      for (let dy = 0; dy < placement.height; dy++) {
        for (let dx = 0; dx < placement.width; dx++) {
          const x = tileX + dx;
          const y = tileY + dy;
          if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) {
            continue;
          }
          coveredCells.add(y * this.map.width + x);
        }
      }
    }

    for (const cellKey of coveredCells) {
      const tileX = cellKey % this.map.width;
      const tileY = (cellKey - tileX) / this.map.width;
      const left = offset + tileX * this.tileSize;
      const top = offset + tileY * this.tileSize;
      ctx.fillRect(left, top, this.tileSize, this.tileSize);
      ctx.strokeRect(
        left + strokeWidth / 2,
        top + strokeWidth / 2,
        Math.max(0, this.tileSize - strokeWidth),
        Math.max(0, this.tileSize - strokeWidth)
      );
    }
  }

  private drawBuildPlacementPreview(ctx: CanvasRenderingContext2D): void {
    const placement = this.buildPlacementProvider?.();
    const preview = this.buildPlacementPreviewTile;
    if (!placement || !preview) {
      return;
    }

    const offset = this.mapBorderPx;
    const left = offset + preview.x * this.tileSize;
    const top = offset + preview.y * this.tileSize;
    const widthPx = placement.width * this.tileSize;
    const heightPx = placement.height * this.tileSize;
    const strokeWidth = Math.max(2, Math.floor(this.tileSize * 0.05));

    const fillColor = this.buildPlacementPreviewValid
      ? 'rgba(120, 233, 144, 0.45)'
      : 'rgba(233, 96, 86, 0.42)';
    const strokeColor = this.buildPlacementPreviewValid
      ? 'rgba(208, 255, 219, 1)'
      : 'rgba(255, 214, 208, 1)';

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.fillRect(left, top, widthPx, heightPx);
    ctx.strokeRect(
      left + strokeWidth / 2,
      top + strokeWidth / 2,
      Math.max(0, widthPx - strokeWidth),
      Math.max(0, heightPx - strokeWidth)
    );
  }

  private drawBuildings(ctx: CanvasRenderingContext2D): void {
    const overlays = this.buildingsProvider?.() ?? [];
    if (overlays.length === 0) {
      return;
    }

    const offset = this.mapBorderPx;
    const borderWidth = Math.max(2, Math.floor(this.tileSize * 0.06));
    // Map starts zoomed out heavily on large worlds, so labels need a much larger
    // base size to remain readable on screen.
    const labelFontSize = Math.max(28, Math.floor(this.tileSize * 1.1));
    const minLabelFontSize = Math.max(14, Math.floor(this.tileSize * 0.42));
    const labelPaddingX = 12;

    ctx.font = `700 ${labelFontSize}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const overlay of overlays) {
      const left = offset + overlay.x * this.tileSize;
      const top = offset + overlay.y * this.tileSize;
      const width = overlay.width * this.tileSize;
      const height = overlay.height * this.tileSize;

      const selected = overlay.instanceId === this.selectedBuildingInstanceId;
      ctx.strokeStyle = selected ? 'rgba(245, 196, 15, 0.98)' : 'rgba(34, 35, 37, 0.96)';
      ctx.lineWidth = selected ? borderWidth + 2 : borderWidth;
      ctx.strokeRect(
        left + ctx.lineWidth / 2,
        top + ctx.lineWidth / 2,
        Math.max(0, width - ctx.lineWidth),
        Math.max(0, height - ctx.lineWidth)
      );

      const label = overlay.shortName.trim().slice(0, 3);
      ctx.font = `700 ${labelFontSize}px "Trebuchet MS", sans-serif`;
      const maxLabelWidth = this.tileSize * 2 - 12;
      const labelWidth = Math.min(
        maxLabelWidth,
        Math.max(this.tileSize * 1.5, ctx.measureText(label).width + labelPaddingX * 2)
      );
      const textMaxWidth = Math.max(1, labelWidth - labelPaddingX * 2);
      let fittedFontSize = labelFontSize;
      while (
        fittedFontSize > minLabelFontSize &&
        ctx.measureText(label).width > textMaxWidth
      ) {
        fittedFontSize -= 1;
        ctx.font = `700 ${fittedFontSize}px "Trebuchet MS", sans-serif`;
      }

      const labelHeight = fittedFontSize + 16;
      const centerX = left + width / 2;
      const centerY = top + height / 2;

      ctx.fillStyle = 'rgba(12, 16, 22, 0.84)';
      ctx.fillRect(
        centerX - labelWidth / 2,
        centerY - labelHeight / 2,
        labelWidth,
        labelHeight
      );

      ctx.fillStyle = '#f5efe2';
      ctx.fillText(label, centerX, centerY + 1);
    }
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

    const playerStateView = this.getPlayerStateView(
      engine,
      this.initialPlayerStateCoverage,
      fitZoom
    );
    if (playerStateView) {
      this.zoom = this.clamp(playerStateView.zoom, minZoom, this.maxZoom);
      this.viewX = playerStateView.viewX;
      this.viewY = playerStateView.viewY;
    } else {
      this.zoom = this.clamp(fitZoom * 0.96, minZoom, this.maxZoom);
      this.viewX = (engine.drawWidth - this.contentWidth * this.zoom) / 2;
      this.viewY = (engine.drawHeight - this.contentHeight * this.zoom) / 2;
    }

    this.clampView(engine);
    this.applyViewTransform();
  }

  focusOnPlayerState(coverage?: number): boolean {
    const engine = this.scene?.engine;
    if (!engine) {
      return false;
    }

    const fitZoom = this.getFitZoom(engine);
    const requestedCoverage =
      coverage === undefined
        ? this.initialPlayerStateCoverage
        : this.clamp(
            coverage,
            MAP_VIEW_DEFAULTS.minPlayerStateCoverage,
            MAP_VIEW_DEFAULTS.maxPlayerStateCoverage
          );
    const playerStateView = this.getPlayerStateView(
      engine,
      requestedCoverage,
      fitZoom
    );
    if (!playerStateView) {
      return false;
    }

    const minZoom = this.getEffectiveMinZoom(engine);
    this.zoom = this.clamp(playerStateView.zoom, minZoom, this.maxZoom);
    this.viewX = playerStateView.viewX;
    this.viewY = playerStateView.viewY;
    this.clampView(engine);
    this.applyViewTransform();
    return true;
  }

  private refreshMapCanvasIfNeeded(): void {
    const nextBuildingsVersion = this.buildingsVersionProvider?.();
    const nextPlayerZoneTileCount = this.countPlayerZoneTiles();
    const nextBuildPlacementVersion = this.buildPlacementVersionProvider?.() ?? 0;
    const buildingsChanged =
      nextBuildingsVersion !== undefined &&
      nextBuildingsVersion !== this.renderedBuildingsVersion;
    const zoneChanged = nextPlayerZoneTileCount !== this.renderedPlayerZoneTileCount;
    const buildPlacementChanged =
      nextBuildPlacementVersion !== this.renderedBuildPlacementVersion;

    if (
      !buildingsChanged &&
      !zoneChanged &&
      !buildPlacementChanged
    ) {
      return;
    }

    this.rebuildCachedMapCanvas();
  }

  private rebuildCachedMapCanvas(): void {
    const staticLayer = new Canvas({
      width: this.contentWidth,
      height: this.contentHeight,
      cache: true,
      draw: (ctx) => this.drawMap(ctx),
    });
    const previewLayer = new Canvas({
      width: this.contentWidth,
      height: this.contentHeight,
      cache: false,
      draw: (ctx) => this.drawBuildPlacementPreview(ctx),
    });

    this.graphics.use(
      new GraphicsGroup({
        members: [
          { graphic: staticLayer, offset: vec(0, 0) },
          { graphic: previewLayer, offset: vec(0, 0) },
        ],
      })
    );
    this.renderedBuildingsVersion = this.buildingsVersionProvider?.() ?? 0;
    this.renderedPlayerZoneTileCount = this.countPlayerZoneTiles();
    this.renderedBuildPlacementVersion =
      this.buildPlacementVersionProvider?.() ?? 0;
  }

  private setupPointerControls(): void {
    const pointers = this.scene?.input.pointers;
    if (!pointers) {
      return;
    }

    this.pointerSubscriptions.push(
      pointers.on('down', (evt: PointerEvent) => {
      const placementMode = this.buildPlacementProvider?.();
      if (placementMode) {
        if (evt.button === PointerButton.Right) {
          this.dragging = false;
          this.onBuildPlacementCancel?.();
          const nativeEvt = evt.nativeEvent as MouseEvent | undefined;
          nativeEvt?.preventDefault?.();
          return;
        }

        if (evt.button === PointerButton.Left) {
          const tile = this.getTileFromScreenPosition(
            evt.screenPos.x,
            evt.screenPos.y
          );
          if (!tile) {
            return;
          }
          this.onBuildPlacementConfirm?.(tile.x, tile.y);
          return;
        }
      }

      if (this.isMapInputBlocked()) {
        this.dragging = false;
        return;
      }

      if (evt.button === PointerButton.Left) {
        if (this.shouldIgnoreLeftClick?.(evt.screenPos.x, evt.screenPos.y)) {
          return;
        }

        const picked = this.findBuildingAtScreenPosition(
          evt.screenPos.x,
          evt.screenPos.y
        );
        if (picked) {
          this.selectBuilding(picked.instanceId);
        } else if (
          this.isScreenPointInsidePlayableMap(evt.screenPos.x, evt.screenPos.y)
        ) {
          this.selectBuilding(undefined);
        }
        return;
      }

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
      if (this.isMapInputBlocked()) {
        this.dragging = false;
        return;
      }

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
      if (this.isMapInputBlocked()) {
        this.dragging = false;
        return;
      }

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
      if (this.isMapInputBlocked()) {
        return;
      }

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
    if (this.isMapInputBlocked()) {
      this.dragging = false;
      return;
    }

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

  private selectBuilding(instanceId: string | undefined): void {
    if (this.selectedBuildingInstanceId === instanceId) {
      return;
    }

    this.selectedBuildingInstanceId = instanceId;
    this.onBuildingSelected?.(instanceId);
    this.rebuildCachedMapCanvas();
  }

  setSelectedBuilding(instanceId: string | undefined): void {
    this.selectBuilding(instanceId);
  }

  getMapPositionScreen(tileX: number, tileY: number): { x: number; y: number } {
    const localX = this.mapBorderPx + (tileX + 0.5) * this.tileSize;
    const localY = this.mapBorderPx + (tileY + 0.5) * this.tileSize;
    return {
      x: this.viewX + localX * this.zoom,
      y: this.viewY + localY * this.zoom,
    };
  }

  private updateBuildingTooltip(engine: Engine): void {
    if (this.buildPlacementProvider?.()) {
      this.clearBuildingTooltip();
      return;
    }

    if (!this.tooltipProvider || !this.buildingsProvider) {
      return;
    }

    const pointerPos = engine.input.pointers.primary.lastScreenPos;
    if (!pointerPos) {
      this.clearBuildingTooltip();
      return;
    }

    const hovered = this.findBuildingAtScreenPosition(pointerPos.x, pointerPos.y);
    if (!hovered) {
      this.clearBuildingTooltip();
      return;
    }

    if (this.hoveredBuildingInstanceId === hovered.instanceId) {
      return;
    }

    this.hoveredBuildingInstanceId = hovered.instanceId;
    this.tooltipProvider.show({
      owner: this,
      getAnchorRect: () => this.getBuildingAnchorRect(hovered),
      description: hovered.name,
      width: 180,
    });
  }

  private updateBuildPlacementPreview(engine: Engine): void {
    const placement = this.buildPlacementProvider?.();
    if (!placement) {
      this.buildPlacementPreviewTile = undefined;
      this.buildPlacementPreviewValid = false;
      return;
    }

    const pointerPos = engine.input.pointers.primary.lastScreenPos;
    if (!pointerPos) {
      this.buildPlacementPreviewTile = undefined;
      this.buildPlacementPreviewValid = false;
      return;
    }

    const tile = this.getTileFromScreenPosition(pointerPos.x, pointerPos.y);
    if (!tile) {
      this.buildPlacementPreviewTile = undefined;
      this.buildPlacementPreviewValid = false;
      return;
    }

    const inBounds =
      tile.x >= 0 &&
      tile.y >= 0 &&
      tile.x <= this.map.width - placement.width &&
      tile.y <= this.map.height - placement.height;
    const validTopLeftCells = placement.validTopLeftCells;
    const key = tile.y * this.map.width + tile.x;
    const valid = inBounds && validTopLeftCells.has(key);

    this.buildPlacementPreviewTile = tile;
    this.buildPlacementPreviewValid = valid;
  }

  private clearBuildingTooltip(): void {
    this.hoveredBuildingInstanceId = undefined;
    this.tooltipProvider?.hide(this);
  }

  private findBuildingAtScreenPosition(
    screenX: number,
    screenY: number
  ): MapBuildingOverlay | undefined {
    const overlays = this.buildingsProvider?.() ?? [];
    if (overlays.length === 0) {
      return undefined;
    }

    const contentX = (screenX - this.viewX) / this.zoom;
    const contentY = (screenY - this.viewY) / this.zoom;
    const mapLocalX = contentX - this.mapBorderPx;
    const mapLocalY = contentY - this.mapBorderPx;
    if (mapLocalX < 0 || mapLocalY < 0) {
      return undefined;
    }

    const tileX = Math.floor(mapLocalX / this.tileSize);
    const tileY = Math.floor(mapLocalY / this.tileSize);
    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= this.map.width ||
      tileY >= this.map.height
    ) {
      return undefined;
    }

    return overlays.find(
      (overlay) =>
        tileX >= overlay.x &&
        tileX < overlay.x + overlay.width &&
        tileY >= overlay.y &&
        tileY < overlay.y + overlay.height
    );
  }

  private isScreenPointInsidePlayableMap(screenX: number, screenY: number): boolean {
    return this.getTileFromScreenPosition(screenX, screenY) !== undefined;
  }

  private getTileFromScreenPosition(
    screenX: number,
    screenY: number
  ): { x: number; y: number } | undefined {
    const contentX = (screenX - this.viewX) / this.zoom;
    const contentY = (screenY - this.viewY) / this.zoom;
    const mapLocalX = contentX - this.mapBorderPx;
    const mapLocalY = contentY - this.mapBorderPx;
    if (mapLocalX < 0 || mapLocalY < 0) {
      return undefined;
    }

    const tileX = Math.floor(mapLocalX / this.tileSize);
    const tileY = Math.floor(mapLocalY / this.tileSize);
    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= this.map.width ||
      tileY >= this.map.height
    ) {
      return undefined;
    }

    return { x: tileX, y: tileY };
  }

  private getBuildingAnchorRect(overlay: MapBuildingOverlay): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const localX = this.mapBorderPx + overlay.x * this.tileSize;
    const localY = this.mapBorderPx + overlay.y * this.tileSize;
    const localWidth = overlay.width * this.tileSize;
    const localHeight = overlay.height * this.tileSize;

    return {
      x: this.viewX + localX * this.zoom,
      y: this.viewY + localY * this.zoom,
      width: localWidth * this.zoom,
      height: localHeight * this.zoom,
    };
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

  private countPlayerZoneTiles(): number {
    const zoneId = this.map.playerZoneId;
    if (zoneId === null) {
      return 0;
    }

    let count = 0;
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (this.map.zones[y][x] === zoneId) {
          count++;
        }
      }
    }
    return count;
  }

  private getFitZoom(engine: Engine): number {
    return Math.min(
      engine.drawWidth / this.contentWidth,
      engine.drawHeight / this.contentHeight
    );
  }

  private getPlayerStateView(
    engine: Engine,
    targetCoverage: number,
    fitZoom: number
  ): { zoom: number; viewX: number; viewY: number } | undefined {
    const bounds = this.getPlayerZoneBounds();
    if (!bounds) {
      return undefined;
    }

    const paddingTiles = MAP_VIEW_DEFAULTS.playerStatePaddingTiles;
    const minTileX = Math.max(0, bounds.minX - paddingTiles);
    const maxTileX = Math.min(this.map.width - 1, bounds.maxX + paddingTiles);
    const minTileY = Math.max(0, bounds.minY - paddingTiles);
    const maxTileY = Math.min(this.map.height - 1, bounds.maxY + paddingTiles);

    const boxWidthPx = (maxTileX - minTileX + 1) * this.tileSize;
    const boxHeightPx = (maxTileY - minTileY + 1) * this.tileSize;
    if (boxWidthPx <= 0 || boxHeightPx <= 0) {
      return undefined;
    }

    const zoomByWidth = (engine.drawWidth * targetCoverage) / boxWidthPx;
    const zoomByHeight = (engine.drawHeight * targetCoverage) / boxHeightPx;
    if (!Number.isFinite(zoomByWidth) || !Number.isFinite(zoomByHeight)) {
      return undefined;
    }

    const zoom = Math.max(fitZoom * 0.96, Math.min(zoomByWidth, zoomByHeight));

    const boxLeft = this.mapBorderPx + minTileX * this.tileSize;
    const boxTop = this.mapBorderPx + minTileY * this.tileSize;
    const centerLocalX = boxLeft + boxWidthPx / 2;
    const centerLocalY = boxTop + boxHeightPx / 2;
    return {
      zoom,
      viewX: engine.drawWidth / 2 - centerLocalX * zoom,
      viewY: engine.drawHeight / 2 - centerLocalY * zoom,
    };
  }

  private getPlayerZoneBounds():
    | { minX: number; minY: number; maxX: number; maxY: number }
    | undefined {
    const zoneId = this.map.playerZoneId;
    if (zoneId === null) {
      return undefined;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (this.map.zones[y][x] !== zoneId) {
          continue;
        }
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (!Number.isFinite(minX)) {
      return undefined;
    }

    return { minX, minY, maxX, maxY };
  }

  private getEffectiveMinZoom(engine: Engine): number {
    // Never block zooming out to full-map fit on large maps.
    return Math.min(this.configuredMinZoom, this.getFitZoom(engine));
  }

  private isMapInputBlocked(): boolean {
    return this.isInputBlocked?.() ?? false;
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
