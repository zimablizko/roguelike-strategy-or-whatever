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
  resourceType?: ResourceType;
  amount?: number;
  label?: string;
  colorHex?: string;
}

export interface EndTurnResult {
  passiveIncome: Partial<Record<ResourceType, number>>;
  passiveIncomePulses: EndTurnIncomePulse[];
  actionPulses: EndTurnIncomePulse[];
  completedResearch?: CompletedResearchSummary;
  upkeepPaid: boolean;
}

export interface UpkeepBreakdown {
  baseGold: number;
  /** Total food need from population (2 food per population each month). */
  populationFood: number;
  totalGold: number;
  /** Sum of all food-type resources currently available. */
  totalFoodAvailable: number;
  totalPopulation: number;
}
