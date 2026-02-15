import { SeededRandom } from '../_common/random';
import { BuildingManager } from './BuildingManager';
import { MapManager } from './MapManager';
import { ResearchManager } from './ResearchManager';
import { ResourceManager } from './ResourceManager';
import { RulerManager } from './RulerManager';
import { StateManager } from './StateManager';

export type PlayerData = {
  race: 'human' | 'elf' | 'dwarf' | 'orc';
  resources: {
    gold: number;
    materials: number;
    food: number;
    population: number;
  };
};

export type GameManagerOptions = {
  playerData: PlayerData;
  map?: {
    width?: number;
    height?: number;
  };
  /** Optional seed for reproducible randomness across all managers. */
  seed?: number;
};

/**
 * High-level game state manager.
 * Resource manipulation is delegated to ResourceManager.
 */
export class GameManager {
  playerData: PlayerData;
  resourceManager: ResourceManager;
  rulerManager: RulerManager;
  stateManager: StateManager;
  buildingManager: BuildingManager;
  mapManager: MapManager;
  researchManager: ResearchManager;
  readonly rng: SeededRandom;

  constructor(options: GameManagerOptions) {
    this.playerData = options.playerData;
    this.rng = new SeededRandom(options.seed);

    this.resourceManager = new ResourceManager({
      initial: options.playerData.resources,
    });

    // Ruler is generated at the beginning of the game.
    this.rulerManager = new RulerManager({ rng: this.rng });
    this.mapManager = new MapManager({ ...options.map, rng: this.rng });
    const playerState = this.mapManager.getPlayerStateSummary();
    this.stateManager = new StateManager({
      rng: this.rng,
      initial: {
        tiles: {
          forest: playerState.tiles.forest,
          stone: playerState.tiles.stone,
          plains: playerState.tiles.plains,
          river: playerState.tiles.river,
        },
        ocean: playerState.ocean,
      },
    });
    this.buildingManager = new BuildingManager({
      mapManager: this.mapManager,
      rng: this.rng,
      stateBridge: {
        getStateRef: () => this.stateManager.getStateRef(),
        applyMapSummary: (summary) => this.stateManager.applyMapSummary(summary),
      },
    });
    this.researchManager = new ResearchManager(this.buildingManager);
  }

  logData() {
    console.log('Player Data:', this.playerData);
    console.log('Resources:', this.resourceManager.getAllResources());
    console.log('Ruler:', this.rulerManager.getRuler());
    console.log('State:', this.stateManager.getState());
    console.log('Map size:', {
      width: this.mapManager.getMapRef().width,
      height: this.mapManager.getMapRef().height,
    });
  }
}
