import { SeededRandom } from '../_common/random';
import type {
  GameManagerOptions,
  PlayerData,
} from '../_common/models/game.models';
import type { GameSaveData } from '../_common/models/save.models';
import { BuildingManager } from './BuildingManager';
import { MapManager } from './MapManager';
import { ResearchManager } from './ResearchManager';
import { ResourceManager } from './ResourceManager';
import { RulerManager } from './RulerManager';
import { StateManager } from './StateManager';

/**
 * High-level game state manager.
 * Resource manipulation is delegated to ResourceManager.
 */
export class GameManager {
  private static readonly DEFAULT_PLAYER_DATA: PlayerData = {
    race: 'human',
    resources: {
      gold: 100,
      materials: 50,
      food: 75,
      population: 10,
    },
  };

  playerData: PlayerData;
  resourceManager: ResourceManager;
  rulerManager: RulerManager;
  stateManager: StateManager;
  buildingManager: BuildingManager;
  mapManager: MapManager;
  researchManager: ResearchManager;
  readonly rng: SeededRandom;

  constructor(options: GameManagerOptions) {
    const saveData = options.saveData;
    this.playerData =
      saveData?.playerData ?? options.playerData ?? GameManager.DEFAULT_PLAYER_DATA;
    this.rng = new SeededRandom(saveData?.rngState ?? options.seed);

    this.resourceManager = new ResourceManager({
      initial: saveData?.resources ?? this.playerData.resources,
    });

    this.rulerManager = new RulerManager({
      rng: this.rng,
      initial: saveData?.ruler
        ? {
            name: saveData.ruler.name,
            age: saveData.ruler.age,
            popularity: saveData.ruler.popularity,
          }
        : undefined,
    });

    this.mapManager = new MapManager(
      saveData
        ? {
            rng: this.rng,
            initialMap: saveData.map,
          }
        : { ...options.map, rng: this.rng }
    );

    const playerState = saveData?.state ?? this.mapManager.getPlayerStateSummary();
    this.stateManager = new StateManager({
      rng: this.rng,
      initial: {
        name: saveData?.state.name,
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
      initial: saveData?.buildings
        ? {
            technologies: saveData.buildings.technologies,
            builtBuildings: saveData.buildings.counts,
            buildingInstances: saveData.buildings.instances,
            buildingInstanceSerial: saveData.buildings.instanceSerial,
          }
        : undefined,
    });
    this.researchManager = new ResearchManager(this.buildingManager, {
      initial: saveData?.research
        ? {
            activeResearch: saveData.research.activeResearch,
            completedResearches: saveData.research.completedResearches,
            latestCompletion: saveData.research.latestCompletion,
            researchVersion: saveData.research.researchVersion,
          }
        : undefined,
    });

    if (saveData) {
      this.rng.setState(saveData.rngState);
    }
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

  getSnapshot(turnData: GameSaveData['turn']): GameSaveData {
    const map = this.mapManager.getMapRef();
    const ruler = this.rulerManager.getRulerRef();
    const state = this.stateManager.getStateRef();

    return {
      version: 1,
      savedAt: Date.now(),
      playerData: {
        race: this.playerData.race,
        resources: this.resourceManager.getAllResources(),
      },
      rngState: this.rng.getState(),
      map: {
        width: map.width,
        height: map.height,
        tiles: map.tiles.map((row) => row.slice()),
        zones: map.zones.map((row) => row.slice()),
        zoneCount: map.zoneCount,
        playerZoneId: map.playerZoneId,
        rareResources: { ...map.rareResources },
      },
      resources: this.resourceManager.getAllResources(),
      ruler: {
        name: ruler.name,
        age: ruler.age,
        popularity: ruler.popularity,
      },
      state: {
        name: state.name,
        size: state.size,
        ocean: state.ocean,
        tiles: {
          forest: state.tiles.forest,
          stone: state.tiles.stone,
          plains: state.tiles.plains,
          river: state.tiles.river,
        },
      },
      buildings: {
        counts: this.buildingManager.getBuildingCounts(),
        instances: this.buildingManager.getBuildingInstances(),
        instanceSerial: this.buildingManager.getBuildingInstanceSerial(),
        technologies: this.buildingManager.getUnlockedTechnologies(),
      },
      research: {
        activeResearch: this.researchManager.getActiveResearchState(),
        completedResearches: this.researchManager.getCompletedResearchIds(),
        latestCompletion: this.researchManager.getLatestCompletion(),
        researchVersion: this.researchManager.getResearchVersion(),
      },
      turn: turnData,
    };
  }
}
