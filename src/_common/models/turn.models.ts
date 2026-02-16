import type { CompletedResearchSummary } from './research-manager.models';
import type { ResourceType } from './resource.models';

export type TurnData = {
  turnNumber: number;
  actionPoints: {
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
}

export interface UpkeepBreakdown {
  baseFood: number;
  baseGold: number;
  populationFood: number;
  totalFood: number;
  totalGold: number;
  totalPopulation: number;
}
