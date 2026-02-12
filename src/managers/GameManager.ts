import { MapManager } from './MapManager';
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
  mapManager: MapManager;

  constructor(options: GameManagerOptions) {
    this.playerData = options.playerData;
    this.resourceManager = new ResourceManager({
      initial: options.playerData.resources,
    });

    // Ruler is generated at the beginning of the game.
    this.rulerManager = new RulerManager();
    this.mapManager = new MapManager(options.map);
    const playerState = this.mapManager.getPlayerStateSummary();
    this.stateManager = new StateManager({
      mapManager: this.mapManager,
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
