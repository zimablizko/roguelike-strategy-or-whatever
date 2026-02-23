import { clamp } from '../_common/math';
import type {
  BuildingManagerOptions,
  BuildingManagerStateBridge,
  BuildingMapCell,
  PlacementCandidate,
  StateBuildingActionStatus,
  StateBuildingBuildStatus,
  StateBuildingInstance,
  StateBuildingMapOverlay,
  StateBuildingPlacement,
} from '../_common/models/building-manager.models';
import type {
  StateBuildingDefinition,
  StateBuildingId,
  TechnologyId,
  TypedBuildingDefinition,
} from '../_common/models/buildings.models';
import type { MapData } from '../_common/models/map.models';
import type {
  ResourceCost,
  ResourceType,
} from '../_common/models/resource.models';
import type { EndTurnIncomePulse } from '../_common/models/turn.models';
import {
  createEmptyBuildingRecord,
  stateBuildingDefinitions,
} from '../data/buildings';
import { MapManager } from './MapManager';
import type { ResourceManager } from './ResourceManager';

export class BuildingManager {
  private readonly mapManager?: MapManager;
  private readonly stateBridge: BuildingManagerStateBridge;
  private buildingCounts: Record<StateBuildingId, number>;
  private buildingInstances: StateBuildingInstance[] = [];
  private buildingInstanceSerial = 0;
  private buildingsVersion = 0;
  private unlockedTechnologies = new Set<TechnologyId>();
  /** Tracks how many times each action has been used this turn. Key: "instanceId:actionId". */
  private actionUsesThisTurn = new Map<string, number>();

  constructor(options: BuildingManagerOptions) {
    this.mapManager = options.mapManager;
    this.stateBridge = options.stateBridge;
    this.buildingCounts = createEmptyBuildingRecord();
    this.applyProgress(options.initial);
    this.ensureStartingCastle();
    this.syncStateWithMapSummary();
  }

  regenerate(initial?: BuildingManagerOptions['initial']): void {
    this.buildingCounts = createEmptyBuildingRecord();
    this.buildingInstances = [];
    this.buildingInstanceSerial = 0;
    this.buildingsVersion = 0;
    this.applyProgress(initial);
    this.ensureStartingCastle();
    this.syncStateWithMapSummary();
  }

  getBuildingDefinitions(): TypedBuildingDefinition[] {
    return Object.values(stateBuildingDefinitions) as TypedBuildingDefinition[];
  }

  getBuildingDefinition(
    id: StateBuildingId
  ): TypedBuildingDefinition | undefined {
    return stateBuildingDefinitions[id] as TypedBuildingDefinition | undefined;
  }

