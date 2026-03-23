import type { StateBuildingId, TechnologyId } from '../_common/models/buildings.models';
import type { GameSetupData } from '../_common/models/game-setup.models';
import type {
  UnitRole,
} from '../_common/models/military.models';
import type { PoliticalEntityId } from '../_common/models/politics.models';
import type {
  PendingRandomEventState,
  RandomEventConditionSet,
  RandomEventDefinition,
  RandomEventOptionDefinition,
  RandomEventOptionRequirements,
  RandomEventPresentation,
  RandomEventPresentationOption,
  RandomEventResolution,
  RandomEventSaveState,
  RandomEventSignalId,
} from '../_common/models/random-events.models';
import type { ResourceType } from '../_common/models/resource.models';
import type { SeededRandom } from '../_common/random';
import {
  getAllRandomEventDefinitions,
  getRandomEventDefinition,
  hasAvailableRandomEventOption,
  isRandomEventId,
  RANDOM_EVENT_INTERVAL_TURNS,
  RANDOM_EVENT_RARITY_WEIGHTS,
  RANDOM_EVENT_WEEKLY_TRIGGER_CHANCE,
} from '../data/randomEvents';
import { getUnitDefinition } from '../data/military';
import { getResearchDefinition, isResearchId } from '../data/researches';
import type { BuildingManager } from './BuildingManager';
import type { GameLogManager } from './GameLogManager';
import type { MilitaryManager } from './MilitaryManager';
import type { PoliticsManager } from './PoliticsManager';
import type { ResourceManager } from './ResourceManager';

export interface RandomEventFocusBridge {
  getFocusCurrent(): number;
  adjustFocus(delta: number): void;
}

export interface RandomEventManagerOptions {
  rng: SeededRandom;
  resourceManager: ResourceManager;
  buildingManager: BuildingManager;
  militaryManager: MilitaryManager;
  politicsManager: PoliticsManager;
  logManager?: GameLogManager;
  setup?: GameSetupData;
  initial?: RandomEventSaveState;
}

type RequirementResult = {
  eligible: boolean;
  reason?: string;
};

export class RandomEventManager {
  private readonly rng: SeededRandom;
  private readonly resourceManager: ResourceManager;
  private readonly buildingManager: BuildingManager;
  private readonly militaryManager: MilitaryManager;
  private readonly politicsManager: PoliticsManager;
  private readonly logManager?: GameLogManager;
  private readonly setup?: GameSetupData;

  private focusBridge?: RandomEventFocusBridge;
  private cooldowns = new Map<string, number>();
  private seenUniqueEventIds = new Set<string>();
  private signalCounters = new Map<RandomEventSignalId, number>();
  private pendingEvent?: PendingRandomEventState;
  private lastRollTurn = 0;
  private version = 0;

  constructor(options: RandomEventManagerOptions) {
    this.rng = options.rng;
    this.resourceManager = options.resourceManager;
    this.buildingManager = options.buildingManager;
    this.militaryManager = options.militaryManager;
    this.politicsManager = options.politicsManager;
    this.logManager = options.logManager;
    this.setup = options.setup;

    const initial = options.initial;
    if (!initial) {
      return;
    }

    for (const entry of initial.cooldowns) {
      this.cooldowns.set(entry.eventId, entry.lastTurn);
    }
    for (const eventId of initial.seenUniqueEventIds) {
      this.seenUniqueEventIds.add(eventId);
    }
    for (const entry of initial.signalCounters) {
      this.signalCounters.set(entry.signalId, Math.max(0, entry.value));
    }
    if (
      initial.pendingEvent &&
      isRandomEventId(initial.pendingEvent.definitionId)
    ) {
      this.pendingEvent = {
        definitionId: initial.pendingEvent.definitionId,
        generatedOnTurn: Math.max(1, initial.pendingEvent.generatedOnTurn),
      };
    }
    this.lastRollTurn = Math.max(0, initial.lastRollTurn);
    this.version = Math.max(0, initial.version);
  }

  setFocusBridge(bridge: RandomEventFocusBridge | undefined): void {
    this.focusBridge = bridge;
  }

