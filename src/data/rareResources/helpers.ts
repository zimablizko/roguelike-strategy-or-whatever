import type { RareResourceDefinition } from '../../_common/models/rare-resource.models';
import { rareResourceDefinitions, type RareResourceId } from './rareResourceDefinitions';

export function isRareResourceId(id: string): id is RareResourceId {
  return Object.prototype.hasOwnProperty.call(rareResourceDefinitions, id);
}

export function getRareResourceDefinition(
  id: RareResourceId
): RareResourceDefinition | undefined {
  return rareResourceDefinitions[id];
}

export function getAllRareResourceDefinitions(): RareResourceDefinition[] {
  return Object.values(rareResourceDefinitions) as RareResourceDefinition[];
}
