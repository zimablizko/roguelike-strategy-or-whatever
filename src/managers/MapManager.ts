import { clamp } from '../_common/math';
import { SeededRandom } from '../_common/random';
import type {
  MapData,
  MapCell,
  MapManagerOptions,
  MapPlayerStateSummary,
  MapTileType,
  OceanEdge,
  OceanLayout,
  RiverStart,
  RiverStartType,
  VoronoiPoint,
} from '../_common/models/map.models';

const DEFAULT_WIDTH = 30;
const DEFAULT_HEIGHT = 20;

/**
 * Procedural map generation and storage.
 * Distribution rules:
 * - Ocean supports coastal, corner, center-lake, or no-ocean layouts
 * - River count is 0..2 with starts from ocean, river, or large rock clumps
 * - Sand appears mostly near water
 * - Forest/rocks are generated in clustered patches
 */
export class MapManager {
  private map: MapData;
  private readonly rng: SeededRandom;

  constructor(options: MapManagerOptions = {}) {
    this.rng = options.rng ?? new SeededRandom();
    if (options.initialMap) {
      this.map = this.cloneMap(options.initialMap);
      return;
    }

    const width = Math.max(8, Math.floor(options.width ?? DEFAULT_WIDTH));
    const height = Math.max(8, Math.floor(options.height ?? DEFAULT_HEIGHT));
    this.map = this.generate(width, height);
  }

  getMapRef(): Readonly<MapData> {
    return this.map;
  }

  getPlayerStateSummary(): MapPlayerStateSummary {
    return this.summarizePlayerState(this.map);
  }

  regenerate(options?: MapManagerOptions): void {
    if (options?.initialMap) {
      this.map = this.cloneMap(options.initialMap);
      return;
    }

    const width = Math.max(8, Math.floor(options?.width ?? this.map.width));
    const height = Math.max(8, Math.floor(options?.height ?? this.map.height));
    this.map = this.generate(width, height);
  }

  private cloneMap(map: Readonly<MapData>): MapData {
    return {
      width: Math.max(1, Math.floor(map.width)),
      height: Math.max(1, Math.floor(map.height)),
      tiles: map.tiles.map((row) => row.slice()),
      zones: map.zones.map((row) => row.slice()),
      zoneCount: Math.max(0, Math.floor(map.zoneCount)),
      playerZoneId:
        map.playerZoneId === null ? null : Math.floor(map.playerZoneId),
    };
  }

  private generate(width: number, height: number): MapData {
    const tiles = this.createGrid(width, height, 'plains');
    this.applyOcean(tiles, width, height);
    this.applyClusteredBiomes(tiles, width, height);
    this.applyRivers(tiles, width, height);
    this.applySand(tiles, width, height);
    const zonesData = this.generateZones(tiles, width, height);

    return {
      width,
      height,
      tiles,
      zones: zonesData.zones,
      zoneCount: zonesData.zoneCount,
      playerZoneId: zonesData.playerZoneId,
    };
  }

  private createGrid(
    width: number,
    height: number,
    tile: MapTileType
  ): MapTileType[][] {
    const grid: MapTileType[][] = [];
    for (let y = 0; y < height; y++) {
      const row: MapTileType[] = [];
      for (let x = 0; x < width; x++) {
        row.push(tile);
      }
      grid.push(row);
    }
    return grid;
  }

  private applyOcean(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): void {
    const layouts: OceanLayout[] = [
      'west',
      'east',
      'north',
      'south',
      'north-west',
      'north-east',
      'south-west',
      'south-east',
      'center',
      'none',
    ];

    const layout = layouts[this.randomInt(0, layouts.length - 1)];
    if (layout === 'none') {
      return;
    }

    if (layout === 'center') {
      this.applyCenterOcean(tiles, width, height);
      this.smoothOcean(tiles, width, height, 2);
      return;
    }

    const parts = layout.split('-') as OceanEdge[];
    const depthScale = parts.length > 1 ? 0.72 : 1;
    for (const side of parts) {
      this.applyOceanFromSide(tiles, width, height, side, depthScale);
    }

    this.smoothOcean(tiles, width, height, 1);
  }

