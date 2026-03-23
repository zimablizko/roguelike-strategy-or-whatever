import type {
  ResearchId,
  TypedResearchDefinition,
} from '../../_common/models/researches.models';
import { researchDefinitions } from './researchDefinitions';

export function isResearchId(id: string): id is ResearchId {
  return Object.prototype.hasOwnProperty.call(researchDefinitions, id);
}

export function getResearchDefinition(
  id: ResearchId
): TypedResearchDefinition | undefined {
  return researchDefinitions[id] as TypedResearchDefinition | undefined;
}

export function getAllResearchDefinitions(): TypedResearchDefinition[] {
  return Object.values(researchDefinitions) as TypedResearchDefinition[];
}
