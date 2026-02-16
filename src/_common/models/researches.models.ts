import type { TechnologyId } from './buildings.models';

export type ResearchTreeId = 'economics' | 'politics' | 'military';

export interface ResearchDefinition {
  id: TechnologyId;
  tree: ResearchTreeId;
  name: string;
  description: string;
  turns: number;
  requiredResearches: TechnologyId[];
}

export type ResearchId = keyof typeof import('../../data/researches').researchDefinitions;

export type TypedResearchDefinition = ResearchDefinition & {
  id: ResearchId;
};