  private applyOceanFromSide(
    tiles: MapTileType[][],
    width: number,
    height: number,
    side: OceanEdge,
    depthScale: number
  ): void {
    const minDepthBase = Math.max(
      2,
      Math.floor(Math.min(width, height) * 0.12)
    );

    if (side === 'west' || side === 'east') {
      const minDepth = Math.max(
        minDepthBase,
        Math.floor(width * 0.12 * depthScale)
      );
      const maxDepth = Math.max(
        minDepth + 1,
        Math.floor(width * 0.34 * depthScale)
      );
      const baseDepth = this.randomInt(minDepth, maxDepth);
      const driftLimit = Math.max(2, Math.floor(width * 0.08));
      let drift = 0;

      for (let y = 0; y < height; y++) {
        drift = clamp(drift + this.randomInt(-1, 1), -driftLimit, driftLimit);
        const depth = clamp(
          baseDepth + drift + this.randomInt(-1, 1),
          minDepth,
          Math.max(minDepth + 1, Math.floor(width * 0.46 * depthScale))
        );

        if (side === 'west') {
          for (let x = 0; x < depth; x++) {
            tiles[y][x] = 'ocean';
          }
        } else {
          for (let x = width - depth; x < width; x++) {
            tiles[y][x] = 'ocean';
          }
        }
      }
      return;
    }

    const minDepth = Math.max(
      minDepthBase,
      Math.floor(height * 0.12 * depthScale)
    );
    const maxDepth = Math.max(
      minDepth + 1,
      Math.floor(height * 0.34 * depthScale)
    );
    const baseDepth = this.randomInt(minDepth, maxDepth);
    const driftLimit = Math.max(2, Math.floor(height * 0.08));
    let drift = 0;

    for (let x = 0; x < width; x++) {
      drift = clamp(drift + this.randomInt(-1, 1), -driftLimit, driftLimit);
      const depth = clamp(
        baseDepth + drift + this.randomInt(-1, 1),
        minDepth,
        Math.max(minDepth + 1, Math.floor(height * 0.46 * depthScale))
      );

      if (side === 'north') {
        for (let y = 0; y < depth; y++) {
          tiles[y][x] = 'ocean';
        }
      } else {
        for (let y = height - depth; y < height; y++) {
          tiles[y][x] = 'ocean';
        }
      }
    }
  }

