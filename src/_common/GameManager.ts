export type PlayerData = {
  race: 'human' | 'elf' | 'dwarf' | 'orc';
  resources: {
    gold: number;
    materials: number;
    food: number;
    population: number;
  };
};

export type GameManagerOptions = {
  playerData: PlayerData;
};

export class GameManager {
  playerData: PlayerData;
  constructor(options: GameManagerOptions) {
    this.playerData = options.playerData;
  }

  logData() {
    console.log('Player Data:', this.playerData);
  }

  // ============ Resource Management Methods ============

  /**
   * Get the current amount of a specific resource
   */
  getResource(type: keyof PlayerData['resources']): number {
    return this.playerData.resources[type];
  }

  /**
   * Get all resources as an object
   */
  getAllResources(): PlayerData['resources'] {
    return { ...this.playerData.resources };
  }

  /**
   * Set a specific resource to an exact value
   */
  setResource(type: keyof PlayerData['resources'], amount: number): void {
    this.playerData.resources[type] = Math.max(0, amount);
  }

  /**
   * Add an amount to a specific resource
   */
  addResource(type: keyof PlayerData['resources'], amount: number): void {
    this.playerData.resources[type] = Math.max(
      0,
      this.playerData.resources[type] + amount
    );
  }

  /**
   * Spend/subtract an amount from a specific resource
   * @returns true if the resource was spent, false if insufficient
   */
  spendResource(type: keyof PlayerData['resources'], amount: number): boolean {
    if (this.playerData.resources[type] >= amount) {
      this.playerData.resources[type] -= amount;
      return true;
    }
    return false;
  }

  /**
   * Check if the player has enough of a specific resource
   */
  hasResource(type: keyof PlayerData['resources'], amount: number): boolean {
    return this.playerData.resources[type] >= amount;
  }

  /**
   * Check if the player can afford a cost of multiple resources
   */
  canAfford(cost: Partial<PlayerData['resources']>): boolean {
    for (const [type, amount] of Object.entries(cost) as [
      keyof PlayerData['resources'],
      number,
    ][]) {
      if (this.playerData.resources[type] < amount) {
        console.warn(
          `Cannot afford ${amount} ${type}. Current: ${this.playerData.resources[type]}`
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
  spendResources(cost: Partial<PlayerData['resources']>): boolean {
    if (!this.canAfford(cost)) {
      return false;
    }
    for (const [type, amount] of Object.entries(cost) as [
      keyof PlayerData['resources'],
      number,
    ][]) {
      this.playerData.resources[type] -= amount;
    }
    return true;
  }

  /**
   * Add multiple resources at once (for rewards/income)
   */
  addResources(resources: Partial<PlayerData['resources']>): void {
    for (const [type, amount] of Object.entries(resources) as [
      keyof PlayerData['resources'],
      number,
    ][]) {
      this.playerData.resources[type] = Math.max(
        0,
        this.playerData.resources[type] + amount
      );
    }
  }

  /**
   * Reset all resources to zero
   */
  resetResources(): void {
    this.playerData.resources = {
      gold: 0,
      materials: 0,
      food: 0,
      population: 0,
    };
  }
}
