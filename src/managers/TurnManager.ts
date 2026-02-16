import { CONFIG } from '../_common/config';
import { SeededRandom } from '../_common/random';
import type {
  EndTurnIncomePulse,
  EndTurnResult,
  TurnData,
} from '../_common/models/turn.models';
import type { StateBuildingId } from '../_common/models/buildings.models';
import type { ResourceType } from '../_common/models/resource.models';
import { buildingPassiveIncome } from '../data/buildings';
import { BuildingManager } from './BuildingManager';
import { ResearchManager } from './ResearchManager';
import { ResourceManager } from './ResourceManager';
import { RulerManager } from './RulerManager';

export class TurnManager {
  private turnData: TurnData;
  private resourceManager: ResourceManager;
  private rulerManager: RulerManager;
  private buildingManager: BuildingManager;
  private researchManager?: ResearchManager;
  private readonly rng: SeededRandom;
  private turnVersion = 0;

  constructor(
    resourceManager: ResourceManager,
    rulerManager: RulerManager,
    buildingManager: BuildingManager,
    options?: {
      maxActionPoints?: number;
      rng?: SeededRandom;
      researchManager?: ResearchManager;
    }
  ) {
    const maxAP = options?.maxActionPoints ?? 10;
    this.turnData = {
      turnNumber: 1,
      actionPoints: {
        current: maxAP,
        max: maxAP,
      },
    };
    this.resourceManager = resourceManager;
    this.rulerManager = rulerManager;
    this.buildingManager = buildingManager;
    this.researchManager = options?.researchManager;
    this.rng = options?.rng ?? new SeededRandom();
  }

  endTurn(): EndTurnResult {
    const passiveIncome = this.applyPassiveBuildingIncome();

    this.turnData.turnNumber++;
    this.resetActionPoints();
    this.turnVersion++;

    // Requirement: age increments on end of turn.
    this.rulerManager.incrementAge();

    const researchUpdate = this.researchManager?.advanceTurn(
      this.turnData.turnNumber
    );

    console.log(`Turn ${this.turnData.turnNumber} ended.`);
    const upkeepPaid = this.resourceManager.spendResources(CONFIG.UPKEEP_COST);

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

  getTurnVersion(): number {
    return this.turnVersion;
  }

  spendActionPoints(amount: number): boolean {
    if (this.turnData.actionPoints.current >= amount) {
      this.turnData.actionPoints.current -= amount;
      this.turnVersion++;
      return true;
    }
    return false;
  }

  resetActionPoints(): void {
    this.turnData.actionPoints.current = this.turnData.actionPoints.max;
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

    for (const instance of buildingInstances) {
      const centerX = instance.x + (instance.width - 1) / 2;
      const centerY = instance.y + (instance.height - 1) / 2;

      const incomeEntries =
        buildingPassiveIncome[instance.buildingId as StateBuildingId];
      if (!incomeEntries) {
        continue;
      }

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
    }

    return { byResource, pulses };
  }
}