  getBuildingProgress(): Record<StateBuildingId, boolean> {
    const progress = {} as Record<StateBuildingId, boolean>;
    for (const id of Object.keys(this.buildingCounts) as StateBuildingId[]) {
      progress[id] = this.buildingCounts[id] > 0;
    }
    return progress;
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

  getBuildingInstanceSerial(): number {
    return this.buildingInstanceSerial;
  }

  getLatestBuildingInstance(
    buildingId?: StateBuildingId
  ): StateBuildingInstance | undefined {
    for (let i = this.buildingInstances.length - 1; i >= 0; i--) {
      const instance = this.buildingInstances[i];
      if (!buildingId || instance.buildingId === buildingId) {
        return { ...instance };
      }
    }
    return undefined;
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

  /**
   * Signals that map tiles have changed externally (e.g. field recovery).
   * Re-syncs state and bumps the buildings version so views re-render.
   */
  notifyMapChanged(): void {
    this.syncStateWithMapSummary();
    this.buildingsVersion++;
  }

  // ─── Population helpers ──────────────────────────────────────────

  /**
   * Total population provided by all buildings with `populationProvided`.
   */
  getTotalPopulation(): number {
    let total = 0;
    for (const id of Object.keys(this.buildingCounts) as StateBuildingId[]) {
      const definition = this.getBuildingDefinition(id);
      if (definition?.populationProvided) {
        total += definition.populationProvided * this.buildingCounts[id];
      }
    }
    return total;
  }

  /**
   * Population occupied by all buildings with `populationRequired`.
   */
  getOccupiedPopulation(): number {
    let occupied = 0;
    for (const id of Object.keys(this.buildingCounts) as StateBuildingId[]) {
      const definition = this.getBuildingDefinition(id);
      if (definition?.populationRequired) {
        occupied += definition.populationRequired * this.buildingCounts[id];
      }
    }
    return occupied;
  }

  /**
   * Free (unoccupied) population available for new buildings.
   */
  getFreePopulation(): number {
    return Math.max(
      0,
      this.getTotalPopulation() - this.getOccupiedPopulation()
    );
  }

  /**
   * Computes a preview of the Harvest Timber action yield.
   * When instanceId is provided, only that lumbermill instance is considered.
   * Returns the number of in-range forest tiles and the estimated material gain.
   */
  getLumermillHarvestYieldPreview(
    instanceId?: string,
    range = 3
  ): {
    forestCount: number;
    estimatedYield: number;
  } {
    if (!this.mapManager) {
      return { forestCount: 0, estimatedYield: 0 };
    }

    const map = this.mapManager.getMapRef();
    const instances = this.buildingInstances.filter(
      (i) =>
        i.buildingId === 'lumbermill' &&
        (instanceId === undefined || i.instanceId === instanceId)
    );

    const seen = new Set<number>();
    for (const inst of instances) {
      for (
        let ty = inst.y - range;
        ty <= inst.y + inst.height - 1 + range;
        ty++
      ) {
        for (
          let tx = inst.x - range;
          tx <= inst.x + inst.width - 1 + range;
          tx++
        ) {
          if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
          if (map.tiles[ty][tx] === 'forest') {
            seen.add(ty * map.width + tx);
          }
        }
      }
    }

    const N = seen.size;
    let estimatedYield = 0;
    for (let i = 0; i < N; i++) {
      estimatedYield += Math.max(1, Math.round(3 * Math.pow(0.9, i)));
    }

    return { forestCount: N, estimatedYield };
  }

  getBuildingCostForNext(id: StateBuildingId): ResourceCost {
    const definition = this.getBuildingDefinition(id);
    if (!definition) {
      return {};
    }

    const instanceCount = this.getBuildingCount(id);
    const multiplier = Math.pow(definition.costGrowth, instanceCount);
    const scaled: ResourceCost = {};

    for (const [resourceType, amount] of Object.entries(
      definition.buildCost
    ) as [ResourceType, number][]) {
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
        populationInsufficient: false,
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
        populationInsufficient: false,
        nextCost: this.getBuildingCostForNext(id),
        placementAvailable: false,
        placementReason: 'Unique building already exists.',
      };
    }

    const nextCost = this.getBuildingCostForNext(id);
    const missingResources = this.getMissingResources(nextCost, resources);
    const missingTechnologies = definition.requiredTechnologies.filter(
      (tech) => !this.isTechnologyUnlocked(tech)
    );
    const placement = this.findBestPlacement(id, false);
    const populationInsufficient =
      (definition.populationRequired ?? 0) > 0 &&
      this.getFreePopulation() < (definition.populationRequired ?? 0);

    return {
      buildable:
        Object.keys(missingResources).length === 0 &&
        missingTechnologies.length === 0 &&
        !populationInsufficient &&
        placement !== undefined,
      missingResources,
      missingTechnologies,
      populationInsufficient,
      nextCost,
      placementAvailable: placement !== undefined,
      placementReason:
        placement === undefined
          ? `No valid ${definition.placementRule.width}x${definition.placementRule.height} placement near Castle.`
          : undefined,
    };
  }

  canPlaceBuildingAt(
    id: StateBuildingId,
    x: number,
    y: number,
    resources: ResourceManager
  ): StateBuildingBuildStatus {
    const definition = this.getBuildingDefinition(id);
    if (!definition) {
      return {
        buildable: false,
        missingResources: {},
        missingTechnologies: [],
        populationInsufficient: false,
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
        populationInsufficient: false,
        nextCost: this.getBuildingCostForNext(id),
        placementAvailable: false,
        placementReason: 'Unique building already exists.',
      };
    }

    const nextCost = this.getBuildingCostForNext(id);
    const missingResources = this.getMissingResources(nextCost, resources);
    const missingTechnologies = definition.requiredTechnologies.filter(
      (tech) => !this.isTechnologyUnlocked(tech)
    );
    const placement = this.findPlacementAt(id, x, y, false);
    const populationInsufficient =
      (definition.populationRequired ?? 0) > 0 &&
      this.getFreePopulation() < (definition.populationRequired ?? 0);

    return {
      buildable:
        Object.keys(missingResources).length === 0 &&
        missingTechnologies.length === 0 &&
        !populationInsufficient &&
        placement !== undefined,
      missingResources,
      missingTechnologies,
      populationInsufficient,
      nextCost,
      placementAvailable: placement !== undefined,
      placementReason:
        placement === undefined
          ? `Selected tile cannot fit ${definition.placementRule.width}x${definition.placementRule.height} ${definition.name}.`
          : undefined,
    };
  }

  getAvailablePlacements(
    id: StateBuildingId,
    resources: ResourceManager
  ): StateBuildingPlacement[] {
    const definition = this.getBuildingDefinition(id);
    if (!definition || !this.mapManager) {
      return [];
    }

    const alreadyBuiltCount = this.getBuildingCount(id);
    if (definition.unique && alreadyBuiltCount > 0) {
      return [];
    }

    const nextCost = this.getBuildingCostForNext(id);
    if (Object.keys(this.getMissingResources(nextCost, resources)).length > 0) {
      return [];
    }
    if (
      definition.requiredTechnologies.some(
        (technology) => !this.isTechnologyUnlocked(technology)
      )
    ) {
      return [];
    }

    if (
      (definition.populationRequired ?? 0) > 0 &&
      this.getFreePopulation() < (definition.populationRequired ?? 0)
    ) {
      return [];
    }

    const map = this.mapManager.getMapRef();
    if (map.playerZoneId === null) {
      return [];
    }
    const occupied = this.collectOccupiedCells();
    const anchor =
      this.getCastleCenter() ?? this.getZoneCenter(map, map.playerZoneId);
    const placements: StateBuildingPlacement[] = [];

    for (let py = 0; py <= map.height - definition.placementRule.height; py++) {
      for (let px = 0; px <= map.width - definition.placementRule.width; px++) {
        const placement = this.evaluatePlacementCandidate(
          map,
          px,
          py,
          definition,
          occupied,
          map.playerZoneId,
          false,
          anchor
        );
        if (!placement) {
          continue;
        }
        placements.push({
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
        });
      }
    }

    return placements;
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

  buildBuildingAt(
    id: StateBuildingId,
    x: number,
    y: number,
    resources: ResourceManager
  ): boolean {
    const definition = this.getBuildingDefinition(id);
    if (!definition) {
      return false;
    }

    const status = this.canPlaceBuildingAt(id, x, y, resources);
    if (!status.buildable) {
      return false;
    }

    const placement = this.findPlacementAt(id, x, y, false);
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
    instanceId: string,
    resources: ResourceManager
  ): EndTurnIncomePulse[] | null {
    const status = this.canActivateBuildingAction(
      buildingId,
      actionId,
      instanceId,
      resources
    );
    if (!status.activatable) {
      return null;
    }

    if (buildingId === 'castle' && actionId === 'expand-border') {
      const expanded = this.expandPlayerBorders();
      if (expanded) {
        this.incrementActionUsage(instanceId, actionId);
      }
      return expanded ? [] : null;
    }

    const definition = this.getBuildingDefinition(buildingId);
    if (!definition) {
      return null;
    }

    const action = definition.actions.find((item) => item.id === actionId);
    if (!action) {
      return null;
    }

    const instance = this.buildingInstances.find(
      (i) => i.instanceId === instanceId
    );
    if (!instance) {
      return null;
    }

    // Intercept addResource calls during action execution to collect pulses.
    const pulses: EndTurnIncomePulse[] = [];
    const tileX = instance.x + (instance.width - 1) / 2;
    const tileY = instance.y + (instance.height - 1) / 2;
    const trackingResources: ResourceManager = new Proxy(resources, {
      get(target, prop, receiver) {
        if (prop === 'addResource') {
          return (type: ResourceType, amount: number) => {
            target.addResource(type, amount);
            if (amount !== 0) {
              pulses.push({ tileX, tileY, resourceType: type, amount });
            }
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    action.run(
      this.buildActionContext(buildingId, instanceId, trackingResources)
    );
    this.incrementActionUsage(instanceId, actionId);
    return pulses;
  }

  private buildActionContext(
    buildingId: StateBuildingId,
    instanceId: string,
    resources: ResourceManager
  ) {
    const instance = this.buildingInstances.find(
      (i) => i.instanceId === instanceId
    );
    return {
      state: this.stateBridge.getStateRef(),
      resources,
      getResource: (type: string) =>
        resources.getResource(type as ResourceType),
      isTechnologyUnlocked: (id: string) => this.isTechnologyUnlocked(id),
      buildingCount: this.getBuildingCount(buildingId),
      buildingInstances: instance
        ? [
            {
              x: instance.x,
              y: instance.y,
              width: instance.width,
              height: instance.height,
            },
          ]
        : [],

      mapGetTile: (x: number, y: number) => {
        const map = this.mapManager?.getMapRef();
        if (!map) return undefined;
        return map.tiles[Math.floor(y)]?.[Math.floor(x)];
      },
      isInPlayerZone: (x: number, y: number) => {
        const map = this.mapManager?.getMapRef();
        if (!map || map.playerZoneId === null) return false;
        return map.zones[Math.floor(y)]?.[Math.floor(x)] === map.playerZoneId;
      },
      mapSetTile: (
        x: number,
        y: number,
        tile: import('../_common/models/map.models').MapTileType
      ) => {
        if (!this.mapManager) return;
        this.mapManager.setTile(x, y, tile);
        this.syncStateWithMapSummary();
        this.buildingsVersion++;
      },
    };
  }

  canActivateBuildingAction(
    buildingId: StateBuildingId,
    actionId: string,
    instanceId: string,
    resources?: ResourceManager
  ): StateBuildingActionStatus {
    if (!this.isBuildingBuilt(buildingId)) {
      return {
        activatable: false,
        reason: 'Building is not built yet.',
      };
    }

    const definition = this.getBuildingDefinition(buildingId);
    if (!definition) {
      return {
        activatable: false,
        reason: 'Unknown building.',
      };
    }

    const action = definition.actions.find((item) => item.id === actionId);
    if (!action) {
      return {
        activatable: false,
        reason: 'Unknown action.',
      };
    }

    const usesMax = action.charges ?? 1;
    const usedCount =
      this.actionUsesThisTurn.get(`${instanceId}:${actionId}`) ?? 0;
    const usesRemaining = Math.max(0, usesMax - usedCount);

    if (usesRemaining === 0) {
      return {
        activatable: false,
        reason: 'No uses remaining this turn.',
        usesRemaining: 0,
        usesMax,
      };
    }

    if (buildingId === 'castle' && actionId === 'expand-border') {
      const expandStatus = this.getExpandBorderStatus();
      return { ...expandStatus, usesRemaining, usesMax };
    }

    if (action.canRun) {
      const effectiveResources: ResourceManager =
        resources ??
        ({
          addResource: () => {},
          getResource: () => Infinity,
        } as unknown as ResourceManager);
      const ctx = this.buildActionContext(
        buildingId,
        instanceId,
        effectiveResources
      );
      const canRunResult = action.canRun(ctx);
      if (!canRunResult.activatable) {
        return {
          activatable: false,
          reason: canRunResult.reason,
          usesRemaining,
          usesMax,
        };
      }
    }

    return { activatable: true, usesRemaining, usesMax };
  }

  /**
   * Resets all per-turn action usage counters.
   * Called at the start of each new turn.
   */
  resetActionUsage(): void {
    this.actionUsesThisTurn.clear();
  }

  private applyProgress(initial?: BuildingManagerOptions['initial']): void {
    this.unlockedTechnologies.clear();
    for (const technology of initial?.technologies ?? []) {
      if (technology.trim()) {
        this.unlockedTechnologies.add(technology.trim());
      }
    }

    this.buildingCounts = createEmptyBuildingRecord();
    this.buildingInstances = [];
    this.buildingInstanceSerial = 0;

    if (initial?.buildingInstances && initial.buildingInstances.length > 0) {
      for (const rawInstance of initial.buildingInstances) {
        const definition = this.getBuildingDefinition(rawInstance.buildingId);
        if (!definition) {
          continue;
        }

        const width = clamp(Math.floor(rawInstance.width), 1);
        const height = clamp(Math.floor(rawInstance.height), 1);
        this.buildingInstances.push({
          instanceId: rawInstance.instanceId,
          buildingId: rawInstance.buildingId,
          x: clamp(Math.floor(rawInstance.x), 0),
          y: clamp(Math.floor(rawInstance.y), 0),
          width,
          height,
        });
        this.buildingCounts[rawInstance.buildingId] += 1;
      }

      const highestSerial = this.collectHighestBuildingInstanceSerial();
      const requestedSerial = clamp(
        Math.floor(initial.buildingInstanceSerial ?? 0),
        0
      );
      this.buildingInstanceSerial = Math.max(requestedSerial, highestSerial);
      return;
    }

    for (const id of Object.keys(this.buildingCounts) as StateBuildingId[]) {
      const raw = initial?.builtBuildings?.[id];
      if (raw === true) {
        this.buildingCounts[id] = 1;
      } else if (typeof raw === 'number' && Number.isFinite(raw)) {
        this.buildingCounts[id] = clamp(Math.floor(raw), 0);
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

  private ensureStartingCastle(): void {
    const hasCastleInstance = this.buildingInstances.some(
      (instance) => instance.buildingId === 'castle'
    );
    if (!this.mapManager || hasCastleInstance) {
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
      const map = this.mapManager.getMapRef() as MapData;
      for (const cell of placement.replacementCells) {
        map.tiles[cell.y][cell.x] = replacementTile;
      }
    }

    this.registerBuildingInstance('castle', placement);
  }

  private collectHighestBuildingInstanceSerial(): number {
    let highest = 0;
    for (const instance of this.buildingInstances) {
      const dashIndex = instance.instanceId.lastIndexOf('-');
      if (dashIndex < 0) {
        continue;
      }
      const serialText = instance.instanceId.slice(dashIndex + 1);
      const serial = Number.parseInt(serialText, 10);
      if (Number.isFinite(serial)) {
        highest = Math.max(highest, serial);
      }
    }
    return highest;
  }

  /**
   * Returns valid top-left positions for a 2×2 farm-field placement near the
   * given farm instance. Positions must be all-plains and not covered by any
   * existing building, within `range` tiles of the farm's edges.
   */
  getAvailableFieldPlacements(
    farmInstanceId: string,
    range: number
  ): Array<{ x: number; y: number }> {
    if (!this.mapManager) return [];
    const instance = this.buildingInstances.find(
      (i) => i.instanceId === farmInstanceId
    );
    if (!instance) return [];

    const map = this.mapManager.getMapRef();
    const { tiles, width, height } = map;

    // Collect all occupied tiles from ALL building instances.
    const occupiedTiles = new Set<number>();
    for (const inst of this.buildingInstances) {
      for (let dy = 0; dy < inst.height; dy++) {
        for (let dx = 0; dx < inst.width; dx++) {
          occupiedTiles.add((inst.y + dy) * width + (inst.x + dx));
        }
      }
    }

    const result: Array<{ x: number; y: number }> = [];
    const playerZoneId = map.playerZoneId;
    const minTlX = Math.max(0, instance.x - range);
    const maxTlX = Math.min(width - 2, instance.x + instance.width + range - 2);
    const minTlY = Math.max(0, instance.y - range);
    const maxTlY = Math.min(
      height - 2,
      instance.y + instance.height + range - 2
    );

    for (let ty = minTlY; ty <= maxTlY; ty++) {
      for (let tx = minTlX; tx <= maxTlX; tx++) {
        if (
          occupiedTiles.has(ty * width + tx) ||
          occupiedTiles.has(ty * width + tx + 1) ||
          occupiedTiles.has((ty + 1) * width + tx) ||
          occupiedTiles.has((ty + 1) * width + tx + 1)
        ) {
          continue;
        }
        if (
          playerZoneId !== null &&
          (map.zones[ty][tx] !== playerZoneId ||
            map.zones[ty][tx + 1] !== playerZoneId ||
            map.zones[ty + 1][tx] !== playerZoneId ||
            map.zones[ty + 1][tx + 1] !== playerZoneId)
        ) {
          continue;
        }
        if (
          tiles[ty][tx] === 'plains' &&
          tiles[ty][tx + 1] === 'plains' &&
          tiles[ty + 1][tx] === 'plains' &&
          tiles[ty + 1][tx + 1] === 'plains'
        ) {
          result.push({ x: tx, y: ty });
        }
      }
    }
    return result;
  }

  /**
   * Counts how many 2×2 field blocks are within `range` tiles of the given
   * farm building instance. Each block of 4 contiguous field tiles counts
   * as one field → +3 Food/turn.
   */
  getFarmFieldCount(farmInstanceId: string, range: number): number {
    if (!this.mapManager) return 0;
    const instance = this.buildingInstances.find(
      (i) => i.instanceId === farmInstanceId
    );
    if (!instance) return 0;

    const map = this.mapManager.getMapRef();
    const { tiles, width, height } = map;

    // Count individual field tiles in range and divide by 4.
    const minX = Math.max(0, instance.x - range);
    const maxX = Math.min(width - 1, instance.x + instance.width - 1 + range);
    const minY = Math.max(0, instance.y - range);
    const maxY = Math.min(height - 1, instance.y + instance.height - 1 + range);

    let fieldTileCount = 0;
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (tiles[ty][tx] === 'field') fieldTileCount++;
      }
    }
    return Math.floor(fieldTileCount / 4);
  }

  /**
   * Finds the farm building instance whose field range (2 tiles from borders)
   * contains the given tile and is closest to it. Used for field-tile click
   * selection.
   */
  getFarmInstanceForFieldTile(
    tileX: number,
    tileY: number
  ): StateBuildingInstance | undefined {
    const FIELD_RANGE = 2;
    let best: StateBuildingInstance | undefined;
    let bestDistSq = Infinity;
    for (const inst of this.buildingInstances) {
      if (inst.buildingId !== 'farm') continue;
      const minX = inst.x - FIELD_RANGE;
      const maxX = inst.x + inst.width - 1 + FIELD_RANGE;
      const minY = inst.y - FIELD_RANGE;
      const maxY = inst.y + inst.height - 1 + FIELD_RANGE;
      if (tileX < minX || tileX > maxX || tileY < minY || tileY > maxY) {
        continue;
      }
      const cx = inst.x + inst.width / 2;
      const cy = inst.y + inst.height / 2;
      const dx = tileX + 0.5 - cx;
      const dy = tileY + 0.5 - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = inst;
      }
    }
    return best;
  }

  /**
   * Converts a 2×2 block at (tileX, tileY) to field tiles, syncs state and
   * bumps the buildings version so the map re-renders.
   */
  placeFarmField(tileX: number, tileY: number, farmInstanceId: string): void {
    if (!this.mapManager) return;
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        this.mapManager.setTile(tileX + dx, tileY + dy, 'field');
      }
    }
    this.incrementActionUsage(farmInstanceId, 'sow-field');
    this.syncStateWithMapSummary();
    this.buildingsVersion++;
  }

  private syncStateWithMapSummary(): void {
    if (!this.mapManager) {
      return;
    }

    const summary = this.mapManager.getPlayerStateSummary();
    this.stateBridge.applyMapSummary(summary);
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

  private incrementActionUsage(instanceId: string, actionId: string): void {
    const key = `${instanceId}:${actionId}`;
    this.actionUsesThisTurn.set(
      key,
      (this.actionUsesThisTurn.get(key) ?? 0) + 1
    );
  }

  private expandPlayerBorders(): boolean {
    if (!this.mapManager) {
      return false;
    }

    const status = this.getExpandBorderStatus();
    if (!status.activatable || !status.candidates) {
      return false;
    }

    const map = this.mapManager.getMapRef() as MapData;
    const playerZoneId = map.playerZoneId;
    if (playerZoneId === null) {
      return false;
    }

    for (const cell of status.candidates) {
      map.zones[cell.y][cell.x] = playerZoneId;
    }

    this.syncStateWithMapSummary();
    return true;
  }

  private getExpandBorderStatus(): StateBuildingActionStatus & {
    candidates?: BuildingMapCell[];
  } {
    if (!this.mapManager) {
      return {
        activatable: false,
        reason: 'Map is unavailable for expansion.',
      };
    }

    const map = this.mapManager.getMapRef();
    const playerZoneId = map.playerZoneId;
    if (playerZoneId === null) {
      return {
        activatable: false,
        reason: 'No player zone to expand.',
      };
    }

    const zoneCells: BuildingMapCell[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.zones[y][x] === playerZoneId) {
          zoneCells.push({ x, y });
        }
      }
    }

    if (zoneCells.length === 0) {
      return {
        activatable: false,
        reason: 'No player zone to expand.',
      };
    }

    const zoneKeys = new Set<string>(
      zoneCells.map((cell) => `${cell.x},${cell.y}`)
    );
    const candidatesByKey = new Map<string, BuildingMapCell>();
    let blockedByEdge = false;
    let blockedByOcean = false;

    for (const cell of zoneCells) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const nx = cell.x + dx;
          const ny = cell.y + dy;
          if (!this.isInsideMap(nx, ny, map.width, map.height)) {
            blockedByEdge = true;
            continue;
          }

          if (map.tiles[ny][nx] === 'ocean') {
            blockedByOcean = true;
            continue;
          }

          const key = `${nx},${ny}`;
          if (!zoneKeys.has(key)) {
            candidatesByKey.set(key, { x: nx, y: ny });
          }
        }
      }
    }

    const candidates = Array.from(candidatesByKey.values());
    if (candidates.length === 0) {
      if (blockedByEdge && blockedByOcean) {
        return {
          activatable: false,
          reason: 'Cannot expand: all sides are blocked by map edge or ocean.',
        };
      }
      if (blockedByEdge) {
        return {
          activatable: false,
          reason: 'Cannot expand: all available sides hit map edge.',
        };
      }
      if (blockedByOcean) {
        return {
          activatable: false,
          reason: 'Cannot expand: all available sides are ocean.',
        };
      }
      return {
        activatable: false,
        reason: 'No tiles available to expand.',
      };
    }

    return {
      activatable: true,
      candidates,
    };
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
        : (this.getCastleCenter() ?? this.getZoneCenter(map, map.playerZoneId));
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

  private findPlacementAt(
    buildingId: StateBuildingId,
    x: number,
    y: number,
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

    if (
      x < 0 ||
      y < 0 ||
      x > map.width - definition.placementRule.width ||
      y > map.height - definition.placementRule.height
    ) {
      return undefined;
    }

    const anchor =
      buildingId === 'castle'
        ? this.getZoneCenter(map, map.playerZoneId)
        : (this.getCastleCenter() ?? this.getZoneCenter(map, map.playerZoneId));
    const occupied = this.collectOccupiedCells();

    return this.evaluatePlacementCandidate(
      map,
      x,
      y,
      definition,
      occupied,
      map.playerZoneId,
      allowTerrainReplacement,
      anchor
    );
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
    const replacementCells: BuildingMapCell[] = [];
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

  private getZoneCenter(
    map: Readonly<MapData>,
    zoneId: number
  ): {
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

  private isInsideMap(
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    return x >= 0 && x < width && y >= 0 && y < height;
  }
}
