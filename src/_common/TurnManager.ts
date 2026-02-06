import { Engine } from 'excalibur';
import { GameManager } from './GameManager';

export class TurnManager {
  private currentTurn: number = 0;
  private gameManager!: GameManager;
  private engine: Engine;

  constructor(gameManager: GameManager, engine: Engine) {
    this.gameManager = gameManager;
    this.engine = engine;
  }

  endTurn(): void {
    this.currentTurn++;
    console.log(`Turn ${this.currentTurn} ended.`);
    if (
      !this.gameManager.spendResources({
        food: 10,
        gold: 5,
      })
    ) {
      console.warn('Game Over: Not enough resources to continue!');
      this.engine.goToScene('game-over');
    }
  }
}
