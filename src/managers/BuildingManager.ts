import { clamp } from '../_common/math';
import type {
  BuildingActionProgress,
  BuildingManagerOptions,
  BuildingManagerStateBridge,
  BuildingMapCell,
  BuildingTileChange,
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
import type { UnitRole } from '../_common/models/military.models';
import type {
  ResourceCost,
  ResourceType,
} from '../_common/models/resource.models';
import type { EndTurnIncomePulse } from '../_common/models/turn.models';
import { SeededRandom } from '../_common/random';
import {
  createEmptyBuildingRecord,
  stateBuildingDefinitions,
} from '../data/buildings';
import { getUnitDefinition } from '../data/military';
import {
  rareResourceDefinitions,
  type RareResourceId,
} from '../data/rareResources';
import type { GameLogManager } from './GameLogManager';
import { MapManager } from './MapManager';
import type { MilitaryManager } from './MilitaryManager';
import type { ResourceManager } from './ResourceManager';

export class BuildingManager {
  private readonly mapManager?: MapManager;
  private readonly stateBridge: BuildingManagerStateBridge;
  private readonly rng: SeededRandom;
  private buildingCounts: Record<StateBuildingId, number>;
  private buildingInstances: StateBuildingInstance[] = [];
  private actionProgresses: BuildingActionProgress[] = [];
  private buildingInstanceSerial = 0;
  private buildingsVersion = 0;
  private unlockedTechnologies = new Set<TechnologyId>();
  private additionalOccupiedPopulationProvider: () => number = () => 0;
  private readonly logManager?: GameLogManager;
  private onTileChanged?: (change: BuildingTileChange) => void;
  /** Tracks how many times each action has been used this turn. Key: "instanceId:actionId". */
  private actionUsesThisTurn = new Map<string, number>();

  constructor(options: BuildingManagerOptions) {
    this.mapManager = options.mapManager;
    this.stateBridge = options.stateBridge;
    this.rng = options.rng ?? new SeededRandom();
    this.logManager = options.logManager;
    this.onTileChanged = options.onTileChanged;
    this.buildingCounts = createEmptyBuildingRecord();
    this.applyProgress(options.initial);
    this.ensureStartingCastle();
    this.syncStateWithMapSummary();
  }

  regenerate(initial?: BuildingManagerOptions['initial']): void {
    this.buildingCounts = createEmptyBuildingRecord();
    this.buildingInstances = [];
    this.actionProgresses = [];
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

  getBuildingActionProgresses(): BuildingActionProgress[] {
    return this.actionProgresses.map((progress) => ({ ...progress }));
  }

  getBuildingActionProgress(
    instanceId: string,
    actionId: string
  ): BuildingActionProgress | undefined {
    const progress = this.actionProgresses.find(
      (item) => item.instanceId === instanceId && item.actionId === actionId
    );
    return progress ? { ...progress } : undefined;
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

  setAdditionalOccupiedPopulationProvider(
    provider: (() => number) | undefined
  ) {
    this.additionalOccupiedPopulationProvider = provider ?? (() => 0);
    this.buildingsVersion++;
  }

  setTileChangeListener(
    listener: ((change: BuildingTileChange) => void) | undefined
  ): void {
    this.onTileChanged = listener;
  }

  /**
   * Advances construction progress for all in-progress building instances by one turn.
   * Buildings whose `turnsRemaining` reaches 0 become fully operational.
   * Call this once per end-turn cycle.
   */
  advanceBuildingConstruction(): void {
    let changed = false;
    for (const instance of this.buildingInstances) {
      if (
        instance.turnsRemaining !== undefined &&
        instance.turnsRemaining > 0
      ) {
        instance.turnsRemaining--;
        if (instance.turnsRemaining === 0) {
          instance.turnsRemaining = undefined;
          const definition = this.getBuildingDefinition(instance.buildingId);
          if (definition) {
            this.logManager?.addGood(
              `${definition.name} construction finished.`
            );
          }
        }
        changed = true;
      }
    }
    if (changed) {
      this.buildingsVersion++;
      this.syncStateWithMapSummary();
    }
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
   * Only completed (non-in-progress) buildings count.
   */
  getTotalPopulation(): number {
    let total = 0;
    for (const instance of this.buildingInstances) {
      if (instance.turnsRemaining !== undefined && instance.turnsRemaining > 0)
        continue;
      const definition = this.getBuildingDefinition(instance.buildingId);
      if (definition?.populationProvided) {
        total += definition.populationProvided;
      }
    }
    return total;
  }

  /**
   * Population occupied by all buildings with `populationRequired`.
   * Only completed (non-in-progress) buildings count.
   */
  getOccupiedPopulation(): number {
    let occupied = 0;
    for (const instance of this.buildingInstances) {
      if (instance.turnsRemaining !== undefined && instance.turnsRemaining > 0)
        continue;
      const definition = this.getBuildingDefinition(instance.buildingId);
      if (definition?.populationRequired) {
        occupied += definition.populationRequired;
      }
    }
    occupied += Math.max(0, this.additionalOccupiedPopulationProvider());
    return occupied;
  }

  advanceBuildingActionProgress(
    militaryManager?: MilitaryManager
  ): EndTurnIncomePulse[] {
    const pulses: EndTurnIncomePulse[] = [];
    const remaining: BuildingActionProgress[] = [];
    let changed = false;

    for (const progress of this.actionProgresses) {
      const nextTurnsLeft = progress.turnsLeft - 1;
      if (nextTurnsLeft > 0) {
        remaining.push({ ...progress, turnsLeft: nextTurnsLeft });
        changed = true;
        continue;
      }

      changed = true;
      if (militaryManager) {
        militaryManager.addUnits(
          progress.unitId,
          progress.unitCount,
          'available'
        );
      }
      const instance = this.buildingInstances.find(
        (item) => item.instanceId === progress.instanceId
      );
      if (instance) {
        const buildingDefinition = this.getBuildingDefinition(
          progress.buildingId
        );
        const buildingName = buildingDefinition?.name ?? 'Building';
        this.logManager?.addGood(
          `${this.getUnitPulseLabel(progress.unitId)} training completed at ${buildingName} (+${progress.unitCount}).`
        );
        pulses.push(
          this.createUnitPulse(
            instance,
            progress.unitCount,
            this.getUnitPulseLabel(progress.unitId)
          )
        );
      }
    }

    this.actionProgresses = remaining;
    if (changed) {
      this.buildingsVersion++;
    }
    return pulses;
  }

  /**
   * Returns the total rare-resource passive income bonus for a specific
   * building instance, grouped by resource type. Ranges are scaled by the
   * number of matching tiles (e.g. 2 golden-ore tiles = +10 Gold).
   */
  getRareResourceBonusForInstance(
    instanceId: string
  ): Array<{ resourceType: ResourceType; amount: number | string }> {
    if (!this.mapManager) return [];
    const instance = this.buildingInstances.find(
      (i) => i.instanceId === instanceId
    );
    if (!instance) return [];
    const rareResources = this.mapManager.getMapRef().rareResources;
    // Accumulate per (resourceType, rawAmount) → count
    const counts = new Map<
      string,
      { resourceType: ResourceType; rawAmount: number | string; count: number }
    >();
    for (let ty = instance.y; ty < instance.y + instance.height; ty++) {
      for (let tx = instance.x; tx < instance.x + instance.width; tx++) {
        const rr = rareResources[`${tx},${ty}`];
        if (!rr) continue;
        const def = rareResourceDefinitions[rr.resourceId as RareResourceId];
        if (!def || def.bonusBuilding !== instance.buildingId) continue;
        const key = `${def.bonus.resourceType}:${def.bonus.amount}`;
        const existing = counts.get(key);
        if (existing) {
          existing.count++;
        } else {
          counts.set(key, {
            resourceType: def.bonus.resourceType as ResourceType,
            rawAmount: def.bonus.amount,
            count: 1,
          });
        }
      }
    }
    return Array.from(counts.values()).map(
      ({ resourceType, rawAmount, count }) => {
        if (typeof rawAmount === 'string') {
          const parts = rawAmount.split(':');
          const min = parseInt(parts[1], 10) * count;
          const max = parseInt(parts[2], 10) * count;
          return { resourceType, amount: `random:${min}:${max}` };
        }
        return { resourceType, amount: rawAmount * count };
      }
    );
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
    const normalized = id.trim();
    if (this.unlockedTechnologies.has(normalized)) {
      return;
    }
    this.unlockedTechnologies.add(normalized);
    this.buildingsVersion++;
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

    const created = this.registerBuildingInstance(id, placement);
    const turnsRemaining = created.turnsRemaining ?? 0;
    this.logManager?.addNeutral(
      turnsRemaining > 0
        ? `Construction started: ${definition.name} (${turnsRemaining} turns).`
        : `${definition.name} has been built.`
    );
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

    const created = this.registerBuildingInstance(id, placement);
    const turnsRemaining = created.turnsRemaining ?? 0;
    this.logManager?.addNeutral(
      turnsRemaining > 0
        ? `Construction started: ${definition.name} (${turnsRemaining} turns).`
        : `${definition.name} has been built.`
    );
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

    const militaryAction = this.getMilitaryActionDefinition(
      buildingId,
      actionId
    );
    if (militaryAction) {
      if (!resources.spendResources(militaryAction.cost)) {
        return null;
      }

      this.actionProgresses.push({
        instanceId,
        buildingId,
        actionId,
        turnsLeft: militaryAction.duration,
        unitId: militaryAction.unitId,
        unitCount: this.rng.randomInt(
          militaryAction.minUnits,
          militaryAction.maxUnits
        ),
      });
      const queued = this.actionProgresses[this.actionProgresses.length - 1];
      const buildingName =
        this.getBuildingDefinition(buildingId)?.name ?? 'Building';
      this.logManager?.addNeutral(
        `${buildingName} started training ${queued.unitCount} ${this.getUnitPulseLabel(militaryAction.unitId)} (${militaryAction.duration} turns).`
      );
      this.incrementActionUsage(instanceId, actionId);
      this.buildingsVersion++;
      return [];
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
        const map = this.mapManager.getMapRef();
        const from = map.tiles[Math.floor(y)]?.[Math.floor(x)];
        this.mapManager.setTile(x, y, tile);
        this.onTileChanged?.({
          x: Math.floor(x),
          y: Math.floor(y),
          from,
          to: tile,
          source: 'building-action',
        });
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

    // Block actions on instances that are still under construction.
    const instance = this.buildingInstances.find(
      (i) => i.instanceId === instanceId
    );
    if (instance?.turnsRemaining !== undefined && instance.turnsRemaining > 0) {
      return {
        activatable: false,
        reason: `Under construction (${instance.turnsRemaining} turn${instance.turnsRemaining === 1 ? '' : 's'} remaining).`,
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

    const activeProgress = this.actionProgresses.find(
      (item) => item.instanceId === instanceId && item.actionId === actionId
    );
    if (activeProgress) {
      return {
        activatable: false,
        reason: `In progress (${activeProgress.turnsLeft} turn${activeProgress.turnsLeft === 1 ? '' : 's'} remaining).`,
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

    const militaryAction = this.getMilitaryActionDefinition(
      buildingId,
      actionId
    );
    if (militaryAction) {
      const siblingProgress = this.actionProgresses.find(
        (item) =>
          item.instanceId === instanceId &&
          item.buildingId === buildingId &&
          item.actionId !== actionId
      );
      if (siblingProgress) {
        return {
          activatable: false,
          reason: `Another action is already in progress (${siblingProgress.turnsLeft} turn${siblingProgress.turnsLeft === 1 ? '' : 's'} remaining).`,
          usesRemaining,
          usesMax,
        };
      }

      if (
        militaryAction.requiredTechnology &&
        !this.isTechnologyUnlocked(militaryAction.requiredTechnology)
      ) {
        return {
          activatable: false,
          reason: `Requires ${militaryAction.requiredTechnologyName}.`,
          usesRemaining,
          usesMax,
        };
      }

      if (this.getFreePopulation() < 1) {
        return {
          activatable: false,
          reason: 'Requires at least 1 free Population.',
          usesRemaining,
          usesMax,
        };
      }

      if (resources) {
        const missing = this.getMissingResources(
          militaryAction.cost,
          resources
        );
        const missingEntries = Object.entries(missing);
        if (missingEntries.length > 0) {
          return {
            activatable: false,
            reason: `Missing ${missingEntries
              .map(([resourceType, amount]) => `${amount} ${resourceType}`)
              .join(', ')}.`,
            usesRemaining,
            usesMax,
          };
        }
      }

      return { activatable: true, usesRemaining, usesMax };
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
    this.actionProgresses = [];
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
          turnsRemaining:
            typeof rawInstance.turnsRemaining === 'number' &&
            rawInstance.turnsRemaining > 0
              ? rawInstance.turnsRemaining
              : undefined,
          farmWorkMode: rawInstance.farmWorkMode,
          farmSowCooldown:
            typeof rawInstance.farmSowCooldown === 'number' &&
            rawInstance.farmSowCooldown > 0
              ? rawInstance.farmSowCooldown
              : undefined,
        });
        this.buildingCounts[rawInstance.buildingId] += 1;
      }

      const highestSerial = this.collectHighestBuildingInstanceSerial();
      const requestedSerial = clamp(
        Math.floor(initial.buildingInstanceSerial ?? 0),
        0
      );
      this.buildingInstanceSerial = Math.max(requestedSerial, highestSerial);
      this.actionProgresses = (initial.actionProgresses ?? [])
        .filter((progress) =>
          this.buildingInstances.some(
            (instance) => instance.instanceId === progress.instanceId
          )
        )
        .map((progress) => ({
          ...progress,
          turnsLeft: Math.max(1, Math.floor(progress.turnsLeft)),
          unitCount: Math.max(1, Math.floor(progress.unitCount)),
        }));
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

    this.registerBuildingInstance('castle', placement, true);
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
   * as one field → +3 Wheat on harvest.
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
        const from =
          this.mapManager.getMapRef().tiles[tileY + dy]?.[tileX + dx];
        this.mapManager.setTile(tileX + dx, tileY + dy, 'field');
        this.onTileChanged?.({
          x: tileX + dx,
          y: tileY + dy,
          from,
          to: 'field',
          source: 'field-placement',
        });
      }
    }
    this.incrementActionUsage(farmInstanceId, 'sow-field');
    this.syncStateWithMapSummary();
    this.buildingsVersion++;
    this.logManager?.addNeutral(
      `A new field was sown at (${tileX}, ${tileY}).`
    );
  }

  // ─── Farm work mode ───────────────────────────────────────────

  getFarmWorkMode(
    instanceId: string
  ): import('../_common/models/building-manager.models').FarmWorkMode {
    const instance = this.buildingInstances.find(
      (i) => i.instanceId === instanceId
    );
    return instance?.farmWorkMode ?? 'idle';
  }

  getFarmSowCooldown(instanceId: string): number {
    const instance = this.buildingInstances.find(
      (i) => i.instanceId === instanceId
    );
    return instance?.farmSowCooldown ?? 0;
  }

  setFarmWorkMode(
    instanceId: string,
    mode: import('../_common/models/building-manager.models').FarmWorkMode
  ): void {
    const instance = this.buildingInstances.find(
      (i) => i.instanceId === instanceId
    );
    if (!instance || instance.buildingId !== 'farm') return;
    instance.farmWorkMode = mode;
    this.buildingsVersion++;
  }

  /**
   * Returns true when Crop Rotation research is completed, enabling
   * double-harvest and reduced regrow time.
   */
  hasCropRotation(): boolean {
    return this.isTechnologyUnlocked('eco-crop-rotation');
  }

  /**
   * Processes automatic sow/harvest for all farms each turn.
   * Returns income pulses for harvest wheat gains.
   */
  processFarmWorkModes(excludeTiles?: Set<string>): EndTurnIncomePulse[] {
    const pulses: EndTurnIncomePulse[] = [];
    const hasCropRotation = this.hasCropRotation();
    const FIELD_RANGE = 2;
    const SOW_COOLDOWN = 3;

    for (const instance of this.buildingInstances) {
      if (instance.buildingId !== 'farm') continue;
      if (instance.turnsRemaining !== undefined && instance.turnsRemaining > 0)
        continue;

      const mode = instance.farmWorkMode ?? 'idle';

      // Always tick sow cooldown
      if (
        instance.farmSowCooldown !== undefined &&
        instance.farmSowCooldown > 0
      ) {
        instance.farmSowCooldown--;
      }

      if (mode === 'sow') {
        // Attempt to sow one field if cooldown is ready
        if ((instance.farmSowCooldown ?? 0) <= 0) {
          const placements = this.getAvailableFieldPlacements(
            instance.instanceId,
            FIELD_RANGE
          );
          if (placements.length > 0) {
            // Pick the closest placement to the farm center
            const cx = instance.x + instance.width / 2;
            const cy = instance.y + instance.height / 2;
            placements.sort((a, b) => {
              const da =
                (a.x + 1 - cx) * (a.x + 1 - cx) +
                (a.y + 1 - cy) * (a.y + 1 - cy);
              const db =
                (b.x + 1 - cx) * (b.x + 1 - cx) +
                (b.y + 1 - cy) * (b.y + 1 - cy);
              return da - db;
            });
            const chosen = placements[0];
            this.placeFarmFieldAuto(chosen.x, chosen.y);
            instance.farmSowCooldown = SOW_COOLDOWN;
          } else {
            // No more space — auto-switch to harvest
            instance.farmWorkMode = 'harvest';
          }
        }
      } else if (mode === 'harvest') {
        // Harvest random ready field(s) near this farm
        const harvestCount = hasCropRotation ? 2 : 1;
        const readyFields = this.getReadyFieldsNearFarm(
          instance,
          FIELD_RANGE,
          excludeTiles
        );
        if (readyFields.length > 0) {
          // Shuffle and pick up to harvestCount 2×2 blocks
          const blocks = this.groupFieldBlocks(readyFields);
          const toHarvest = Math.min(harvestCount, blocks.length);
          // Shuffle blocks
          for (let i = blocks.length - 1; i > 0; i--) {
            const j = this.rng.randomInt(0, i);
            [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
          }
          let totalWheat = 0;
          for (let i = 0; i < toHarvest; i++) {
            const block = blocks[i];
            const yield_ = this.rng.randomInt(8, 10);
            totalWheat += yield_;
            for (const tile of block) {
              if (this.mapManager) {
                const from =
                  this.mapManager.getMapRef().tiles[tile.y]?.[tile.x];
                this.mapManager.setTile(tile.x, tile.y, 'field-empty');
                this.onTileChanged?.({
                  x: tile.x,
                  y: tile.y,
                  from,
                  to: 'field-empty',
                  source: 'building-action',
                });
              }
            }
          }
          if (totalWheat > 0) {
            pulses.push({
              tileX: instance.x + (instance.width - 1) / 2,
              tileY: instance.y + (instance.height - 1) / 2,
              resourceType: 'wheat',
              amount: totalWheat,
            });
          }
        }
      }
    }

    if (pulses.length > 0) {
      this.syncStateWithMapSummary();
      this.buildingsVersion++;
    }
    return pulses;
  }

  /**
   * Places a field automatically (no action usage tracking needed since it's
   * passive). Used by the sow work mode.
   */
  private placeFarmFieldAuto(tileX: number, tileY: number): void {
    if (!this.mapManager) return;
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const from =
          this.mapManager.getMapRef().tiles[tileY + dy]?.[tileX + dx];
        this.mapManager.setTile(tileX + dx, tileY + dy, 'field');
        this.onTileChanged?.({
          x: tileX + dx,
          y: tileY + dy,
          from,
          to: 'field',
          source: 'field-placement',
        });
      }
    }
    this.syncStateWithMapSummary();
    this.buildingsVersion++;
  }

  private getReadyFieldsNearFarm(
    instance: StateBuildingInstance,
    range: number,
    excludeTiles?: Set<string>
  ): Array<{ x: number; y: number }> {
    if (!this.mapManager) return [];
    const map = this.mapManager.getMapRef();
    const result: Array<{ x: number; y: number }> = [];
    const minX = Math.max(0, instance.x - range);
    const maxX = Math.min(
      map.width - 1,
      instance.x + instance.width - 1 + range
    );
    const minY = Math.max(0, instance.y - range);
    const maxY = Math.min(
      map.height - 1,
      instance.y + instance.height - 1 + range
    );
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (
          map.tiles[ty][tx] === 'field' &&
          !excludeTiles?.has(`${tx},${ty}`)
        ) {
          result.push({ x: tx, y: ty });
        }
      }
    }
    return result;
  }

  /**
   * Groups individual field tiles into 2×2 blocks for harvest purposes.
   * Each block contains exactly 4 tiles forming a contiguous 2×2 area.
   */
  private groupFieldBlocks(
    tiles: Array<{ x: number; y: number }>
  ): Array<Array<{ x: number; y: number }>> {
    const tileSet = new Set(tiles.map((t) => `${t.x},${t.y}`));
    const used = new Set<string>();
    const blocks: Array<Array<{ x: number; y: number }>> = [];

    for (const tile of tiles) {
      const key = `${tile.x},${tile.y}`;
      if (used.has(key)) continue;

      // Check if this tile is the top-left corner of a 2×2 block
      const r = `${tile.x + 1},${tile.y}`;
      const b = `${tile.x},${tile.y + 1}`;
      const br = `${tile.x + 1},${tile.y + 1}`;
      if (
        tileSet.has(r) &&
        tileSet.has(b) &&
        tileSet.has(br) &&
        !used.has(r) &&
        !used.has(b) &&
        !used.has(br)
      ) {
        used.add(key);
        used.add(r);
        used.add(b);
        used.add(br);
        blocks.push([
          tile,
          { x: tile.x + 1, y: tile.y },
          { x: tile.x, y: tile.y + 1 },
          { x: tile.x + 1, y: tile.y + 1 },
        ]);
      }
    }
    return blocks;
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
    placement: PlacementCandidate,
    instant = false
  ): StateBuildingInstance {
    this.buildingInstanceSerial++;
    const definition = this.getBuildingDefinition(id);
    const buildingTime = !instant ? (definition?.buildingTime ?? 0) : 0;
    const instance: StateBuildingInstance = {
      instanceId: `${id}-${this.buildingInstanceSerial}`,
      buildingId: id,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      turnsRemaining: buildingTime > 0 ? buildingTime : undefined,
    };
    this.buildingInstances.push(instance);
    this.buildingCounts[id] += 1;
    this.buildingsVersion++;
    return instance;
  }

  private incrementActionUsage(instanceId: string, actionId: string): void {
    const key = `${instanceId}:${actionId}`;
    this.actionUsesThisTurn.set(
      key,
      (this.actionUsesThisTurn.get(key) ?? 0) + 1
    );
  }

  private getMilitaryActionDefinition(
    buildingId: StateBuildingId,
    actionId: string
  ):
    | {
        cost: ResourceCost;
        duration: number;
        unitId: UnitRole;
        minUnits: number;
        maxUnits: number;
        requiredTechnology?: TechnologyId;
        requiredTechnologyName?: string;
      }
    | undefined {
    if (buildingId === 'barracks' && actionId === 'train-footmen') {
      return {
        cost: { gold: 50 },
        duration: 2,
        unitId: 'footman',
        minUnits: 3,
        maxUnits: 5,
      };
    }
    if (buildingId === 'barracks' && actionId === 'train-archers') {
      return {
        cost: { gold: 75, wood: 25 },
        duration: 2,
        unitId: 'archer',
        minUnits: 3,
        maxUnits: 5,
        requiredTechnology: 'mil-fletching',
        requiredTechnologyName: 'Fletching',
      };
    }
    if (buildingId === 'castle' && actionId === 'call-to-arms') {
      return {
        cost: { gold: 10 },
        duration: 1,
        unitId: 'militia',
        minUnits: 4,
        maxUnits: 6,
      };
    }
    return undefined;
  }

  private createUnitPulse(
    instance: StateBuildingInstance,
    amount: number,
    unitLabel: string
  ): EndTurnIncomePulse {
    return {
      tileX: instance.x + (instance.width - 1) / 2,
      tileY: instance.y + (instance.height - 1) / 2,
      label: `+${amount} ${unitLabel}`,
      colorHex: '#9fe6aa',
    };
  }

  private getUnitPulseLabel(unitId: UnitRole): string {
    return getUnitDefinition(unitId)?.name ?? unitId;
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
}
