import type {
  ResourceCost,
  ResourceManager,
  ResourceType,
} from './ResourceManager';
import type { MapData, MapTileType } from './MapManager';
import { MapManager } from './MapManager';

export type StateTiles = {
  forest: number;
  stone: number;
  plains: number;
  river: number;
};

export type StateData = {
  name: string;
  size: number;
  tiles: StateTiles;
  ocean: number;
};

export type TechnologyId = string;

export type StateBuildingId = 'castle' | 'lumbermill' | 'mine' | 'farm';

interface BuildingActionContext {
  state: Readonly<StateData>;
  resources: ResourceManager;
  buildingCount: number;
}

export interface StateBuildingActionDefinition {
  id: string;
  name: string;
  description: string;
  run: (context: BuildingActionContext) => void;
}

export interface StateBuildingDefinition {
  id: StateBuildingId;
  name: string;
  shortName: string;
  description: string;
  buildCost: ResourceCost;
  costGrowth: number;
  unique: boolean;
  placementRule: {
    width: number;
    height: number;
    allowedTiles: MapTileType[];
    fallbackReplacementTile?: MapTileType;
  };
  placementDescription: string;
  requiredTechnologies: TechnologyId[];
  getStats: (state: Readonly<StateData>, count: number) => string[];
  actions: StateBuildingActionDefinition[];
}

export interface StateBuildingBuildStatus {
  buildable: boolean;
  missingResources: ResourceCost;
  missingTechnologies: TechnologyId[];
  nextCost: ResourceCost;
  placementAvailable: boolean;
  placementReason?: string;
}

export interface StateBuildingInstance {
  instanceId: string;
  buildingId: StateBuildingId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StateBuildingMapOverlay extends StateBuildingInstance {
  name: string;
  shortName: string;
}

const stateBuildingDefinitions: Record<StateBuildingId, StateBuildingDefinition> =
  {
    castle: {
      id: 'castle',
      name: 'Castle',
      shortName: 'Csl',
      description:
        'Capital fortification that anchors settlement growth. Only one Castle can exist.',
      buildCost: {
        gold: 150,
        materials: 120,
      },
      costGrowth: 1.2,
      unique: true,
      placementRule: {
        width: 3,
        height: 3,
        allowedTiles: ['plains', 'sand'],
        fallbackReplacementTile: 'plains',
      },
      placementDescription: 'Requires 3x3 free Plains/Sand area.',
      requiredTechnologies: [],
      getStats: (_state, count) => [
        `Built: ${count}/1`,
        'Occupies 3x3 tiles',
      ],
      actions: [],
    },
    lumbermill: {
      id: 'lumbermill',
      shortName: 'Lmb',
      name: 'Lumbermill',
      description:
        'Processes nearby forests into construction-grade materials.',
      buildCost: {
        gold: 35,
        materials: 20,
      },
      costGrowth: 1.2,
      unique: false,
      placementRule: {
        width: 2,
        height: 2,
        allowedTiles: ['forest'],
      },
      placementDescription: 'Requires 2x2 free Forest area.',
      requiredTechnologies: [],
      getStats: (state, count) => {
        const baseYield = Math.max(1, Math.floor(state.tiles.forest / 4));
        return [
          `Built: ${count}`,
          `Forests: ${state.tiles.forest}`,
          `Action yield: +${baseYield * Math.max(1, count)} Materials`,
        ];
      },
      actions: [
        {
          id: 'process-timber',
          name: 'Process Timber',
          description:
            'Convert nearby timber supply into materials based on forest tiles.',
          run: ({ state, resources, buildingCount }) => {
            const gain =
              Math.max(1, Math.floor(state.tiles.forest / 4)) *
              Math.max(1, buildingCount);
            resources.addResource('materials', gain);
          },
        },
      ],
    },
    mine: {
      id: 'mine',
      name: 'Mine',
      shortName: 'Min',
      description:
        'Extracts ore and stone from rocky terrain, improving material throughput.',
      buildCost: {
        gold: 45,
        materials: 30,
      },
      costGrowth: 1.2,
      unique: false,
      placementRule: {
        width: 2,
        height: 2,
        allowedTiles: ['rocks'],
      },
      placementDescription: 'Requires 2x2 free Rocks area.',
      requiredTechnologies: [],
      getStats: (state, count) => {
        const baseYield = Math.max(1, Math.floor(state.tiles.stone / 4));
        return [
          `Built: ${count}`,
          `Stone tiles: ${state.tiles.stone}`,
          `Action yield: +${baseYield * Math.max(1, count)} Materials`,
        ];
      },
      actions: [
        {
          id: 'extract-ore',
          name: 'Extract Ore',
          description: 'Mine stone deposits and add materials to your stockpile.',
          run: ({ state, resources, buildingCount }) => {
            const gain =
              Math.max(1, Math.floor(state.tiles.stone / 4)) *
              Math.max(1, buildingCount);
            resources.addResource('materials', gain);
          },
        },
      ],
    },
    farm: {
      id: 'farm',
      shortName: 'Frm',
      name: 'Farm',
      description:
        'Stores and preserves food gathered from fertile plains for future turns.',
      buildCost: {
        gold: 40,
        materials: 24,
      },
      costGrowth: 1.2,
      unique: false,
      placementRule: {
        width: 2,
        height: 2,
        allowedTiles: ['plains'],
      },
      placementDescription: 'Requires 2x2 free Plains area.',
      requiredTechnologies: [],
      getStats: (state, count) => {
        const baseYield = Math.max(1, Math.floor(state.tiles.plains / 4));
        return [
          `Built: ${count}`,
          `Plains: ${state.tiles.plains}`,
          `Action yield: +${baseYield * Math.max(1, count)} Food`,
        ];
      },
      actions: [
        {
          id: 'gather-harvest',
          name: 'Gather Harvest',
          description: 'Collect and store harvest from plains tiles.',
          run: ({ state, resources, buildingCount }) => {
            const gain =
              Math.max(1, Math.floor(state.tiles.plains / 4)) *
              Math.max(1, buildingCount);
            resources.addResource('food', gain);
          },
        },
      ],
    },
  };

interface MapCell {
  x: number;
  y: number;
}

interface PlacementCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
  replacementCells: MapCell[];
  distanceSq: number;
}

