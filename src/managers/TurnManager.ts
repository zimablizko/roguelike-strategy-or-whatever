import { Engine } from 'excalibur';
import { ResourceManager } from './ResourceManager';
import { RulerManager } from './RulerManager';

export type TurnData = {
  turnNumber: number;
  actionPoints: {
    current: number;
    max: number;
  };
};

export class TurnManager {
  private turnData: TurnData;
  private resourceManager: ResourceManager;
  private rulerManager: RulerManager;
  private engine: Engine;

  constructor(
    resourceManager: ResourceManager,
    rulerManager: RulerManager,
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
    this.engine = engine;
  }

  endTurn(): void {
    this.turnData.turnNumber++;
    this.resetActionPoints();

    // Requirement: age increments on end of turn.
    this.rulerManager.incrementAge();

    console.log(`Turn ${this.turnData.turnNumber} ended.`);
    if (
      !this.resourceManager.spendResources({
        food: 10,
        gold: 5,
      })
    ) {
      console.warn('Game Over: Not enough resources to continue!');
      this.engine.goToScene('game-over');
    }
  }

  getTurnData(): TurnData {
    return { ...this.turnData };
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
}
