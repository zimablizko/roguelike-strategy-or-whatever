import { CONFIG } from '../_common/config';
import type { StateBuildingId } from '../_common/models/buildings.models';
import type {
  MilitaryThreat,
  ThreatOutcome,
} from '../_common/models/military.models';
import type {
  ResourceCost,
  ResourceType,
} from '../_common/models/resource.models';
import { FOOD_RESOURCE_TYPES } from '../_common/models/resource.models';
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
import { MilitaryManager } from './MilitaryManager';
import { PoliticsManager } from './PoliticsManager';
import { ResearchManager } from './ResearchManager';
import { ResourceManager } from './ResourceManager';
import { RulerManager } from './RulerManager';

export class TurnManager {
  private static readonly HOUSE_TAX_TECHNOLOGY_ID = 'eco-tax-collection';
  private static readonly HOUSE_TAX_GOLD_PER_TURN = 2;

  /** Calendar start year. Turn 1 = January of this year. */
  static readonly START_YEAR = 1000;

  /** Month names used for date display. */
  private static readonly MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ] as const;

  /**
   * Convert a 1-based turn number to { month, year }.
   * Turn 1 = January START_YEAR, Turn 13 = January (START_YEAR + 1), etc.
   */
  static turnToDate(turnNumber: number): { month: string; year: number } {
    const idx = (turnNumber - 1) % 12;
    const year = TurnManager.START_YEAR + Math.floor((turnNumber - 1) / 12);
    return { month: TurnManager.MONTH_NAMES[idx], year };
  }

  /**
   * Returns a formatted date label for the current turn, e.g. "January, 1000".
   */
  getDateLabel(): string {
    const { month, year } = TurnManager.turnToDate(this.turnData.turnNumber);
    return `${month}, ${year}`;
  }

  private turnData: TurnData;
  private resourceManager: ResourceManager;
  private rulerManager: RulerManager;
  private buildingManager: BuildingManager;
  private mapManager?: MapManager;
  private researchManager?: ResearchManager;
  private militaryManager?: MilitaryManager;
  private politicsManager?: PoliticsManager;
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
      militaryManager?: MilitaryManager;
      politicsManager?: PoliticsManager;
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
    this.militaryManager = options?.militaryManager;
    this.politicsManager = options?.politicsManager;
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
    this.buildingManager.advanceBuildingConstruction();

    this.turnData.turnNumber++;
    this.resetFocus();
    this.turnVersion++;

    // Age increments once per year (every 12 months, when January starts).
    if ((this.turnData.turnNumber - 1) % 12 === 0) {
      this.rulerManager.incrementAge();
    }

    const researchUpdate = this.researchManager?.advanceTurn(
      this.turnData.turnNumber
    );

    // Advance military training queues.
    const trainedUnits = this.militaryManager?.advanceTraining() ?? [];
    if (trainedUnits.length > 0) {
      console.log(
        'Training completed:',
        trainedUnits.map((u) => `${u.count}x ${u.unitId}`).join(', ')
      );
    }

    // Resolve military threats and generate new ones.
    let threatOutcomes: ThreatOutcome[] = [];
    let newThreats: MilitaryThreat[] = [];
    if (CONFIG.MILITARY_THREATS_ENABLED) {
      threatOutcomes = this.militaryManager?.resolveThreats(this.rng) ?? [];
      for (const outcome of threatOutcomes) {
        // Apply resource losses from defeats
        if (!outcome.victory) {
          for (const [res, amount] of Object.entries(outcome.resourceLosses)) {
            if (amount && amount > 0) {
              this.resourceManager.addResource(res as ResourceType, -amount);
            }
          }
        }
      }
      newThreats =
        this.militaryManager?.generateThreats(
          this.turnData.turnNumber,
          this.rng
        ) ?? [];
      if (newThreats.length > 0) {
        console.log(
          'New threats:',
          newThreats.map((t) => `${t.name} (power ${t.enemyPower})`).join(', ')
        );
      }
    }

    console.log(`Turn ${this.turnData.turnNumber} ended.`);

    // Generate political requests for the new turn.
    this.politicsManager?.generateTurnRequests(
      this.turnData.turnNumber,
      this.rng
    );

    const upkeepCost = this.getUpkeepCost();
    const upkeepPaid = this.resourceManager.spendResources(upkeepCost);

    // Pay food upkeep from the fungible food pool (any food type can cover it).
    const foodUpkeepPaid = upkeepPaid ? this.payFoodUpkeep() : false;

    if (!upkeepPaid || !foodUpkeepPaid) {
      console.warn('Game Over: Not enough resources to continue!');
    }

    return {
      passiveIncome: passiveIncome.byResource,
      passiveIncomePulses: passiveIncome.pulses,
      completedResearch: researchUpdate?.completedResearch,
      upkeepPaid: upkeepPaid && foodUpkeepPaid,
      threatOutcomes,
      newThreats,
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
   * Returns only non-food costs; food is handled separately via {@link payFoodUpkeep}.
   */
  getUpkeepCost(): ResourceCost {
    const base = { ...CONFIG.UPKEEP_COST } as ResourceCost;
    // Strip food keys — food upkeep is paid from the fungible food pool.
    for (const key of FOOD_RESOURCE_TYPES) {
      delete base[key];
    }
    return base;
  }

  /** Total food required this turn (ceil(population / 2)). */
  getFoodUpkeepTotal(): number {
    return Math.ceil(this.buildingManager.getTotalPopulation() / 2);
  }

  /**
   * Pay the food upkeep by drawing from any available food-type resource.
   * Deducts greedily in {@link FOOD_RESOURCE_TYPES} order.
   * @returns true if the full food cost was covered.
   */
  private payFoodUpkeep(): boolean {
    let remaining = this.getFoodUpkeepTotal();
    if (remaining <= 0) return true;

    // Check total food supply across all types first.
    let totalAvailable = 0;
    for (const type of FOOD_RESOURCE_TYPES) {
      totalAvailable += this.resourceManager.getResource(type);
    }
    if (totalAvailable < remaining) return false;

    // Deduct from each food type in order.
    for (const type of FOOD_RESOURCE_TYPES) {
      const available = this.resourceManager.getResource(type);
      const deduct = Math.min(available, remaining);
      if (deduct > 0) {
        this.resourceManager.spendResource(type, deduct);
        remaining -= deduct;
      }
      if (remaining <= 0) break;
    }
    return true;
  }

  /**
   * Detailed breakdown of upkeep costs for UI display.
   */
  getUpkeepBreakdown(): UpkeepBreakdown {
    const totalPop = this.buildingManager.getTotalPopulation();
    const baseCost = CONFIG.UPKEEP_COST as ResourceCost;
    const baseGold = baseCost.gold ?? 0;
    const totalFood = this.getFoodUpkeepTotal();

    let totalFoodAvailable = 0;
    for (const type of FOOD_RESOURCE_TYPES) {
      totalFoodAvailable += this.resourceManager.getResource(type);
    }

    return {
      baseGold,
      populationFood: totalFood,
      totalGold: baseGold,
      totalFoodAvailable,
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
      // Skip buildings still under construction.
      if (
        instance.turnsRemaining !== undefined &&
        instance.turnsRemaining > 0
      ) {
        continue;
      }

      const centerX = instance.x + (instance.width - 1) / 2;
      const centerY = instance.y + (instance.height - 1) / 2;

      // Bakery: passively converts Wheat into Bread.
      if (instance.buildingId === 'bakery') {
        const wheatAvailable = this.resourceManager.getResource('wheat');
        const wheatCost = 2;
        const breadProduced = 3;
        if (wheatAvailable >= wheatCost) {
          this.resourceManager.addResource('wheat', -wheatCost);
          addIncome(centerX, centerY, 'bread', breadProduced);
        }
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
