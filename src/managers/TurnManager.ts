import { CONFIG } from '../_common/config';
import type { StateBuildingId } from '../_common/models/buildings.models';
import type { RandomEventPresentation } from '../_common/models/random-events.models';
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
import type { GameLogManager } from './GameLogManager';
import { MapManager } from './MapManager';
import { MilitaryManager } from './MilitaryManager';
import { PoliticsManager } from './PoliticsManager';
import { RandomEventManager } from './RandomEventManager';
import { ResearchManager } from './ResearchManager';
import { ResourceManager } from './ResourceManager';
import { RulerManager } from './RulerManager';

export class TurnManager {
  private static readonly HOUSE_TAX_TECHNOLOGY_ID = 'eco-tax-collection';
  private static readonly HOUSE_TAX_GOLD_PER_TURN = 2;

  /** Calendar start year. Turn 1 = January 1 of this year. */
  static readonly START_YEAR = 1000;

  /** Number of days per month (simplified calendar). */
  static readonly DAYS_PER_MONTH = 30;

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
   * Convert a 1-based turn number to { day, month, year }.
   * Turn 1 = January 1 START_YEAR, Turn 31 = February 1 START_YEAR, etc.
   * Each turn equals 1 day; each month has {@link DAYS_PER_MONTH} days.
   */
  static turnToDate(turnNumber: number): {
    day: number;
    month: string;
    year: number;
  } {
    const totalDays = turnNumber - 1; // 0-indexed
    const day = (totalDays % TurnManager.DAYS_PER_MONTH) + 1;
    const totalMonths = Math.floor(totalDays / TurnManager.DAYS_PER_MONTH);
    const monthIndex = totalMonths % 12;
    const year = TurnManager.START_YEAR + Math.floor(totalMonths / 12);
    return { day, month: TurnManager.MONTH_NAMES[monthIndex], year };
  }

  /**
   * Returns a formatted date label for the current turn, e.g. "15 January, 1000".
   */
  getDateLabel(): string {
    const { day, month, year } = TurnManager.turnToDate(
      this.turnData.turnNumber
    );
    return `${day} ${month}, ${year}`;
  }

  getNextUpkeepTurnNumber(): number {
    const currentTurn = this.turnData.turnNumber;
    const dayInMonth = ((currentTurn - 1) % TurnManager.DAYS_PER_MONTH) + 1;
    const daysUntilNextMonth = TurnManager.DAYS_PER_MONTH - dayInMonth + 1;
    return currentTurn + daysUntilNextMonth;
  }

  getNextUpkeepDateLabel(): string {
    const { day, month, year } = TurnManager.turnToDate(
      this.getNextUpkeepTurnNumber()
    );
    return `${day} ${month}, ${year}`;
  }

