export type ResourceType =
  | 'gold'
  | 'wood'
  | 'stone'
  | 'jewelry'
  | 'ironOre'
  | 'wheat'
  | 'meat'
  | 'bread'
  | 'population';

/** Resource types that count as edible food for aggregate display. */
export const FOOD_RESOURCE_TYPES: readonly ResourceType[] = [
  'meat',
  'bread',
] as const;

export type ResourceStock = Record<ResourceType, number>;

export type ResourceCost = Partial<ResourceStock>;

export interface ResourceManagerOptions {
  initial: ResourceStock;
}