function createEmptyBuildingRecord(): Record<StateBuildingId, number> {
  return {
    castle: 0,
    lumbermill: 0,
    mine: 0,
    farm: 0,
  };
}

export interface StateManagerOptions {
  mapManager?: MapManager;
  initial?: Partial<Omit<StateData, 'size' | 'tiles'>> & {
    tiles?: Partial<StateTiles>;
    technologies?: TechnologyId[];
    builtBuildings?: Partial<Record<StateBuildingId, number | boolean>>;
  };
}

/**
 * Manages state data, buildings, and unlocked technologies.
 */
export class StateManager {
  private state: StateData;
  private readonly mapManager?: MapManager;
  private buildingCounts: Record<StateBuildingId, number>;
  private buildingInstances: StateBuildingInstance[] = [];
  private buildingInstanceSerial = 0;
  private buildingsVersion = 0;
  private unlockedTechnologies = new Set<TechnologyId>();

  constructor(options: StateManagerOptions = {}) {
    this.mapManager = options.mapManager;
    this.state = this.generateState(options.initial);
    this.buildingCounts = createEmptyBuildingRecord();
    this.applyProgress(options.initial);
    this.ensureStartingCastle();
    this.syncStateWithMapSummary();
  }

  getState(): StateData {
    return {
      ...this.state,
      tiles: { ...this.state.tiles },
    };
  }

  /**
   * Get state data by reference (read-only view).
   * Use for hot UI polling paths to avoid per-frame allocations.
   */
  getStateRef(): Readonly<StateData> {
    return this.state;
  }

  regenerate(initial?: StateManagerOptions['initial']): void {
    this.state = this.generateState(initial);
    this.buildingCounts = createEmptyBuildingRecord();
    this.buildingInstances = [];
    this.buildingInstanceSerial = 0;
    this.buildingsVersion = 0;
    this.applyProgress(initial);
    this.ensureStartingCastle();
    this.syncStateWithMapSummary();
  }

  setName(name: string): void {
    this.state.name = name.trim() || this.state.name;
  }

  setTileCount(type: keyof StateTiles, value: number): void {
    this.state.tiles[type] = this.clamp(Math.floor(value), 0);
    this.recomputeSize();
  }

  addTileCount(type: keyof StateTiles, delta: number): void {
    this.setTileCount(type, this.state.tiles[type] + delta);
  }

  getBuildingDefinitions(): StateBuildingDefinition[] {
    return Object.values(stateBuildingDefinitions);
  }

  getBuildingDefinition(
    id: StateBuildingId
  ): StateBuildingDefinition | undefined {
    return stateBuildingDefinitions[id];
  }