  private turnData: TurnData;
  private resourceManager: ResourceManager;
  private rulerManager: RulerManager;
  private buildingManager: BuildingManager;
  private mapManager?: MapManager;
  private researchManager?: ResearchManager;
  private militaryManager?: MilitaryManager;
  private politicsManager?: PoliticsManager;
  private randomEventManager?: RandomEventManager;
  private logManager?: GameLogManager;
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
      randomEventManager?: RandomEventManager;
      logManager?: GameLogManager;
      initial?: {
        data?: TurnData;
        version?: number;
        emptyFieldQueue?: Array<{ x: number; y: number; turnsLeft: number }>;
      };
    }
  ) {
    const maxFocus = options?.maxFocus ?? rulerManager.getFocus();
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
    this.randomEventManager = options?.randomEventManager;
    this.logManager = options?.logManager;
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
    const recoveredTiles = this.processFieldRecovery();
    this.buildingManager.advanceBuildingConstruction();
    const actionPulses = this.buildingManager.advanceBuildingActionProgress(
      this.militaryManager
    );

    // Process automatic farm work modes (sow / harvest)
    const farmPulses =
      this.buildingManager.processFarmWorkModes(recoveredTiles);
    for (const pulse of farmPulses) {
      if (pulse.resourceType && pulse.amount) {
        this.resourceManager.addResource(pulse.resourceType, pulse.amount);
      }
    }
    actionPulses.push(...farmPulses);

    this.turnData.turnNumber++;
    this.resetFocus();
    this.turnVersion++;
    this.logManager?.setCurrentDate(
      this.turnData.turnNumber,
      this.getDateLabel()
    );
    let pendingRandomEvent: RandomEventPresentation | undefined;

    // Age increments once per year (every 360 days = 12 months, when January 1 starts).
    if ((this.turnData.turnNumber - 1) % 360 === 0) {
      this.rulerManager.incrementAge();
    }

    const researchUpdate = this.researchManager?.advanceTurn(
      this.turnData.turnNumber
    );

    console.log(`Turn ${this.turnData.turnNumber} ended.`);

    // Generate political requests for the new turn.
    this.politicsManager?.generateTurnRequests(
      this.turnData.turnNumber,
      this.rng
    );
    pendingRandomEvent = this.randomEventManager?.rollForTurn(
      this.turnData.turnNumber
    );

    // Upkeep is paid at the beginning of each month (day 1 of any month after the first).
    const isMonthStart =
      (this.turnData.turnNumber - 1) % TurnManager.DAYS_PER_MONTH === 0 &&
      this.turnData.turnNumber > 1;

    let upkeepPaid = true;
    if (isMonthStart) {
      const upkeepCost = this.getUpkeepCost();
      const resourcesOk = this.resourceManager.spendResources(upkeepCost);
      // Pay food upkeep from the fungible food pool (any food type can cover it).
      const foodOk = resourcesOk ? this.payFoodUpkeep() : false;
      upkeepPaid = resourcesOk && foodOk;
      if (!upkeepPaid) {
        console.warn('Game Over: Not enough resources to continue!');
        this.logManager?.addBad(
          `Upkeep could not be paid on ${this.getDateLabel()}.`
        );
      }
    }

    return {
      passiveIncome: passiveIncome.byResource,
      passiveIncomePulses: passiveIncome.pulses,
      actionPulses,
      completedResearch: researchUpdate?.completedResearch,
      pendingRandomEvent,
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

  /** Total food required this month (population * 2). */
  getFoodUpkeepTotal(): number {
    return this.buildingManager.getTotalPopulation() * 2;
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

  adjustFocus(delta: number): void {
    const next = Math.max(
      0,
      Math.min(this.turnData.focus.max, this.turnData.focus.current + delta)
    );
    if (next === this.turnData.focus.current) {
      return;
    }
    this.turnData.focus.current = next;
    this.turnVersion++;
  }

  resetFocus(): void {
    this.turnData.focus.current = this.turnData.focus.max;
    this.buildingManager.resetActionUsage();
  }

  /**
   * Discovers newly emptied field tiles, advances the recovery countdown, and
   * restores tiles that have completed their fallow period.
   * Default regrow: 12 turns. With Crop Rotation research: 6 turns.
   */
  private processFieldRecovery(): Set<string> {
    if (!this.mapManager) return new Set();
    const map = this.mapManager.getMapRef();
    const regrowTime = this.buildingManager.hasCropRotation() ? 6 : 12;

    // Register newly discovered field-empty tiles.
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const key = `${x},${y}`;
        if (
          map.tiles[y][x] === 'field-empty' &&
          !this.emptyFieldRecovery.has(key)
        ) {
          this.emptyFieldRecovery.set(key, regrowTime);
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
    const recoveredTiles = new Set<string>();
    for (const [key, turnsLeft] of this.emptyFieldRecovery) {
      if (turnsLeft <= 1) {
        const [x, y] = key.split(',').map(Number);
        const from = this.mapManager.getMapRef().tiles[y]?.[x];
        this.mapManager.setTile(x, y, 'field');
        this.randomEventManager?.recordTileChange({
          x,
          y,
          from,
          to: 'field',
          source: 'turn-recovery',
        });
        this.emptyFieldRecovery.delete(key);
        recoveredTiles.add(key);
        anyRecovered = true;
      } else {
        this.emptyFieldRecovery.set(key, turnsLeft - 1);
      }
    }

    if (anyRecovered) {
      this.buildingManager.notifyMapChanged();
    }
    return recoveredTiles;
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
