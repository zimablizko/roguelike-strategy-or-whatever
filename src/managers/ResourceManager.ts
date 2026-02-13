import { PlayerData } from './GameManager';

/** Type alias for a resource key */
export type ResourceType = keyof PlayerData['resources'];

/** A partial cost / reward map keyed by resource type */
export type ResourceCost = Partial<PlayerData['resources']>;

export interface ResourceManagerOptions {
  initial: PlayerData['resources'];
}

/**
 * Manages all player resource data and operations.
 * Single source of truth for resource state.
 */
export class ResourceManager {
  private resources: PlayerData['resources'];
  private resourcesVersion = 0;

  constructor(options: ResourceManagerOptions) {
    this.resources = { ...options.initial };
  }

  // ============ Single-resource operations ============

  /**
   * Get the current amount of a specific resource
   */
  getResource(type: ResourceType): number {
    return this.resources[type];
  }

  /**
   * Get all resources as a shallow copy
   */
  getAllResources(): PlayerData['resources'] {
    return { ...this.resources };
  }

  /**
   * Get all resources by reference (read-only view).
   * Use for hot UI polling paths to avoid per-frame allocations.
   */
  getAllResourcesRef(): Readonly<PlayerData['resources']> {
    return this.resources;
  }

  /**
   * Version counter incremented on every mutation.
   * UI views can compare this to skip re-renders.
   */
  getResourcesVersion(): number {
    return this.resourcesVersion;
  }

  /**
   * Set a specific resource to an exact value (clamped to 0)
   */
  setResource(type: ResourceType, amount: number): void {
    this.resources[type] = Math.max(0, amount);
    this.resourcesVersion++;
  }

  /**
   * Add an amount to a specific resource (result clamped to 0)
   */
  addResource(type: ResourceType, amount: number): void {
    this.resources[type] = Math.max(0, this.resources[type] + amount);
    this.resourcesVersion++;
  }

  /**
   * Spend/subtract an amount from a specific resource
   * @returns true if the resource was spent, false if insufficient
   */
  spendResource(type: ResourceType, amount: number): boolean {
    if (this.resources[type] >= amount) {
      this.resources[type] -= amount;
      this.resourcesVersion++;
      return true;
    }
    return false;
  }

  /**
   * Check if the player has enough of a specific resource
   */
  hasResource(type: ResourceType, amount: number): boolean {
    return this.resources[type] >= amount;
  }

  // ============ Multi-resource operations ============

  /**
   * Check if the player can afford a cost of multiple resources
   */
  canAfford(cost: ResourceCost): boolean {
    for (const [type, amount] of Object.entries(cost) as [
      ResourceType,
      number,
    ][]) {
      if (this.resources[type] < amount) {
        console.warn(
          `Cannot afford ${amount} ${type}. Current: ${this.resources[type]}`
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Spend multiple resources at once (for purchases/costs)
   * @returns true if all resources were spent, false if insufficient (no resources deducted)
   */
  spendResources(cost: ResourceCost): boolean {
    if (!this.canAfford(cost)) {
      return false;
    }
    for (const [type, amount] of Object.entries(cost) as [
      ResourceType,
      number,
    ][]) {
      this.resources[type] -= amount;
    }
    this.resourcesVersion++;
    return true;
  }

  /**
   * Add multiple resources at once (for rewards/income)
   */
  addResources(resources: ResourceCost): void {
    for (const [type, amount] of Object.entries(resources) as [
      ResourceType,
      number,
    ][]) {
      this.resources[type] = Math.max(0, this.resources[type] + amount);
    }
    this.resourcesVersion++;
  }

  /**
   * Reset all resources to zero
   */
  resetResources(): void {
    this.resources = {
      gold: 0,
      materials: 0,
      food: 0,
      population: 0,
    };
    this.resourcesVersion++;
  }
}
