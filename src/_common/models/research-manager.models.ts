import type { ResearchId, ResearchTreeId } from './researches.models';

export interface ActiveResearchState {
  id: ResearchId;
  startedOnTurn: number;
  totalTurns: number;
  remainingTurns: number;
}

export interface ResearchProgress extends ActiveResearchState {
  name: string;
  tree: ResearchTreeId;
}

export interface CompletedResearchSummary {
  id: ResearchId;
  name: string;
  tree: ResearchTreeId;
  completedOnTurn: number;
}

export interface ResearchAdvanceResult {
  completedResearch?: CompletedResearchSummary;
}

export interface ResearchStartStatus {
  startable: boolean;
  reason?: string;
}