  getBuildingProgress(): Record<StateBuildingId, boolean> {
    return {
      castle: this.buildingCounts.castle > 0,
      lumbermill: this.buildingCounts.lumbermill > 0,
      mine: this.buildingCounts.mine > 0,
      farm: this.buildingCounts.farm > 0,
    };
  }

  getBuildingCounts(): Record<StateBuildingId, number> {
    return { ...this.buildingCounts };
  }

  getBuildingCount(id: StateBuildingId): number {
    return this.buildingCounts[id] ?? 0;
  }

  getBuildingInstances(): StateBuildingInstance[] {
    return this.buildingInstances.map((instance) => ({ ...instance }));
  }

  getBuildingInstancesRef(): ReadonlyArray<StateBuildingInstance> {
    return this.buildingInstances;
  }

  getBuildingMapOverlays(): StateBuildingMapOverlay[] {
    return this.buildingInstances.map((instance) => ({
      ...instance,
      name: stateBuildingDefinitions[instance.buildingId].name,
      shortName: stateBuildingDefinitions[instance.buildingId].shortName,
    }));
  }

  getBuildingsVersion(): number {
    return this.buildingsVersion;
  }

  getBuildingCostForNext(id: StateBuildingId): ResourceCost {
    const definition = this.getBuildingDefinition(id);
    if (!definition) {
      return {};
    }

    const instanceCount = this.getBuildingCount(id);
    const multiplier = Math.pow(definition.costGrowth, instanceCount);
    const scaled: ResourceCost = {};

    for (const [resourceType, amount] of Object.entries(definition.buildCost) as [
      ResourceType,
      number,
    ][]) {
      scaled[resourceType] = Math.max(0, Math.ceil(amount * multiplier));
    }

    return scaled;
  }

  isBuildingBuilt(id: StateBuildingId): boolean {
    return this.getBuildingCount(id) > 0;
  }

  getUnlockedTechnologies(): TechnologyId[] {
    return Array.from(this.unlockedTechnologies.values());
  }

  isTechnologyUnlocked(id: TechnologyId): boolean {
    return this.unlockedTechnologies.has(id);
  }

  unlockTechnology(id: TechnologyId): void {
    if (!id.trim()) return;
    this.unlockedTechnologies.add(id.trim());
  }

  canBuildBuilding(
    id: StateBuildingId,
    resources: ResourceManager
  ): StateBuildingBuildStatus {
    const definition = this.getBuildingDefinition(id);
    if (!definition) {
      return {
        buildable: false,
        missingResources: {},
        missingTechnologies: [],
        nextCost: {},
        placementAvailable: false,
        placementReason: 'Unknown building.',
      };
    }

    const alreadyBuiltCount = this.getBuildingCount(id);
    if (definition.unique && alreadyBuiltCount > 0) {
      return {
        buildable: false,
        missingResources: {},
        missingTechnologies: [],
        nextCost: this.getBuildingCostForNext(id),
        placementAvailable: false,
        placementReason: 'Unique building already exists.',
      };
    }

    const nextCost = this.getBuildingCostForNext(id);
    const missingResources = this.getMissingResources(
      nextCost,
      resources
    );
    const missingTechnologies = definition.requiredTechnologies.filter(
      (tech) => !this.isTechnologyUnlocked(tech)
    );
    const placement = this.findBestPlacement(id, false);

    return {
      buildable:
        Object.keys(missingResources).length === 0 &&
        missingTechnologies.length === 0 &&
        placement !== undefined,
      missingResources,
      missingTechnologies,
      nextCost,
      placementAvailable: placement !== undefined,
      placementReason:
        placement === undefined
          ? `No valid ${definition.placementRule.width}x${definition.placementRule.height} placement near Castle.`
          : undefined,
    };
  }

  buildBuilding(id: StateBuildingId, resources: ResourceManager): boolean {
    const definition = this.getBuildingDefinition(id);
    if (!definition) {
      return false;
    }

    const status = this.canBuildBuilding(id, resources);
    if (!status.buildable) {
      return false;
    }

    const placement = this.findBestPlacement(id, false);
    if (!placement) {
      return false;
    }

    if (!resources.spendResources(status.nextCost)) {
      return false;
    }

    this.registerBuildingInstance(id, placement);
    return true;
  }

