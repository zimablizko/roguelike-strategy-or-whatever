import { CONFIG } from '../_common/config';
import type { StateBuildingId } from '../_common/models/buildings.models';
import type {
  ResourceCost,
  ResourceType,
} from '../_common/models/resource.models';
import type {
  EndTurnIncomePulse,
  EndTurnResult,
  TurnData,
  UpkeepBreakdown,
} from '../_common/models/turn.models';
import { SeededRandom } from '../_common/random';
import { buildingPassiveIncome } from '../data/buildings';
import {
  rareResourceDefinitions,
  type RareResourceId,
} from '../data/rareResources';
import { BuildingManager } from './BuildingManager';
import { MapManager } from './MapManager';
import { ResearchManager } from './ResearchManager';
import { ResourceManager } from './ResourceManager';
import { RulerManager } from './RulerManager';

export class TurnManager {
  private static readonly HOUSE_TAX_TECHNOLOGY_ID = 'eco-tax-collection';
  private static readonly HOUSE_TAX_GOLD_PER_TURN = 2;

  private turnData: TurnData;
  private resourceManager: ResourceManager;
  private rulerManager: RulerManager;
  private buildingManager: BuildingManager;
  private mapManager?: MapManager;
  private researchManager?: ResearchManager;
  private readonly rng: SeededRandom;
  private turnVersion = 0;
  /** Tracks fallow field tiles awaiting recovery. Key: "x,y", value: turns remaining. */
  private emptyFieldRecovery = new Map<string, number>();

  constructor(
    resourceManager: ResourceManager,
    rulerManager: RulerManager,
    buildingManager: BuildingManager,
    options?: {
      maxFocus?: number;
      rng?: SeededRandom;
      mapManager?: MapManager;
      researchManager?: ResearchManager;
      initial?: {
        data?: TurnData;
        version?: number;
        emptyFieldQueue?: Array<{ x: number; y: number; turnsLeft: number }>;
      };
    }
  ) {
    const maxFocus = options?.maxFocus ?? 10;
    const initialData = options?.initial?.data;
    const initialMax = Math.max(
      1,
      Math.floor(initialData?.focus.max ?? maxFocus)
    );
    const initialCurrent = Math.min(
      initialMax,
      Math.max(0, Math.floor(initialData?.focus.current ?? initialMax))
    );
    this.turnData = {
      turnNumber: Math.max(1, Math.floor(initialData?.turnNumber ?? 1)),
      focus: {
        current: initialCurrent,
        max: initialMax,
      },
    };
    this.resourceManager = resourceManager;
    this.rulerManager = rulerManager;
    this.buildingManager = buildingManager;
    this.mapManager = options?.mapManager;
    this.researchManager = options?.researchManager;
    this.rng = options?.rng ?? new SeededRandom();
    this.turnVersion = Math.max(0, Math.floor(options?.initial?.version ?? 0));
    for (const entry of options?.initial?.emptyFieldQueue ?? []) {
      this.emptyFieldRecovery.set(
        `${entry.x},${entry.y}`,
        Math.max(1, entry.turnsLeft)
      );
    }
  }

  endTurn(): EndTurnResult {
    const passiveIncome = this.applyPassiveBuildingIncome();
    this.processFieldRecovery();

    this.turnData.turnNumber++;
    this.resetFocus();
    this.turnVersion++;

    // Requirement: age increments on end of turn.
    this.rulerManager.incrementAge();

    const researchUpdate = this.researchManager?.advanceTurn(
      this.turnData.turnNumber
    );

    console.log(`Turn ${this.turnData.turnNumber} ended.`);
    const upkeepCost = this.getUpkeepCost();
    const upkeepPaid = this.resourceManager.spendResources(upkeepCost);

    if (!upkeepPaid) {
      console.warn('Game Over: Not enough resources to continue!');
    }

    return {
      passiveIncome: passiveIncome.byResource,
      passiveIncomePulses: passiveIncome.pulses,
      completedResearch: researchUpdate?.completedResearch,
      upkeepPaid,
    };
  }

  getTurnData(): TurnData {
    return { ...this.turnData };
  }

  /**
   * Get turn data by reference (read-only view).
   * Use for hot UI polling paths to avoid per-frame allocations.
   */
  getTurnDataRef(): Readonly<TurnData> {
    return this.turnData;
  }

  /**
   * Returns the number of turns remaining until a fallow field at (x, y)
   * recovers, or undefined if the tile is not tracked.
   */
  getEmptyFieldTurnsLeft(x: number, y: number): number | undefined {
    return this.emptyFieldRecovery.get(`${x},${y}`);
  }