  getVersion(): number {
    return this.version;
  }

  getPendingEventPresentation(): RandomEventPresentation | undefined {
    if (!this.pendingEvent) {
      return undefined;
    }
    if (!isRandomEventId(this.pendingEvent.definitionId)) {
      return undefined;
    }

    const definition = getRandomEventDefinition(this.pendingEvent.definitionId);
    if (!definition) {
      return undefined;
    }

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      rarity: definition.rarity,
      generatedOnTurn: this.pendingEvent.generatedOnTurn,
      options: definition.options.map((option) =>
        this.buildPresentationOption(option)
      ),
    };
  }

  rollForTurn(currentTurn: number): RandomEventPresentation | undefined {
    if (this.pendingEvent) {
      return this.getPendingEventPresentation();
    }

    if (
      currentTurn <= 1 ||
      (currentTurn - 1) % RANDOM_EVENT_INTERVAL_TURNS !== 0 ||
      this.lastRollTurn === currentTurn
    ) {
      return undefined;
    }

    this.lastRollTurn = currentTurn;
    this.version++;

    if (this.rng.next() > RANDOM_EVENT_WEEKLY_TRIGGER_CHANCE) {
      return undefined;
    }

    const eligible = getAllRandomEventDefinitions().filter((definition) =>
      this.isEventEligible(definition, currentTurn)
    );

    if (eligible.length === 0) {
      return undefined;
    }

    const totalWeight = eligible.reduce(
      (sum, definition) =>
        sum + definition.weight * RANDOM_EVENT_RARITY_WEIGHTS[definition.rarity],
      0
    );
    if (totalWeight <= 0) {
      return undefined;
    }

    const roll = this.rng.next() * totalWeight;
    let cumulative = 0;
    for (const definition of eligible) {
      cumulative +=
        definition.weight * RANDOM_EVENT_RARITY_WEIGHTS[definition.rarity];
      if (roll >= cumulative) {
        continue;
      }
      this.pendingEvent = {
        definitionId: definition.id,
        generatedOnTurn: currentTurn,
      };
      this.version++;
      return this.getPendingEventPresentation();
    }

    return undefined;
  }

  resolvePendingEventOption(optionId: string): RandomEventResolution | undefined {
    if (!this.pendingEvent || !isRandomEventId(this.pendingEvent.definitionId)) {
      return undefined;
    }

    const definition = getRandomEventDefinition(this.pendingEvent.definitionId);
    if (!definition) {
      return undefined;
    }

    const option = definition.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      return undefined;
    }

    const requirementResult = this.evaluateOptionRequirements(option.requirements);
    if (!requirementResult.eligible) {
      return undefined;
    }

    const currentTurn = this.pendingEvent.generatedOnTurn;
    const logSeverity = option.outcome.logSeverity ?? 'neutral';

    if (option.outcome.resourceEffects) {
      this.resourceManager.addResources(option.outcome.resourceEffects);
    }

    if (option.outcome.focusDelta && this.focusBridge) {
      this.focusBridge.adjustFocus(option.outcome.focusDelta);
    }

    if (option.outcome.reputationEffects) {
      for (const [entityId, delta] of Object.entries(
        option.outcome.reputationEffects
      ) as [PoliticalEntityId, number][]) {
        this.politicsManager.adjustReputation(entityId, delta);
      }
    }

    if (option.outcome.unitRewards) {
      for (const reward of option.outcome.unitRewards) {
        this.militaryManager.addUnits(
          reward.unitId,
          reward.count,
          reward.readiness ?? 'available'
        );
      }
    }

    if (option.outcome.signalEffects) {
      for (const [signalId, delta] of Object.entries(
        option.outcome.signalEffects
      ) as [RandomEventSignalId, number][]) {
        this.adjustSignal(signalId, delta);
      }
    }

    let battleStarted = false;
    if (option.outcome.startBattle) {
      battleStarted =
        this.militaryManager.startBattle(option.outcome.startBattle) !== undefined;
    }

    this.cooldowns.set(definition.id, currentTurn);
    if (definition.unique) {
      this.seenUniqueEventIds.add(definition.id);
    }
    this.pendingEvent = undefined;
    this.version++;

    const resolutionText =
      option.outcome.resultText +
      (option.outcome.startBattle && !battleStarted
        ? ' Your forces could not assemble for battle.'
        : '');

    switch (logSeverity) {
      case 'good':
        this.logManager?.addGood(resolutionText);
        break;
      case 'bad':
        this.logManager?.addBad(resolutionText);
        break;
      default:
        this.logManager?.addNeutral(resolutionText);
        break;
    }

    return {
      eventId: definition.id,
      optionId: option.id,
      title: definition.title,
      description: resolutionText,
      logSeverity,
      battleStarted,
    };
  }

  recordTileChange(args: {
    x: number;
    y: number;
    from?: string;
    to: string;
    source: 'building-action' | 'field-placement' | 'turn-recovery';
  }): void {
    const from = args.from;
    const to = args.to;

    if (from === 'forest' && to !== 'forest') {
      this.adjustSignal('forest-chopped', 1);
      return;
    }
    if (to === 'forest' && from !== 'forest') {
      this.adjustSignal('forest-restored', 1);
    }
  }

  getSaveState(): RandomEventSaveState {
    return {
      pendingEvent: this.pendingEvent ? { ...this.pendingEvent } : undefined,
      cooldowns: Array.from(this.cooldowns.entries()).map(
        ([eventId, lastTurn]) => ({
          eventId,
          lastTurn,
        })
      ),
      seenUniqueEventIds: Array.from(this.seenUniqueEventIds.values()),
      signalCounters: Array.from(this.signalCounters.entries()).map(
        ([signalId, value]) => ({
          signalId,
          value,
        })
      ),
      lastRollTurn: this.lastRollTurn,
      version: this.version,
    };
  }

  private isEventEligible(
    definition: RandomEventDefinition,
    currentTurn: number
  ): boolean {
    if (definition.unique && this.seenUniqueEventIds.has(definition.id)) {
      return false;
    }

    const lastTurn = this.cooldowns.get(definition.id);
    if (
      lastTurn !== undefined &&
      currentTurn - lastTurn < (definition.cooldownTurns ?? 0)
    ) {
      return false;
    }

    if (!this.evaluateConditions(definition.conditions, currentTurn)) {
      return false;
    }

    const presentation = this.buildPresentation(definition, currentTurn);
    return hasAvailableRandomEventOption(presentation);
  }

  private buildPresentation(
    definition: RandomEventDefinition,
    currentTurn: number
  ): RandomEventPresentation {
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      rarity: definition.rarity,
      generatedOnTurn: currentTurn,
      options: definition.options.map((option) =>
        this.buildPresentationOption(option)
      ),
    };
  }

  private buildPresentationOption(
    option: RandomEventOptionDefinition
  ): RandomEventPresentationOption {
    const result = this.evaluateOptionRequirements(option.requirements);
    return {
      id: option.id,
      title: option.title,
      outcomeDescription: option.outcomeDescription,
      disabled: !result.eligible,
      disabledReason: result.reason,
    };
  }

  private evaluateConditions(
    conditions: RandomEventConditionSet | undefined,
    currentTurn: number
  ): boolean {
    if (!conditions) {
      return true;
    }

    if (conditions.minTurn !== undefined && currentTurn < conditions.minTurn) {
      return false;
    }
    if (conditions.maxTurn !== undefined && currentTurn > conditions.maxTurn) {
      return false;
    }
    if (
      conditions.requiredPrehistory !== undefined &&
      this.setup?.prehistory !== conditions.requiredPrehistory
    ) {
      return false;
    }

    if (
      conditions.requiredTechnologies?.some(
        (technology) => !this.buildingManager.isTechnologyUnlocked(technology)
      )
    ) {
      return false;
    }

    if (!this.meetsMinResourceConditions(conditions.minResources)) {
      return false;
    }
    if (!this.meetsMaxResourceConditions(conditions.maxResources)) {
      return false;
    }
    if (!this.meetsMinBuildingCountConditions(conditions.minBuildingCounts)) {
      return false;
    }
    if (!this.meetsMaxBuildingCountConditions(conditions.maxBuildingCounts)) {
      return false;
    }
    if (!this.meetsMinReputationConditions(conditions.minReputation)) {
      return false;
    }
    if (!this.meetsMaxReputationConditions(conditions.maxReputation)) {
      return false;
    }
    if (!this.meetsMinSignalConditions(conditions.minSignals)) {
      return false;
    }
    if (!this.meetsMaxSignalConditions(conditions.maxSignals)) {
      return false;
    }
    if (
      conditions.minAvailableUnits !== undefined &&
      this.militaryManager.getTotalUnits('available') <
        conditions.minAvailableUnits
    ) {
      return false;
    }

    return true;
  }

  private evaluateOptionRequirements(
    requirements: RandomEventOptionRequirements | undefined
  ): RequirementResult {
    if (!requirements) {
      return { eligible: true };
    }

    if (
      requirements.minFocus !== undefined &&
      (this.focusBridge?.getFocusCurrent() ?? 0) < requirements.minFocus
    ) {
      return {
        eligible: false,
        reason: `Requires ${requirements.minFocus} Focus.`,
      };
    }

    if (requirements.requiredTechnologies) {
      const missingTechnology = requirements.requiredTechnologies.find(
        (technology) => !this.buildingManager.isTechnologyUnlocked(technology)
      );
      if (missingTechnology) {
        return {
          eligible: false,
          reason: `Requires ${this.getTechnologyLabel(missingTechnology)}.`,
        };
      }
    }

    if (requirements.minResources) {
      for (const [resourceType, amount] of Object.entries(
        requirements.minResources
      ) as [ResourceType, number][]) {
        if (this.resourceManager.getResource(resourceType) < amount) {
          return {
            eligible: false,
            reason: `Requires ${amount} ${this.getResourceLabel(resourceType)}.`,
          };
        }
      }
    }

    if (requirements.minBuildingCounts) {
      for (const [buildingId, count] of Object.entries(
        requirements.minBuildingCounts
      ) as [StateBuildingId, number][]) {
        if (this.buildingManager.getBuildingCount(buildingId) < count) {
          return {
            eligible: false,
            reason: `Requires ${count} ${this.getBuildingLabel(buildingId)}.`,
          };
        }
      }
    }

    if (requirements.minReputation) {
      for (const [entityId, amount] of Object.entries(
        requirements.minReputation
      ) as [PoliticalEntityId, number][]) {
        if (this.politicsManager.getReputation(entityId) < amount) {
          return {
            eligible: false,
            reason: `Requires ${amount} reputation with ${this.getEntityLabel(entityId)}.`,
          };
        }
      }
    }

    if (requirements.minUnitCounts) {
      for (const [unitId, count] of Object.entries(
        requirements.minUnitCounts
      ) as [UnitRole, number][]) {
        if (this.militaryManager.getUnitCount(unitId, 'available') < count) {
          return {
            eligible: false,
            reason: `Requires ${count} ${this.getUnitLabel(unitId)} available.`,
          };
        }
      }
    }

    if (
      requirements.minAvailableUnits !== undefined &&
      this.militaryManager.getTotalUnits('available') <
        requirements.minAvailableUnits
    ) {
      return {
        eligible: false,
        reason: `Requires ${requirements.minAvailableUnits} available units.`,
      };
    }

    return { eligible: true };
  }

  private meetsMinResourceConditions(
    resources: Partial<Record<ResourceType, number>> | undefined
  ): boolean {
    if (!resources) {
      return true;
    }
    for (const [resourceType, amount] of Object.entries(resources) as [
      ResourceType,
      number,
    ][]) {
      if (this.resourceManager.getResource(resourceType) < amount) {
        return false;
      }
    }
    return true;
  }

  private meetsMaxResourceConditions(
    resources: Partial<Record<ResourceType, number>> | undefined
  ): boolean {
    if (!resources) {
      return true;
    }
    for (const [resourceType, amount] of Object.entries(resources) as [
      ResourceType,
      number,
    ][]) {
      if (this.resourceManager.getResource(resourceType) > amount) {
        return false;
      }
    }
    return true;
  }

  private meetsMinBuildingCountConditions(
    counts: Partial<Record<StateBuildingId, number>> | undefined
  ): boolean {
    if (!counts) {
      return true;
    }
    for (const [buildingId, amount] of Object.entries(counts) as [
      StateBuildingId,
      number,
    ][]) {
      if (this.buildingManager.getBuildingCount(buildingId) < amount) {
        return false;
      }
    }
    return true;
  }

  private meetsMaxBuildingCountConditions(
    counts: Partial<Record<StateBuildingId, number>> | undefined
  ): boolean {
    if (!counts) {
      return true;
    }
    for (const [buildingId, amount] of Object.entries(counts) as [
      StateBuildingId,
      number,
    ][]) {
      if (this.buildingManager.getBuildingCount(buildingId) > amount) {
        return false;
      }
    }
    return true;
  }

  private meetsMinReputationConditions(
    reputations: Partial<Record<PoliticalEntityId, number>> | undefined
  ): boolean {
    if (!reputations) {
      return true;
    }
    for (const [entityId, amount] of Object.entries(reputations) as [
      PoliticalEntityId,
      number,
    ][]) {
      if (this.politicsManager.getReputation(entityId) < amount) {
        return false;
      }
    }
    return true;
  }

  private meetsMaxReputationConditions(
    reputations: Partial<Record<PoliticalEntityId, number>> | undefined
  ): boolean {
    if (!reputations) {
      return true;
    }
    for (const [entityId, amount] of Object.entries(reputations) as [
      PoliticalEntityId,
      number,
    ][]) {
      if (this.politicsManager.getReputation(entityId) > amount) {
        return false;
      }
    }
    return true;
  }

  private meetsMinSignalConditions(
    signals: Partial<Record<RandomEventSignalId, number>> | undefined
  ): boolean {
    if (!signals) {
      return true;
    }
    for (const [signalId, amount] of Object.entries(signals) as [
      RandomEventSignalId,
      number,
    ][]) {
      if ((this.signalCounters.get(signalId) ?? 0) < amount) {
        return false;
      }
    }
    return true;
  }

  private meetsMaxSignalConditions(
    signals: Partial<Record<RandomEventSignalId, number>> | undefined
  ): boolean {
    if (!signals) {
      return true;
    }
    for (const [signalId, amount] of Object.entries(signals) as [
      RandomEventSignalId,
      number,
    ][]) {
      if ((this.signalCounters.get(signalId) ?? 0) > amount) {
        return false;
      }
    }
    return true;
  }

  private adjustSignal(signalId: RandomEventSignalId, delta: number): void {
    const current = this.signalCounters.get(signalId) ?? 0;
    this.signalCounters.set(signalId, Math.max(0, current + delta));
    this.version++;
  }

  private getTechnologyLabel(id: TechnologyId): string {
    return isResearchId(id) ? (getResearchDefinition(id)?.name ?? id) : id;
  }

  private getResourceLabel(resourceType: ResourceType): string {
    switch (resourceType) {
      case 'gold':
        return 'Gold';
      case 'wood':
        return 'Wood';
      case 'stone':
        return 'Stone';
      case 'jewelry':
        return 'Jewelry';
      case 'ironOre':
        return 'Iron Ore';
      case 'wheat':
        return 'Wheat';
      case 'meat':
        return 'Meat';
      case 'bread':
        return 'Bread';
      case 'population':
        return 'Population';
      case 'politicalPower':
        return 'Political Power';
      default:
        return resourceType;
    }
  }

  private getBuildingLabel(buildingId: StateBuildingId): string {
    return this.buildingManager.getBuildingDefinition(buildingId)?.name ?? buildingId;
  }

  private getEntityLabel(entityId: PoliticalEntityId): string {
    return (
      this.politicsManager.getEntities().find((entity) => entity.id === entityId)
        ?.name ?? entityId
    );
  }

  private getUnitLabel(unitId: UnitRole): string {
    return getUnitDefinition(unitId)?.name ?? unitId;
  }
}