  activateBuildingAction(
    buildingId: StateBuildingId,
    actionId: string,
    resources: ResourceManager
  ): boolean {
    if (!this.isBuildingBuilt(buildingId)) {
      return false;
    }

    const definition = this.getBuildingDefinition(buildingId);
    if (!definition) {
      return false;
    }

    const action = definition.actions.find((item) => item.id === actionId);
    if (!action) {
      return false;
    }

    const buildingCount = this.getBuildingCount(buildingId);
    if (buildingCount <= 0) {
      return false;
    }

    action.run({
      state: this.state,
      resources,
      buildingCount,
    });
    return true;
  }

  private applyProgress(initial?: StateManagerOptions['initial']): void {
    this.unlockedTechnologies.clear();
    for (const technology of initial?.technologies ?? []) {
      if (technology.trim()) {
        this.unlockedTechnologies.add(technology.trim());
      }
    }

    this.buildingCounts = createEmptyBuildingRecord();
    for (const id of Object.keys(this.buildingCounts) as StateBuildingId[]) {
      const raw = initial?.builtBuildings?.[id];
      if (raw === true) {
        this.buildingCounts[id] = 1;
      } else if (typeof raw === 'number' && Number.isFinite(raw)) {
        this.buildingCounts[id] = this.clamp(Math.floor(raw), 0);
      }
    }
  }

  private getMissingResources(
    cost: ResourceCost,
    resources: ResourceManager
  ): ResourceCost {
    const missing: ResourceCost = {};
    for (const [type, amount] of Object.entries(cost) as [
      ResourceType,
      number,
    ][]) {
      const have = resources.getResource(type);
      if (have < amount) {
        missing[type] = amount - have;
      }
    }
    return missing;
  }

  private generateState(initial?: StateManagerOptions['initial']): StateData {
    const names = [
      'Northmarch',
      'Valeborn',
      'Ironreach',
      'Sunfield',
      'Duskford',
    ];
    const name =
      initial?.name ??
      names[Math.floor(Math.random() * names.length)] ??
      'Unnamed State';

    const tiles = this.generateTiles(initial?.tiles);
    const ocean = this.clamp(initial?.ocean ?? this.randomInt(0, 18), 0);
    const size = this.sumTiles(tiles);
    return { name, size, tiles, ocean };
  }

  private generateTiles(initial?: Partial<StateTiles>): StateTiles {
    return {
      forest: this.clamp(initial?.forest ?? this.randomInt(8, 40), 0),
      stone: this.clamp(initial?.stone ?? this.randomInt(4, 28), 0),
      plains: this.clamp(initial?.plains ?? this.randomInt(10, 48), 0),
      river: this.clamp(initial?.river ?? this.randomInt(2, 24), 0),
    };
  }

  private sumTiles(tiles: StateTiles): number {
    return tiles.forest + tiles.stone + tiles.plains + tiles.river;
  }

  private recomputeSize(): void {
    this.state.size = this.sumTiles(this.state.tiles);
  }

  private ensureStartingCastle(): void {
    if (!this.mapManager || this.getBuildingCount('castle') > 0) {
      return;
    }

    const placement = this.findBestPlacement('castle', true);
    if (!placement) {
      return;
    }

    const castleDefinition = this.getBuildingDefinition('castle');
    const replacementTile =
      castleDefinition?.placementRule.fallbackReplacementTile ?? 'plains';

    if (placement.replacementCells.length > 0) {
      const map = this.mapManager.getMapRef();
      for (const cell of placement.replacementCells) {
        map.tiles[cell.y][cell.x] = replacementTile;
      }
    }

    this.registerBuildingInstance('castle', placement);
  }

  private syncStateWithMapSummary(): void {
    if (!this.mapManager) {
      return;
    }

    const summary = this.mapManager.getPlayerStateSummary();
    this.state.tiles.forest = summary.tiles.forest;
    this.state.tiles.stone = summary.tiles.stone;
    this.state.tiles.plains = summary.tiles.plains;
    this.state.tiles.river = summary.tiles.river;
    this.state.ocean = summary.ocean;
    this.state.size = summary.size;
  }

