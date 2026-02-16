export type ResourceType = 'gold' | 'materials' | 'food' | 'population';

export type ResourceStock = Record<ResourceType, number>;

export type ResourceCost = Partial<ResourceStock>;

export interface ResourceManagerOptions {
  initial: ResourceStock;
}
