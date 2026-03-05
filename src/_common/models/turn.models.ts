import type { MilitaryThreat, ThreatOutcome } from './military.models';
import type { CompletedResearchSummary } from './research-manager.models';
import type { ResourceType } from './resource.models';

export type TurnData = {
  turnNumber: number;
  focus: {
    current: number;
    max: number;
  };
};

export interface EndTurnIncomePulse {
  tileX: number;
  tileY: number;
  resourceType: ResourceType;
  amount: number;
}

export interface EndTurnResult {
  passiveIncome: Partial<Record<ResourceType, number>>;
  passiveIncomePulses: EndTurnIncomePulse[];
  completedResearch?: CompletedResearchSummary;
  upkeepPaid: boolean;
  /** Threat resolution outcomes from this turn. */
  threatOutcomes: ThreatOutcome[];
  /** Newly spawned threats. */
  newThreats: MilitaryThreat[];
}

export interface UpkeepBreakdown {
  baseGold: number;
  /** Total food need from population (1 per 2 people). */
  populationFood: number;
  /** Per food-type share (populationFood split across food types). */
  foodPerType: number;
  totalGold: number;
  totalBread: number;
  totalMeat: number;
  totalPopulation: number;
}
