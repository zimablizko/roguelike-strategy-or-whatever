import type { TechnologyId, StateBuildingId } from './buildings.models';
import type {
  StartBattleOptions,
  UnitReadiness,
  UnitRole,
} from './military.models';
import type { PoliticalEntityId } from './politics.models';
import type { ResourceType } from './resource.models';
import type { StatePrehistoryId } from './game-setup.models';
import type { RulerSkillId } from './ruler.models';

export type RandomEventRarity = 'common' | 'uncommon' | 'rare';

export type RandomEventSignalId = 'forest-chopped' | 'forest-restored';
export type RandomEventSkillCheckDifficulty =
  | 'easy'
  | 'normal'
  | 'hard'
  | 'very-hard'
  | 'impossible';

export interface RandomEventConditionSet {
  minTurn?: number;
  maxTurn?: number;
  requiredPrehistory?: StatePrehistoryId;
  requiredTechnologies?: TechnologyId[];
  minResources?: Partial<Record<ResourceType, number>>;
  maxResources?: Partial<Record<ResourceType, number>>;
  minBuildingCounts?: Partial<Record<StateBuildingId, number>>;
  maxBuildingCounts?: Partial<Record<StateBuildingId, number>>;
  minReputation?: Partial<Record<PoliticalEntityId, number>>;
  maxReputation?: Partial<Record<PoliticalEntityId, number>>;
  minSignals?: Partial<Record<RandomEventSignalId, number>>;
  maxSignals?: Partial<Record<RandomEventSignalId, number>>;
  minAvailableUnits?: number;
}

export interface RandomEventOptionRequirements {
  minFocus?: number;
  requiredTechnologies?: TechnologyId[];
  minResources?: Partial<Record<ResourceType, number>>;
  minBuildingCounts?: Partial<Record<StateBuildingId, number>>;
  minReputation?: Partial<Record<PoliticalEntityId, number>>;
  minUnitCounts?: Partial<Record<UnitRole, number>>;
  minAvailableUnits?: number;
}

export interface RandomEventUnitReward {
  unitId: UnitRole;
  count: number;
  readiness?: UnitReadiness;
}

export interface RandomEventOutcome {
  resourceEffects?: Partial<Record<ResourceType, number>>;
  focusDelta?: number;
  reputationEffects?: Partial<Record<PoliticalEntityId, number>>;
  unitRewards?: RandomEventUnitReward[];
  signalEffects?: Partial<Record<RandomEventSignalId, number>>;
  startBattle?: StartBattleOptions;
  resultText: string;
  logSeverity?: 'good' | 'bad' | 'neutral';
}

export interface RandomEventSkillCheckDefinition {
  skill: RulerSkillId;
  difficulty: RandomEventSkillCheckDifficulty | number;
  difficultyLabel?: string;
  successOutcome: RandomEventOutcome;
  failureOutcome: RandomEventOutcome;
}

export interface RandomEventSkillCheckPresentation {
  skill: RulerSkillId;
  skillLabel: string;
  difficultyLabel: string;
  target: number;
}

export interface RandomEventSkillCheckResult
  extends RandomEventSkillCheckPresentation {
  skillValue: number;
  roll: number;
  total: number;
  success: boolean;
}

interface RandomEventBaseOptionDefinition {
  id: string;
  title: string;
  outcomeDescription: string;
  requirements?: RandomEventOptionRequirements;
}

export type RandomEventOptionDefinition =
  | (RandomEventBaseOptionDefinition & {
      outcome: RandomEventOutcome;
      skillCheck?: never;
    })
  | (RandomEventBaseOptionDefinition & {
      outcome?: never;
      skillCheck: RandomEventSkillCheckDefinition;
    });

export interface RandomEventDefinition {
  id: string;
  title: string;
  description: string;
  rarity: RandomEventRarity;
  weight: number;
  unique?: boolean;
  cooldownTurns?: number;
  conditions?: RandomEventConditionSet;
  options: readonly RandomEventOptionDefinition[];
}

export interface PendingRandomEventState {
  definitionId: string;
  generatedOnTurn: number;
}

export interface RandomEventPresentationOption {
  id: string;
  title: string;
  outcomeDescription: string;
  resourceEffects?: Partial<Record<ResourceType, number>>;
  focusDelta?: number;
  resourceRanges?: Array<{ resourceType: ResourceType; min: number; max: number }>;
  focusRange?: { min: number; max: number };
  skillCheck?: RandomEventSkillCheckPresentation;
  disabled: boolean;
  disabledReason?: string;
}

export interface RandomEventPresentation {
  id: string;
  title: string;
  description: string;
  rarity: RandomEventRarity;
  generatedOnTurn: number;
  options: RandomEventPresentationOption[];
}

export interface RandomEventResolution {
  eventId: string;
  optionId: string;
  title: string;
  description: string;
  logSeverity: 'good' | 'bad' | 'neutral';
  battleStarted: boolean;
  skillCheck?: RandomEventSkillCheckResult;
}

export interface RandomEventSaveState {
  pendingEvent?: PendingRandomEventState;
  cooldowns: Array<{ eventId: string; lastTurn: number }>;
  seenUniqueEventIds: string[];
  signalCounters: Array<{ signalId: RandomEventSignalId; value: number }>;
  lastRollTurn: number;
  version: number;
}