  private applyCenterOcean(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): void {
    const centerX = width / 2 + this.randomInt(-2, 2);
    const centerY = height / 2 + this.randomInt(-2, 2);
    const radiusX = Math.max(
      3,
      Math.floor(width * (0.16 + this.randomFloat() * 0.1))
    );
    const radiusY = Math.max(
      3,
      Math.floor(height * (0.16 + this.randomFloat() * 0.1))
    );

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = (x - centerX) / Math.max(1, radiusX);
        const ny = (y - centerY) / Math.max(1, radiusY);
        const dist = nx * nx + ny * ny;
        const jitter = (this.randomFloat() - 0.5) * 0.22;
        if (dist + jitter < 1) {
          tiles[y][x] = 'ocean';
        }
      }
    }
  }

  private smoothOcean(
    tiles: MapTileType[][],
    width: number,
    height: number,
    passes: number
  ): void {
    for (let pass = 0; pass < passes; pass++) {
      const copy = tiles.map((row) => row.slice());
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const oceanNeighbors = this.countNeighborsOfType(
            copy,
            x,
            y,
            width,
            height,
            'ocean'
          );
          if (oceanNeighbors >= 5) {
            tiles[y][x] = 'ocean';
          }
        }
      }
    }
  }

  private applyRivers(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): void {
    const riverCount = this.randomInt(0, 2);
    for (let i = 0; i < riverCount; i++) {
      const start = this.pickRiverStart(tiles, width, height, i > 0);
      if (!start) {
        continue;
      }

      const target = this.pickRiverTarget(tiles, width, height, start);
      const riverWidth = this.randomInt(2, 3);
      this.carveRiverPath(tiles, width, height, start, target, riverWidth);
    }
  }

  private pickRiverStart(
    tiles: MapTileType[][],
    width: number,
    height: number,
    allowRiverStart: boolean
  ): RiverStart | undefined {
    const coastCells = this.collectCoastlineLandCells(tiles, width, height);
    const riverCells = allowRiverStart
      ? this.collectRiverCells(tiles, width, height)
      : [];
    const rockAnchor = this.findLargeRockClumpAnchor(tiles, width, height);

    const availableTypes: RiverStartType[] = [];
    if (coastCells.length > 0) {
      availableTypes.push('ocean');
    }
    if (rockAnchor) {
      availableTypes.push('rocks');
    }
    if (riverCells.length > 0) {
      availableTypes.push('river');
    }

    if (!availableTypes.length) {
      return undefined;
    }

    const type = availableTypes[this.randomInt(0, availableTypes.length - 1)];

    if (type === 'ocean') {
      const start = coastCells[this.randomInt(0, coastCells.length - 1)];
      return { x: start.x, y: start.y, type };
    }

    if (type === 'river') {
      const start = riverCells[this.randomInt(0, riverCells.length - 1)];
      return { x: start.x, y: start.y, type };
    }

    if (!rockAnchor) {
      return undefined;
    }
    return { x: rockAnchor.x, y: rockAnchor.y, type };
  }

  private pickRiverTarget(
    tiles: MapTileType[][],
    width: number,
    height: number,
    start: RiverStart
  ): MapCell | undefined {
    const coastline = this.collectCoastlineLandCells(
      tiles,
      width,
      height
    ).filter((cell) => !(cell.x === start.x && cell.y === start.y));
    const inland = this.collectNonOceanCells(tiles, width, height).filter(
      (cell) => !(cell.x === start.x && cell.y === start.y)
    );
    const rockAnchor = this.findLargeRockClumpAnchor(tiles, width, height);
    const riverCells = this.collectRiverCells(tiles, width, height).filter(
      (cell) => !(cell.x === start.x && cell.y === start.y)
    );

    if (start.type === 'ocean') {
      if (rockAnchor) {
        return rockAnchor;
      }
      return this.selectFarthestCell(start, inland);
    }

    if (start.type === 'rocks') {
      if (coastline.length > 0) {
        return this.selectFarthestCell(start, coastline);
      }
      if (riverCells.length > 0) {
        return this.selectFarthestCell(start, riverCells);
      }
      return this.selectFarthestCell(start, inland);
    }

    if (coastline.length > 0) {
      return this.selectFarthestCell(start, coastline);
    }
    if (rockAnchor) {
      return rockAnchor;
    }
    return this.selectFarthestCell(start, inland);
  }

  private carveRiverPath(
    tiles: MapTileType[][],
    width: number,
    height: number,
    start: RiverStart,
    target: MapCell | undefined,
    riverWidth: number
  ): void {
    let x = start.x;
    let y = start.y;
    let prevDx = 0;
    let prevDy = 0;

    const maxSteps = width + height + Math.max(width, height) * 2;

    for (let step = 0; step < maxSteps; step++) {
      if (!this.isInside(x, y, width, height)) {
        break;
      }
      if (tiles[y][x] === 'ocean') {
        break;
      }

      this.paintRiverCrossSection(
        tiles,
        x,
        y,
        width,
        height,
        prevDx,
        prevDy,
        riverWidth
      );

      if (target && this.distanceSq(x, y, target.x, target.y) <= 2) {
        break;
      }

      const next = this.chooseNextRiverStep(
        tiles,
        width,
        height,
        x,
        y,
        target,
        prevDx,
        prevDy
      );
      if (!next) {
        break;
      }

      prevDx = next.x - x;
      prevDy = next.y - y;
      x = next.x;
      y = next.y;
    }
  }

  private paintRiverCrossSection(
    tiles: MapTileType[][],
    x: number,
    y: number,
    width: number,
    height: number,
    dx: number,
    dy: number,
    riverWidth: number
  ): void {
    this.setRiverCell(tiles, x, y, width, height);

    const lateral = this.getLateralDirections(dx, dy);
    if (riverWidth <= 1 || lateral.length === 0) {
      return;
    }

    if (riverWidth === 2) {
      const side = lateral[this.randomInt(0, lateral.length - 1)];
      this.setRiverCell(tiles, x + side.x, y + side.y, width, height);
      return;
    }

    // Width 3: center + two opposite lateral cells.
    if (lateral.length === 2) {
      this.setRiverCell(
        tiles,
        x + lateral[0].x,
        y + lateral[0].y,
        width,
        height
      );
      this.setRiverCell(
        tiles,
        x + lateral[1].x,
        y + lateral[1].y,
        width,
        height
      );
      return;
    }

    // Ambiguous direction (start/diagonal): pick a stable axis pair.
    const useVerticalPair = this.randomChance(0.5);
    const pair = useVerticalPair
      ? [
          { x: 0, y: -1 },
          { x: 0, y: 1 },
        ]
      : [
          { x: -1, y: 0 },
          { x: 1, y: 0 },
        ];
    this.setRiverCell(tiles, x + pair[0].x, y + pair[0].y, width, height);
    this.setRiverCell(tiles, x + pair[1].x, y + pair[1].y, width, height);
  }

  private getLateralDirections(dx: number, dy: number): MapCell[] {
    if (Math.abs(dx) > Math.abs(dy)) {
      return [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
      ];
    }

    if (Math.abs(dy) > Math.abs(dx)) {
      return [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ];
    }

    // Start point or diagonal: allow either axis.
    return [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
  }

  private setRiverCell(
    tiles: MapTileType[][],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!this.isInside(x, y, width, height)) {
      return;
    }
    if (tiles[y][x] === 'ocean') {
      return;
    }
    tiles[y][x] = 'river';
  }

  private chooseNextRiverStep(
    tiles: MapTileType[][],
    width: number,
    height: number,
    x: number,
    y: number,
    target: MapCell | undefined,
    prevDx: number,
    prevDy: number
  ): MapCell | undefined {
    let best: MapCell | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    const currentDist = target ? this.distanceSq(x, y, target.x, target.y) : 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;
        if (!this.isInside(nx, ny, width, height)) {
          continue;
        }

        const tile = tiles[ny][nx];
        let score = this.randomFloat() * 0.65;

        if (target) {
          const nextDist = this.distanceSq(nx, ny, target.x, target.y);
          score += (currentDist - nextDist) * 0.28;
        }

        if (tile === 'ocean') {
          score -= 3.6;
        } else if (tile === 'river') {
          score -= 1.1;
        }

        if (tile === 'rocks') {
          score += 0.12;
        }
        if (dx !== 0 && dy !== 0) {
          score -= 0.15;
        }
        if (prevDx === -dx && prevDy === -dy) {
          score -= 0.85;
        }

        if (score > bestScore) {
          bestScore = score;
          best = { x: nx, y: ny };
        }
      }
    }

    return best;
  }

  private collectCoastlineLandCells(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): MapCell[] {
    const cells: MapCell[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y][x] === 'ocean') {
          continue;
        }

        let adjacentOcean = false;
        for (const dir of this.cardinalDirections) {
          const nx = x + dir.x;
          const ny = y + dir.y;
          if (!this.isInside(nx, ny, width, height)) {
            continue;
          }
          if (tiles[ny][nx] === 'ocean') {
            adjacentOcean = true;
            break;
          }
        }

        if (adjacentOcean) {
          cells.push({ x, y });
        }
      }
    }
    return cells;
  }

  private collectRiverCells(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): MapCell[] {
    const cells: MapCell[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y][x] === 'river') {
          cells.push({ x, y });
        }
      }
    }
    return cells;
  }

  private collectNonOceanCells(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): MapCell[] {
    const cells: MapCell[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y][x] !== 'ocean') {
          cells.push({ x, y });
        }
      }
    }
    return cells;
  }

  private findLargeRockClumpAnchor(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): MapCell | undefined {
    const clusters = this.collectRockClusters(tiles, width, height);
    if (!clusters.length) {
      return undefined;
    }

    let largest = clusters[0];
    for (const cluster of clusters) {
      if (cluster.length > largest.length) {
        largest = cluster;
      }
    }

    const minClumpSize = Math.max(
      6,
      Math.floor(Math.min(width, height) * 0.35)
    );
    if (largest.length < minClumpSize) {
      return undefined;
    }

    let avgX = 0;
    let avgY = 0;
    for (const cell of largest) {
      avgX += cell.x;
      avgY += cell.y;
    }
    avgX /= largest.length;
    avgY /= largest.length;

    let best = largest[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const cell of largest) {
      const dist = this.distanceSq(cell.x, cell.y, avgX, avgY);
      if (dist < bestDist) {
        bestDist = dist;
        best = cell;
      }
    }
    return { x: best.x, y: best.y };
  }

  private collectRockClusters(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): MapCell[][] {
    const visited: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      visited.push(new Array<boolean>(width).fill(false));
    }

    const clusters: MapCell[][] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (visited[y][x] || tiles[y][x] !== 'rocks') {
          continue;
        }

        const cluster: MapCell[] = [];
        const queue: MapCell[] = [{ x, y }];
        visited[y][x] = true;

        while (queue.length > 0) {
          const current = queue.shift();
          if (!current) {
            continue;
          }
          cluster.push(current);

          for (const dir of this.cardinalDirections) {
            const nx = current.x + dir.x;
            const ny = current.y + dir.y;
            if (!this.isInside(nx, ny, width, height)) {
              continue;
            }
            if (visited[ny][nx] || tiles[ny][nx] !== 'rocks') {
              continue;
            }

            visited[ny][nx] = true;
            queue.push({ x: nx, y: ny });
          }
        }

        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private selectFarthestCell(
    from: MapCell,
    candidates: MapCell[]
  ): MapCell | undefined {
    if (!candidates.length) {
      return undefined;
    }

    let best = candidates[0];
    let bestDist = this.distanceSq(from.x, from.y, best.x, best.y);
    for (let i = 1; i < candidates.length; i++) {
      const candidate = candidates[i];
      const dist = this.distanceSq(from.x, from.y, candidate.x, candidate.y);
      if (dist > bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }

    return { x: best.x, y: best.y };
  }

  private distanceSq(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
  }

  private applySand(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): void {
    const copy = tiles.map((row) => row.slice());

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (copy[y][x] !== 'plains') {
          continue;
        }

        const oceanAdj = this.countNeighborsOfType(
          copy,
          x,
          y,
          width,
          height,
          'ocean'
        );
        const riverAdj = this.countNeighborsOfType(
          copy,
          x,
          y,
          width,
          height,
          'river'
        );
        const nearWater2 = this.isNearWater(copy, x, y, width, height, 2);

        let chance = 0;
        if (oceanAdj > 0) {
          chance = 0.78;
        } else if (riverAdj > 0) {
          chance = 0.5;
        } else if (nearWater2) {
          chance = 0.14;
        }

        if (this.randomChance(chance)) {
          tiles[y][x] = 'sand';
        }
      }
    }
  }

  private applyClusteredBiomes(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): void {
    const eligible: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y][x] === 'plains') {
          eligible.push({ x, y });
        }
      }
    }

    if (!eligible.length) {
      return;
    }

    const rockField = this.buildSmoothedNoiseField(width, height, 3);
    const forestField = this.buildSmoothedNoiseField(width, height, 3);

    const rockCount = Math.max(1, Math.floor(eligible.length * 0.11));
    const forestCount = Math.max(1, Math.floor(eligible.length * 0.28));

    const rockCandidates = eligible
      .slice()
      .sort(
        (a, b) =>
          rockField[b.y][b.x] - rockField[a.y][a.x] + this.randomFloat() * 0.02
      );

    const chosenRock = new Set<string>();
    for (let i = 0; i < Math.min(rockCount, rockCandidates.length); i++) {
      const c = rockCandidates[i];
      chosenRock.add(`${c.x},${c.y}`);
      tiles[c.y][c.x] = 'rocks';
    }

    const forestCandidates = eligible
      .filter((cell) => !chosenRock.has(`${cell.x},${cell.y}`))
      .sort(
        (a, b) =>
          forestField[b.y][b.x] -
          forestField[a.y][a.x] +
          this.randomFloat() * 0.02
      );

    for (let i = 0; i < Math.min(forestCount, forestCandidates.length); i++) {
      const c = forestCandidates[i];
      if (tiles[c.y][c.x] === 'plains') {
        tiles[c.y][c.x] = 'forest';
      }
    }
  }

  private generateZones(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): {
    zones: (number | null)[][];
    zoneCount: number;
    playerZoneId: number | null;
  } {
    const zones = this.createNullZoneGrid(width, height);
    const landCells = this.collectLandCells(tiles, width, height);
    if (landCells.length === 0) {
      return {
        zones,
        zoneCount: 0,
        playerZoneId: null,
      };
    }

    const zoneCount = this.estimateZoneCount(landCells.length);
    const initialCentroids = this.pickInitialCentroids(landCells, zoneCount);
    let centroids = initialCentroids;

    // Lloyd relaxation: assign, recenter, repeat to make zones closer in size.
    for (let i = 0; i < 3; i++) {
      const groups = this.assignCellsToVoronoiGroups(landCells, centroids);
      centroids = this.recenterVoronoiPoints(groups, centroids);
    }

    const groups = this.assignCellsToVoronoiGroups(landCells, centroids);
    for (let zoneId = 0; zoneId < groups.length; zoneId++) {
      for (const cell of groups[zoneId]) {
        zones[cell.y][cell.x] = zoneId;
      }
    }

    const nonEmptyZones: number[] = [];
    for (let zoneId = 0; zoneId < groups.length; zoneId++) {
      if (groups[zoneId].length > 0) {
        nonEmptyZones.push(zoneId);
      }
    }

    const playerZoneId =
      nonEmptyZones.length > 0
        ? nonEmptyZones[this.randomInt(0, nonEmptyZones.length - 1)]
        : null;

    return {
      zones,
      zoneCount: nonEmptyZones.length,
      playerZoneId,
    };
  }

  private summarizePlayerState(map: MapData): MapPlayerStateSummary {
    const summary: MapPlayerStateSummary = {
      tiles: {
        forest: 0,
        stone: 0,
        plains: 0,
        river: 0,
      },
      size: 0,
      ocean: 0,
    };

    const playerZoneId = map.playerZoneId;
    if (playerZoneId === null) {
      return summary;
    }

    const borderingOceanTiles = new Set<string>();

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.zones[y][x] !== playerZoneId) {
          continue;
        }

        summary.size++;
        const tile = map.tiles[y][x];
        if (tile === 'forest') {
          summary.tiles.forest++;
        } else if (tile === 'rocks') {
          summary.tiles.stone++;
        } else if (tile === 'river') {
          summary.tiles.river++;
        } else {
          // Sand is treated as plains for state-economy calculations.
          summary.tiles.plains++;
        }

        for (const dir of this.cardinalDirections) {
          const nx = x + dir.x;
          const ny = y + dir.y;
          if (!this.isInside(nx, ny, map.width, map.height)) {
            continue;
          }

          if (map.tiles[ny][nx] === 'ocean') {
            borderingOceanTiles.add(`${nx},${ny}`);
          }
        }
      }
    }

    summary.ocean = borderingOceanTiles.size;
    return summary;
  }

  private createNullZoneGrid(
    width: number,
    height: number
  ): (number | null)[][] {
    const grid: (number | null)[][] = [];
    for (let y = 0; y < height; y++) {
      const row: (number | null)[] = [];
      for (let x = 0; x < width; x++) {
        row.push(null);
      }
      grid.push(row);
    }
    return grid;
  }

  private collectLandCells(
    tiles: MapTileType[][],
    width: number,
    height: number
  ): MapCell[] {
    const cells: MapCell[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y][x] !== 'ocean') {
          cells.push({ x, y });
        }
      }
    }
    return cells;
  }

  private estimateZoneCount(landTileCount: number): number {
    const approxTilesPerZone = 70;
    const roughCount = Math.round(landTileCount / approxTilesPerZone);
    const maxZones = Math.max(2, Math.min(12, Math.floor(landTileCount / 25)));
    return clamp(roughCount, 2, maxZones);
  }

  private pickInitialCentroids(
    landCells: MapCell[],
    zoneCount: number
  ): VoronoiPoint[] {
    const centroids: VoronoiPoint[] = [];
    if (landCells.length === 0) {
      return centroids;
    }

    centroids.push(this.randomCellAsPoint(landCells));
    const targetCount = Math.min(zoneCount, landCells.length);

    while (centroids.length < targetCount) {
      let bestCell = landCells[0];
      let bestDistance = -1;

      for (const cell of landCells) {
        const distance = this.distanceToNearestCentroid(cell, centroids);
        if (distance > bestDistance) {
          bestDistance = distance;
          bestCell = cell;
        }
      }

      centroids.push({ x: bestCell.x, y: bestCell.y });
    }

    return centroids;
  }

  private assignCellsToVoronoiGroups(
    cells: MapCell[],
    centroids: VoronoiPoint[]
  ): MapCell[][] {
    const groups: MapCell[][] = centroids.map(() => []);
    if (!centroids.length) {
      return groups;
    }

    for (const cell of cells) {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < centroids.length; i++) {
        const centroid = centroids[i];
        const dx = cell.x - centroid.x;
        const dy = cell.y - centroid.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < bestDistance) {
          bestDistance = distanceSq;
          bestIndex = i;
        }
      }
      groups[bestIndex].push(cell);
    }

    return groups;
  }

  private recenterVoronoiPoints(
    groups: MapCell[][],
    previous: VoronoiPoint[]
  ): VoronoiPoint[] {
    const next: VoronoiPoint[] = [];
    for (let i = 0; i < groups.length; i++) {
      const cells = groups[i];
      if (cells.length === 0) {
        next.push(previous[i]);
        continue;
      }

      let sumX = 0;
      let sumY = 0;
      for (const cell of cells) {
        sumX += cell.x;
        sumY += cell.y;
      }
      next.push({
        x: sumX / cells.length,
        y: sumY / cells.length,
      });
    }
    return next;
  }

  private distanceToNearestCentroid(
    cell: MapCell,
    centroids: VoronoiPoint[]
  ): number {
    let best = Number.POSITIVE_INFINITY;
    for (const centroid of centroids) {
      const dx = cell.x - centroid.x;
      const dy = cell.y - centroid.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < best) {
        best = distanceSq;
      }
    }
    return best;
  }

  private randomCellAsPoint(cells: MapCell[]): VoronoiPoint {
    const picked = cells[this.randomInt(0, cells.length - 1)];
    return { x: picked.x, y: picked.y };
  }

  private readonly cardinalDirections: ReadonlyArray<{ x: number; y: number }> =
    [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];

  private buildSmoothedNoiseField(
    width: number,
    height: number,
    passes: number
  ): number[][] {
    let field: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(this.randomFloat());
      }
      field.push(row);
    }

    for (let i = 0; i < passes; i++) {
      field = this.smoothField(field, width, height);
    }
    return field;
  }

  private smoothField(
    field: number[][],
    width: number,
    height: number
  ): number[][] {
    const next: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        let sum = field[y][x] * 2;
        let weight = 2;
        for (let ny = y - 1; ny <= y + 1; ny++) {
          for (let nx = x - 1; nx <= x + 1; nx++) {
            if (nx === x && ny === y) continue;
            if (!this.isInside(nx, ny, width, height)) continue;
            sum += field[ny][nx];
            weight += 1;
          }
        }
        row.push(sum / weight);
      }
      next.push(row);
    }
    return next;
  }

  private countNeighborsOfType(
    tiles: MapTileType[][],
    x: number,
    y: number,
    width: number,
    height: number,
    type: MapTileType
  ): number {
    let count = 0;
    for (let ny = y - 1; ny <= y + 1; ny++) {
      for (let nx = x - 1; nx <= x + 1; nx++) {
        if (nx === x && ny === y) continue;
        if (!this.isInside(nx, ny, width, height)) continue;
        if (tiles[ny][nx] === type) {
          count++;
        }
      }
    }
    return count;
  }

  private isNearWater(
    tiles: MapTileType[][],
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): boolean {
    for (let ny = y - radius; ny <= y + radius; ny++) {
      for (let nx = x - radius; nx <= x + radius; nx++) {
        if (!this.isInside(nx, ny, width, height)) continue;
        const tile = tiles[ny][nx];
        if (tile === 'river' || tile === 'ocean') {
          return true;
        }
      }
    }
    return false;
  }

  private isInside(
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    return x >= 0 && x < width && y >= 0 && y < height;
  }

  private randomInt(min: number, max: number): number {
    return this.rng.randomInt(min, max);
  }

  private randomFloat(): number {
    return this.rng.randomFloat();
  }

  private randomChance(chance: number): boolean {
    return this.rng.randomChance(chance);
  }
}
