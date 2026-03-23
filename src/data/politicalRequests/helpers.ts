import type { PoliticalRequestDefinition } from '../../_common/models/politics.models';
import { politicalRequestDefinitions } from './politicalRequestDefinitions';

/** Look up a request definition by its id. */
export function getPoliticalRequestDefinition(
  id: string
): PoliticalRequestDefinition | undefined {
  return politicalRequestDefinitions.find((definition) => definition.id === id);
}