  private registerBuildingInstance(
    id: StateBuildingId,
    placement: PlacementCandidate
  ): void {
    this.buildingInstanceSerial++;
    this.buildingInstances.push({
      instanceId: `${id}-${this.buildingInstanceSerial}`,
      buildingId: id,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
    this.buildingCounts[id] += 1;
    this.buildingsVersion++;
  }

  private findBestPlacement(
    buildingId: StateBuildingId,
    allowTerrainReplacement: boolean
  ): PlacementCandidate | undefined {
    if (!this.mapManager) {
      return undefined;
    }

    const map = this.mapManager.getMapRef();
    if (map.playerZoneId === null) {
      return undefined;
    }

    const definition = this.getBuildingDefinition(buildingId);
    if (!definition) {
      return undefined;
    }

    const anchor =
      buildingId === 'castle'
        ? this.getZoneCenter(map, map.playerZoneId)
        : this.getCastleCenter() ??
          this.getZoneCenter(map, map.playerZoneId);
    const occupied = this.collectOccupiedCells();

    let best: PlacementCandidate | undefined;

    for (let y = 0; y <= map.height - definition.placementRule.height; y++) {
      for (let x = 0; x <= map.width - definition.placementRule.width; x++) {
        const candidate = this.evaluatePlacementCandidate(
          map,
          x,
          y,
          definition,
          occupied,
          map.playerZoneId,
          allowTerrainReplacement,
          anchor
        );
        if (!candidate) {
          continue;
        }

        if (!best) {
          best = candidate;
          continue;
        }

        if (candidate.replacementCells.length < best.replacementCells.length) {
          best = candidate;
          continue;
        }
        if (candidate.replacementCells.length > best.replacementCells.length) {
          continue;
        }
        if (candidate.distanceSq < best.distanceSq) {
          best = candidate;
          continue;
        }
        if (
          candidate.distanceSq === best.distanceSq &&
          (candidate.y < best.y ||
            (candidate.y === best.y && candidate.x < best.x))
        ) {
          best = candidate;
        }
      }
    }

    return best;
  }

  private evaluatePlacementCandidate(
    map: Readonly<MapData>,
    startX: number,
    startY: number,
    definition: StateBuildingDefinition,
    occupied: ReadonlySet<string>,
    playerZoneId: number,
    allowTerrainReplacement: boolean,
    anchor: { x: number; y: number }
  ): PlacementCandidate | undefined {
    const replacementCells: MapCell[] = [];
    for (let dy = 0; dy < definition.placementRule.height; dy++) {
      for (let dx = 0; dx < definition.placementRule.width; dx++) {
        const x = startX + dx;
        const y = startY + dy;
        if (map.zones[y][x] !== playerZoneId) {
          return undefined;
        }
        if (occupied.has(`${x},${y}`)) {
          return undefined;
        }

        const tile = map.tiles[y][x];
        if (definition.placementRule.allowedTiles.includes(tile)) {
          continue;
        }

        if (
          !allowTerrainReplacement ||
          definition.placementRule.fallbackReplacementTile === undefined ||
          tile === 'ocean'
        ) {
          return undefined;
        }

        replacementCells.push({ x, y });
      }
    }

    const centerX = startX + (definition.placementRule.width - 1) / 2;
    const centerY = startY + (definition.placementRule.height - 1) / 2;
    const distX = centerX - anchor.x;
    const distY = centerY - anchor.y;

    return {
      x: startX,
      y: startY,
      width: definition.placementRule.width,
      height: definition.placementRule.height,
      replacementCells,
      distanceSq: distX * distX + distY * distY,
    };
  }

  private collectOccupiedCells(): Set<string> {
    const occupied = new Set<string>();
    for (const instance of this.buildingInstances) {
      for (let dy = 0; dy < instance.height; dy++) {
        for (let dx = 0; dx < instance.width; dx++) {
          occupied.add(`${instance.x + dx},${instance.y + dy}`);
        }
      }
    }
    return occupied;
  }

  private getZoneCenter(map: Readonly<MapData>, zoneId: number): {
    x: number;
    y: number;
  } {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.zones[y][x] !== zoneId) {
          continue;
        }
        sumX += x;
        sumY += y;
        count++;
      }
    }

    if (count === 0) {
      return { x: map.width / 2, y: map.height / 2 };
    }

    return { x: sumX / count, y: sumY / count };
  }

  private getCastleCenter(): { x: number; y: number } | undefined {
    const castle = this.buildingInstances.find(
      (instance) => instance.buildingId === 'castle'
    );
    if (!castle) {
      return undefined;
    }

    return {
      x: castle.x + (castle.width - 1) / 2,
      y: castle.y + (castle.height - 1) / 2,
    };
  }

  private randomInt(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

  private clamp(value: number, min: number): number {
    return Math.max(min, value);
  }
}
