import type { GameSetupData } from '../_common/models/game-setup.models';
import type {
  GameManagerOptions,
  PlayerData,
} from '../_common/models/game.models';
import type { PersonOccupation } from '../_common/models/person.models';
import type { GameSaveData } from '../_common/models/save.models';
import { SeededRandom } from '../_common/random';
import { stateBuildingDefinitions } from '../data/buildings';
import {
  BARRACKS_GARRISON_PER_INSTANCE,
  BARRACKS_TRAINING_SLOTS_PER_INSTANCE,
} from '../data/military';
import { BuildingManager } from './BuildingManager';
import { ConditionManager } from './ConditionManager';
import { GameLogManager } from './GameLogManager';
import { MapManager } from './MapManager';
import { MilitaryManager } from './MilitaryManager';
import { PersonManager } from './PersonManager';
import { PoliticsManager } from './PoliticsManager';
import { RandomEventManager } from './RandomEventManager';
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
      wood: 50,
      stone: 50,
      jewelry: 0,
      ironOre: 0,
      wheat: 0,
      meat: 50,
      bread: 50,
      fish: 0,
      population: 10,
      politicalPower: 0,
    },
  };

  playerData: PlayerData;
  resourceManager: ResourceManager;
  rulerManager: RulerManager;
  stateManager: StateManager;
  buildingManager: BuildingManager;
  personManager: PersonManager;
  logManager: GameLogManager;
  mapManager: MapManager;
  researchManager: ResearchManager;
  militaryManager: MilitaryManager;
  politicsManager: PoliticsManager;
  randomEventManager: RandomEventManager;
  conditionManager: ConditionManager;
  readonly setup?: GameSetupData;
  readonly rng: SeededRandom;

  constructor(options: GameManagerOptions) {
    const saveData = options.saveData;
    this.setup = saveData?.setup ?? options.setup;
    this.playerData =
      saveData?.playerData ??
      options.playerData ??
      GameManager.DEFAULT_PLAYER_DATA;
    this.rng = new SeededRandom(saveData?.rngState ?? options.seed);

    this.resourceManager = new ResourceManager({
      initial: saveData?.resources ?? this.playerData.resources,
    });
    this.logManager = new GameLogManager(saveData?.logs);

    this.rulerManager = new RulerManager({
      rng: this.rng,
      applyTraitEffects: !saveData,
      initial: saveData?.ruler
        ? {
            name: saveData.ruler.name,
            age: saveData.ruler.age,
            traits: saveData.ruler.traits,
            focus: saveData.ruler.focus,
            charisma: saveData.ruler.charisma,
            governance: saveData.ruler.governance,
            intrigue: saveData.ruler.intrigue,
            warfare: saveData.ruler.warfare,
            health: saveData.ruler.health,
          }
        : options.ruler,
    });

    this.mapManager = new MapManager(
      saveData
        ? {
            rng: this.rng,
            initialMap: saveData.map,
          }
        : { ...options.map, rng: this.rng }
    );

    const playerState =
      saveData?.state ?? this.mapManager.getPlayerStateSummary();
    this.stateManager = new StateManager({
      rng: this.rng,
      initial: {
        name: saveData?.state.name ?? options.state?.name,
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
      logManager: this.logManager,
      stateBridge: {
        getStateRef: () => this.stateManager.getStateRef(),
        applyMapSummary: (summary) =>
          this.stateManager.applyMapSummary(summary),
      },
      onBuildingCompleted: (instance) => {
        const def = stateBuildingDefinitions[instance.buildingId];
        if ('workerOccupation' in def && def.workerOccupation && !instance.workerId) {
          const free = this.personManager.getFreePeasants();
          if (free.length > 0) {
            const peasant = free[0];
            this.buildingManager.assignWorker(instance.instanceId, peasant.id);
            this.personManager.assignToBuilding(
              peasant.id,
              instance.instanceId,
              def.workerOccupation as PersonOccupation
            );
            this.logManager.addNeutral(
              `${peasant.name} assigned as ${def.workerOccupation} at ${def.name}.`
            );
          }
        }
        if ('housingSlots' in def && def.housingSlots) {
          this.personManager.reallocateHousing(
            this.buildingManager.getBuildingInstances()
          );
          this.resourceManager.setResource(
            'population',
            this.personManager.getPeopleCount()
          );
        }
      },
      personManager: {
        getFreePeasants: () => this.personManager.getFreePeasants(),
        assignAsSoldier: (personId, unitRole) =>
          this.personManager.assignAsSoldier(personId, unitRole),
      },
      militaryManager: {
        trainUnitInstant: (unitRole) =>
          this.militaryManager.trainUnitInstant(
            unitRole as import('../_common/models/military.models').UnitRole
          ),
      },
      initial: saveData?.buildings
        ? {
            technologies: saveData.buildings.technologies,
            builtBuildings: saveData.buildings.counts,
            buildingInstances: saveData.buildings.instances,
            buildingInstanceSerial: saveData.buildings.instanceSerial,
            actionProgresses: saveData.buildings.actionProgresses,
          }
        : {
            technologies: options.startingTechnologies,
          },
    });

    this.personManager = new PersonManager({
      rng: this.rng,
      initial: saveData?.persons,
    });

    if (!saveData) {
      const rulerName = this.rulerManager.getRulerRef().name;
      this.personManager.addPerson('ruler', this.rng, rulerName);
      for (let i = 0; i < 3; i++) this.personManager.addPerson('noble', this.rng);
      for (let i = 0; i < 12; i++) this.personManager.addPerson('peasant', this.rng);
      this.personManager.reallocateHousing(this.buildingManager.getBuildingInstances());
    }
    this.resourceManager.setResource('population', this.personManager.getPeopleCount());

    this.researchManager = new ResearchManager(this.buildingManager, {
      logManager: this.logManager,
      initial: saveData?.research
        ? {
            activeResearch: saveData.research.activeResearch,
            completedResearches: saveData.research.completedResearches,
            latestCompletion: saveData.research.latestCompletion,
            researchVersion: saveData.research.researchVersion,
          }
        : undefined,
    });

    this.militaryManager = new MilitaryManager({
      getBarracksCapacity: () =>
        this.buildingManager.getBuildingCount('barracks') *
        BARRACKS_TRAINING_SLOTS_PER_INSTANCE,
      getGarrisonCapacity: () =>
        this.buildingManager.getBuildingCount('barracks') *
        BARRACKS_GARRISON_PER_INSTANCE,
      isTechnologyUnlocked: (techId: string) =>
        this.buildingManager.isTechnologyUnlocked(techId),
      grantResources: (resources) =>
        this.resourceManager.addResources(resources),
      logManager: this.logManager,
      onSoldierDied: (unitRole, count) =>
        this.personManager.removeSoldiers(unitRole, count),
      initial: saveData?.military ?? undefined,
    });
    if (!saveData) {
      for (const unit of options.startingUnits ?? []) {
        this.militaryManager.addUnits(unit.unitId, unit.count, 'available');
      }
    }
    this.buildingManager.setAdditionalOccupiedPopulationProvider(() =>
      this.militaryManager.getPopulationUsage()
    );

    this.politicsManager = new PoliticsManager({
      isTechUnlocked: (techId: string) =>
        this.buildingManager.isTechnologyUnlocked(techId),
      getResource: (type: string) =>
        this.resourceManager.getResource(
          type as
            | 'gold'
            | 'wood'
            | 'stone'
            | 'jewelry'
            | 'ironOre'
            | 'wheat'
            | 'meat'
            | 'bread'
            | 'population'
            | 'politicalPower'
        ),
      getBuildingCount: (buildingId: string) =>
        this.buildingManager.getBuildingCount(
          buildingId as Parameters<
            typeof this.buildingManager.getBuildingCount
          >[0]
        ),
      logManager: this.logManager,
      initial: saveData?.politics ?? undefined,
    });

    this.conditionManager = new ConditionManager({
      logManager: this.logManager,
      initial: saveData?.conditions ?? undefined,
    });

    this.randomEventManager = new RandomEventManager({
      rng: this.rng,
      rulerManager: this.rulerManager,
      resourceManager: this.resourceManager,
      buildingManager: this.buildingManager,
      militaryManager: this.militaryManager,
      politicsManager: this.politicsManager,
      logManager: this.logManager,
      setup: this.setup,
      initial: saveData?.randomEvents ?? undefined,
    });
    this.buildingManager.setTileChangeListener((change) =>
      this.randomEventManager.recordTileChange(change)
    );

    if (saveData) {
      this.rng.setState(saveData.rngState);
    }
  }

  getSnapshot(turnData: GameSaveData['turn']): GameSaveData {
    const map = this.mapManager.getMapRef();
    const ruler = this.rulerManager.getRulerRef();
    const state = this.stateManager.getStateRef();

    return {
      version: 1,
      savedAt: Date.now(),
      setup: this.setup
        ? {
            mapSize: this.setup.mapSize,
            stateName: this.setup.stateName,
            rulerName: this.setup.rulerName,
            prehistory: this.setup.prehistory,
            rulerTraits: [...(this.setup.rulerTraits ?? [])],
          }
        : undefined,
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
        traits: [...ruler.traits],
        focus: ruler.focus,
        charisma: ruler.charisma,
        governance: ruler.governance,
        intrigue: ruler.intrigue,
        warfare: ruler.warfare,
        health: ruler.health,
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
        actionProgresses: this.buildingManager.getBuildingActionProgresses(),
      },
      research: {
        activeResearch: this.researchManager.getActiveResearchState(),
        completedResearches: this.researchManager.getCompletedResearchIds(),
        latestCompletion: this.researchManager.getLatestCompletion(),
        researchVersion: this.researchManager.getResearchVersion(),
      },
      turn: turnData,
      military: this.militaryManager.getSaveState(),
      persons: this.personManager.getSaveState(),
      politics: this.politicsManager.getSaveState(),
      randomEvents: this.randomEventManager.getSaveState(),
      conditions: this.conditionManager.getSaveState(),
      logs: this.logManager.getSaveState(),
    };
  }
}
