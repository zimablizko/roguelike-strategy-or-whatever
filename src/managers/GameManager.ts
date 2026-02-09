import { ResourceManager } from './ResourceManager';
import { RulerManager } from './RulerManager';

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
};

/**
 * High-level game state manager.
 * Resource manipulation is delegated to ResourceManager.
 */
export class GameManager {
  playerData: PlayerData;
  resourceManager: ResourceManager;
  rulerManager: RulerManager;

  constructor(options: GameManagerOptions) {
    this.playerData = options.playerData;
    this.resourceManager = new ResourceManager({
      initial: options.playerData.resources,
    });

    // Ruler is generated at the beginning of the game.
    this.rulerManager = new RulerManager();
  }

  logData() {
    console.log('Player Data:', this.playerData);
    console.log('Resources:', this.resourceManager.getAllResources());
    console.log('Ruler:', this.rulerManager.getRuler());
  }
}