  /**
   * Returns the fallow-field recovery queue for serialization.
   */
  getEmptyFieldQueue(): Array<{ x: number; y: number; turnsLeft: number }> {
    return Array.from(this.emptyFieldRecovery.entries()).map(
      ([key, turnsLeft]) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y, turnsLeft };
      }
    );
  }

  getTurnVersion(): number {
    return this.turnVersion;
  }

  /**
   * Calculate the dynamic upkeep cost for the current turn.
   * Base cost from CONFIG + population-scaled food.
   */
  getUpkeepCost(): ResourceCost {
    const base = { ...CONFIG.UPKEEP_COST } as ResourceCost;
    const totalPop = this.buildingManager.getTotalPopulation();
    const foodFromPop = Math.ceil(totalPop / 2);
    base.food = (base.food ?? 0) + foodFromPop;
    return base;
  }

  /**
   * Detailed breakdown of upkeep costs for UI display.
   */
  getUpkeepBreakdown(): UpkeepBreakdown {
    const totalPop = this.buildingManager.getTotalPopulation();
    const baseCost = CONFIG.UPKEEP_COST as ResourceCost;
    const baseFood = baseCost.food ?? 0;
    const baseGold = baseCost.gold ?? 0;
    const populationFood = Math.ceil(totalPop / 2);
    return {
      baseFood,
      baseGold,
      populationFood,
      totalFood: baseFood + populationFood,
      totalGold: baseGold,
      totalPopulation: totalPop,
    };
  }

  spendFocus(amount: number): boolean {
    if (this.turnData.focus.current >= amount) {
      this.turnData.focus.current -= amount;
      this.turnVersion++;
      return true;
    }
    return false;
  }

  resetFocus(): void {
    this.turnData.focus.current = this.turnData.focus.max;
    this.buildingManager.resetActionUsage();
  }

  /**
   * Discovers newly emptied field tiles, advances the recovery countdown, and
   * restores tiles that have completed their 3-turn fallow period.
   */
  private processFieldRecovery(): void {
    if (!this.mapManager) return;
    const map = this.mapManager.getMapRef();

    // Register newly discovered field-empty tiles.
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const key = `${x},${y}`;
        if (
          map.tiles[y][x] === 'field-empty' &&
          !this.emptyFieldRecovery.has(key)
        ) {
          this.emptyFieldRecovery.set(key, 3);
        }
      }
    }

    // Prune entries whose tiles are no longer field-empty (edge-case cleanup).
    for (const key of this.emptyFieldRecovery.keys()) {
      const [x, y] = key.split(',').map(Number);
      if (map.tiles[y]?.[x] !== 'field-empty') {
        this.emptyFieldRecovery.delete(key);
      }
    }

    // Decrement counters and recover zero-remaining tiles.
    let anyRecovered = false;
    for (const [key, turnsLeft] of this.emptyFieldRecovery) {
      if (turnsLeft <= 1) {
        const [x, y] = key.split(',').map(Number);
        this.mapManager.setTile(x, y, 'field');
        this.emptyFieldRecovery.delete(key);
        anyRecovered = true;
      } else {
        this.emptyFieldRecovery.set(key, turnsLeft - 1);
      }
    }

    if (anyRecovered) {
      this.buildingManager.notifyMapChanged();
    }
  }

  private applyPassiveBuildingIncome(): {
    byResource: Partial<Record<ResourceType, number>>;
    pulses: EndTurnIncomePulse[];
  } {
    const byResource: Partial<Record<ResourceType, number>> = {};
    const pulses: EndTurnIncomePulse[] = [];
    const buildingInstances = this.buildingManager.getBuildingInstancesRef();

    const addIncome = (
      tileX: number,
      tileY: number,
      resourceType: ResourceType,
      amount: number
    ): void => {
      if (amount <= 0) {
        return;
      }

      this.resourceManager.addResource(resourceType, amount);
      byResource[resourceType] = (byResource[resourceType] ?? 0) + amount;
      pulses.push({
        tileX,
        tileY,
        resourceType,
        amount,
      });
    };

    const hasHouseTaxCollection = this.buildingManager.isTechnologyUnlocked(
      TurnManager.HOUSE_TAX_TECHNOLOGY_ID
    );

    for (const instance of buildingInstances) {
      const centerX = instance.x + (instance.width - 1) / 2;
      const centerY = instance.y + (instance.height - 1) / 2;

      // Farm: emit a single combined pulse of base food + field bonus.
      if (instance.buildingId === 'farm') {
        const fieldCount = this.buildingManager.getFarmFieldCount(
          instance.instanceId,
          2
        );
        const totalFarmFood = 10 + fieldCount * 3;
        addIncome(centerX, centerY, 'food', totalFarmFood);
        continue;
      }

      const incomeEntries =
        buildingPassiveIncome[instance.buildingId as StateBuildingId] ?? [];

      for (const entry of incomeEntries) {
        let amount: number;
        if (typeof entry.amount === 'string') {
          // Parse "random:min:max" format
          const parts = entry.amount.split(':');
          const min = parseInt(parts[1], 10);
          const max = parseInt(parts[2], 10);
          amount = this.rng.randomInt(min, max);
        } else {
          amount = entry.amount;
        }
        addIncome(centerX, centerY, entry.resourceType, amount);
      }

      if (hasHouseTaxCollection && instance.buildingId === 'house') {
        addIncome(
          centerX,
          centerY,
          'gold',
          TurnManager.HOUSE_TAX_GOLD_PER_TURN
        );
      }

      // Rare resource bonuses
      if (this.mapManager) {
        const rareResources = this.mapManager.getMapRef().rareResources;
        for (let ty = instance.y; ty < instance.y + instance.height; ty++) {
          for (let tx = instance.x; tx < instance.x + instance.width; tx++) {
            const rr = rareResources[`${tx},${ty}`];
            if (!rr) continue;
            const def =
              rareResourceDefinitions[rr.resourceId as RareResourceId];
            if (!def || def.bonusBuilding !== instance.buildingId) continue;
            const rawAmount = def.bonus.amount as
              | number
              | `random:${number}:${number}`;
            let bonusAmount: number;
            if (typeof rawAmount === 'string') {
              const parts = rawAmount.split(':');
              bonusAmount = this.rng.randomInt(
                parseInt(parts[1], 10),
                parseInt(parts[2], 10)
              );
            } else {
              bonusAmount = rawAmount;
            }
            addIncome(centerX, centerY, def.bonus.resourceType, bonusAmount);
          }
        }
      }
    }

    return { byResource, pulses };
  }
}
