import type {
  ResourceCost,
  ResourceManager,
  ResourceType,
} from './ResourceManager';

export type StateTiles = {
  forest: number;
  stone: number;
  plains: number;
  water: number;
};

export type StateData = {
  name: string;
  size: number;
  tiles: StateTiles;
};

export type TechnologyId = string;

export type StateBuildingId = 'lumbermill' | 'mine' | 'granary' | 'harbor';

interface BuildingActionContext {
  state: Readonly<StateData>;
  resources: ResourceManager;
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
  description: string;
  buildCost: ResourceCost;
  requiredTechnologies: TechnologyId[];
  getStats: (state: Readonly<StateData>) => string[];
  actions: StateBuildingActionDefinition[];
}

export interface StateBuildingBuildStatus {
  buildable: boolean;
  missingResources: ResourceCost;
  missingTechnologies: TechnologyId[];
}

const stateBuildingDefinitions: Record<StateBuildingId, StateBuildingDefinition> =
  {
    lumbermill: {
      id: 'lumbermill',
      name: 'Lumbermill',
      description:
        'Processes timber from surrounding forests into construction-grade materials.',
      buildCost: {
        gold: 35,
        materials: 20,
      },
      requiredTechnologies: [],
      getStats: (state) => {
        const baseYield = Math.max(1, Math.floor(state.tiles.forest / 4));
        return [
          `Forests: ${state.tiles.forest}`,
          `Action yield: +${baseYield} Materials`,
        ];
      },
      actions: [
        {
          id: 'process-timber',
          name: 'Process Timber',
          description:
            'Convert nearby timber supply into materials based on forest tiles.',
          run: ({ state, resources }) => {
            const gain = Math.max(1, Math.floor(state.tiles.forest / 4));
            resources.addResource('materials', gain);
          },
        },
      ],
    },
    mine: {
      id: 'mine',
      name: 'Mine',
      description:
        'Extracts ore and stone from rocky terrain, improving material throughput.',
      buildCost: {
        gold: 45,
        materials: 30,
      },
      requiredTechnologies: [],
      getStats: (state) => {
        const baseYield = Math.max(1, Math.floor(state.tiles.stone / 3));
        return [`Stone tiles: ${state.tiles.stone}`, `Action yield: +${baseYield} Materials`];
      },
      actions: [
        {
          id: 'extract-ore',
          name: 'Extract Ore',
          description: 'Mine stone deposits and add materials to your stockpile.',
          run: ({ state, resources }) => {
            const gain = Math.max(1, Math.floor(state.tiles.stone / 3));
            resources.addResource('materials', gain);
          },
        },
      ],
    },
    granary: {
      id: 'granary',
      name: 'Granary',
      description:
        'Stores and preserves food gathered from fertile plains for future turns.',
      buildCost: {
        gold: 40,
        materials: 24,
      },
      requiredTechnologies: ['agriculture'],
      getStats: (state) => {
        const baseYield = Math.max(1, Math.floor(state.tiles.plains / 5));
        return [
          `Plains: ${state.tiles.plains}`,
          `Action yield: +${baseYield} Food`,
          'Requires technology: agriculture',
        ];
      },
      actions: [
        {
          id: 'gather-harvest',
          name: 'Gather Harvest',
          description: 'Collect and store harvest from plains tiles.',
          run: ({ state, resources }) => {
            const gain = Math.max(1, Math.floor(state.tiles.plains / 5));
            resources.addResource('food', gain);
          },
        },
      ],
    },
    harbor: {
      id: 'harbor',
      name: 'Harbor',
      description:
        'Organizes maritime trade from coast and rivers to improve gold income.',
      buildCost: {
        gold: 60,
        materials: 40,
      },
      requiredTechnologies: ['sailing'],
      getStats: (state) => {
        const baseYield = Math.max(1, Math.floor(state.tiles.water / 4));
        return [
          `Water tiles: ${state.tiles.water}`,
          `Action yield: +${baseYield} Gold`,
          'Requires technology: sailing',
        ];
      },
      actions: [
        {
          id: 'run-trade-route',
          name: 'Run Trade Route',
          description: 'Generate gold from maritime trade volume.',
          run: ({ state, resources }) => {
            const gain = Math.max(1, Math.floor(state.tiles.water / 4));
            resources.addResource('gold', gain);
          },
        },
      ],
    },
  };

function createEmptyBuildingRecord(): Record<StateBuildingId, boolean> {
  return {
    lumbermill: false,
    mine: false,
    granary: false,
    harbor: false,
  };
}

export interface StateManagerOptions {
  initial?: Partial<Omit<StateData, 'size' | 'tiles'>> & {
    tiles?: Partial<StateTiles>;
    technologies?: TechnologyId[];
    builtBuildings?: Partial<Record<StateBuildingId, boolean>>;
  };
}

/**
 * Manages state data, buildings, and unlocked technologies.
 */
export class StateManager {
  private state: StateData;
  private builtBuildings: Record<StateBuildingId, boolean>;
  private unlockedTechnologies = new Set<TechnologyId>();

  constructor(options: StateManagerOptions = {}) {
    this.state = this.generateState(options.initial);
    this.builtBuildings = createEmptyBuildingRecord();
    this.applyProgress(options.initial);
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
    this.builtBuildings = createEmptyBuildingRecord();
    this.applyProgress(initial);
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
    return { ...this.builtBuildings };
  }

  isBuildingBuilt(id: StateBuildingId): boolean {
    return this.builtBuildings[id] === true;
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
    if (!definition || this.isBuildingBuilt(id)) {
      return {
        buildable: false,
        missingResources: {},
        missingTechnologies: [],
      };
    }

    const missingResources = this.getMissingResources(
      definition.buildCost,
      resources
    );
    const missingTechnologies = definition.requiredTechnologies.filter(
      (tech) => !this.isTechnologyUnlocked(tech)
    );

    return {
      buildable:
        Object.keys(missingResources).length === 0 &&
        missingTechnologies.length === 0,
      missingResources,
      missingTechnologies,
    };
  }

  buildBuilding(id: StateBuildingId, resources: ResourceManager): boolean {
    const definition = this.getBuildingDefinition(id);
    if (!definition || this.isBuildingBuilt(id)) {
      return false;
    }

    const status = this.canBuildBuilding(id, resources);
    if (!status.buildable) {
      return false;
    }

    if (!resources.spendResources(definition.buildCost)) {
      return false;
    }

    this.builtBuildings[id] = true;
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

    action.run({
      state: this.state,
      resources,
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

    const initialBuilt = initial?.builtBuildings;
    if (!initialBuilt) {
      return;
    }

    for (const id of Object.keys(this.builtBuildings) as StateBuildingId[]) {
      this.builtBuildings[id] = initialBuilt[id] === true;
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
    const size = this.sumTiles(tiles);
    return { name, size, tiles };
  }

  private generateTiles(initial?: Partial<StateTiles>): StateTiles {
    return {
      forest: this.clamp(initial?.forest ?? this.randomInt(8, 40), 0),
      stone: this.clamp(initial?.stone ?? this.randomInt(4, 28), 0),
      plains: this.clamp(initial?.plains ?? this.randomInt(10, 48), 0),
      water: this.clamp(initial?.water ?? this.randomInt(2, 24), 0),
    };
  }

  private sumTiles(tiles: StateTiles): number {
    return tiles.forest + tiles.stone + tiles.plains + tiles.water;
  }

  private recomputeSize(): void {
    this.state.size = this.sumTiles(this.state.tiles);
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
