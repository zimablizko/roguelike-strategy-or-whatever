import { Engine } from 'excalibur';
import { ResourceManager, type ResourceType } from './ResourceManager';
import { RulerManager } from './RulerManager';
import { StateManager } from './StateManager';

export type TurnData = {
  turnNumber: number;
  actionPoints: {
    current: number;
    max: number;
  };
};

export interface EndTurnIncomePulse {
  tileX: number;
  tileY: number;
  resourceType: ResourceType;
  amount: number;
}

export interface EndTurnResult {
  passiveIncome: Partial<Record<ResourceType, number>>;
  passiveIncomePulses: EndTurnIncomePulse[];
  upkeepPaid: boolean;
}

export class TurnManager {
  private turnData: TurnData;
  private resourceManager: ResourceManager;
  private rulerManager: RulerManager;
  private stateManager: StateManager;
  private engine: Engine;

  constructor(
    resourceManager: ResourceManager,
    rulerManager: RulerManager,
    stateManager: StateManager,
    engine: Engine,
    maxActionPoints = 10
  ) {
    this.turnData = {
      turnNumber: 1,
      actionPoints: {
        current: maxActionPoints,
        max: maxActionPoints,
      },
    };
    this.resourceManager = resourceManager;
    this.rulerManager = rulerManager;
    this.stateManager = stateManager;
    this.engine = engine;
  }

  endTurn(): EndTurnResult {
    const passiveIncome = this.applyPassiveBuildingIncome();

    this.turnData.turnNumber++;
    this.resetActionPoints();

    // Requirement: age increments on end of turn.
    this.rulerManager.incrementAge();

    console.log(`Turn ${this.turnData.turnNumber} ended.`);
    const upkeepPaid = this.resourceManager.spendResources({
      food: 10,
      gold: 5,
    });

    if (!upkeepPaid) {
      console.warn('Game Over: Not enough resources to continue!');
      this.engine.goToScene('game-over');
    }

    return {
      passiveIncome: passiveIncome.byResource,
      passiveIncomePulses: passiveIncome.pulses,
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

  spendActionPoints(amount: number): boolean {
    if (this.turnData.actionPoints.current >= amount) {
      this.turnData.actionPoints.current -= amount;
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
    const buildingInstances = this.stateManager.getBuildingInstancesRef();

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

      if (instance.buildingId === 'castle') {
        addIncome(centerX, centerY, 'gold', 5);
        addIncome(centerX, centerY, 'food', 5);
        addIncome(centerX, centerY, 'materials', 5);
        continue;
      }

      if (instance.buildingId === 'lumbermill') {
        addIncome(centerX, centerY, 'materials', 10);
        continue;
      }

      if (instance.buildingId === 'mine') {
        addIncome(centerX, centerY, 'materials', this.randomInt(5, 20));
        continue;
      }

      if (instance.buildingId === 'farm') {
        addIncome(centerX, centerY, 'food', 10);
      }
    }

    return { byResource, pulses };
  }

  private randomInt(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }
}
