import { Color, Engine, Scene, type SceneActivationContext } from 'excalibur';
import { GameManager } from '../managers/GameManager';
import { ResourceManager } from '../managers/ResourceManager';
import { TurnManager } from '../managers/TurnManager';
import { ResourceDisplay } from '../ui/elements/ResourceDisplay';
import { RulerDisplay } from '../ui/elements/RulerDisplay';
import { ScreenButton } from '../ui/elements/ScreenButton';
import { ScreenPopup } from '../ui/elements/ScreenPopup';
import { TurnDisplay } from '../ui/elements/TurnDisplay';

/**
 * Demo scene showcasing the ECS pattern
 */
export class GameplayScene extends Scene {
  private gameManager!: GameManager;
  private resourceManager!: ResourceManager;
  private turnManager!: TurnManager;
  private testPopup?: ScreenPopup;

  onInitialize(_engine: Engine): void {
    // Set background color
    this.backgroundColor = Color.fromHex('#2c3e50');
  }

  onActivate(context: SceneActivationContext): void {
    // Excalibur Scenes are initialized once, then re-activated many times.
    // Reset state on activation so starting a new game gets fresh defaults.
    this.resetGame(context.engine);
  }

  private resetGame(engine: Engine): void {
    // Remove all actors/entities/timers from the previous run
    this.clear();
    this.testPopup = undefined;

    // Recreate managers with default new-game data
    this.gameManager = new GameManager({
      playerData: {
        race: 'human',
        resources: {
          gold: 100,
          materials: 50,
          food: 75,
          population: 10,
        },
      },
    });
    this.resourceManager = this.gameManager.resourceManager;
    this.turnManager = new TurnManager(
      this.resourceManager,
      this.gameManager.rulerManager,
      engine
    );

    this.gameManager.logData();

    // Re-add UI
    this.addRulerDisplay(engine);
    this.addResourceDisplay(engine);
    this.addTurnDisplay(engine);
    this.addButtons(engine);
  }

  private addRulerDisplay(_engine: Engine) {
    this.add(
      new RulerDisplay({
        x: 20,
        y: 20,
        rulerManager: this.gameManager.rulerManager,
      })
    );
  }

  private addResourceDisplay(engine: Engine) {
    this.add(
      new ResourceDisplay({
        x: engine.drawWidth - 20,
        y: 20,
        bgColor: Color.fromHex('#1a252f'),
        resourceManager: this.resourceManager,
        anchor: 'top-right',
      })
    );
  }

  private addTurnDisplay(engine: Engine) {
    this.add(
      new TurnDisplay({
        x: engine.drawWidth / 2,
        y: 20,
        turnManager: this.turnManager,
      })
    );
  }

  private addButtons(engine: Engine) {
    // little Back to Main Menu button in left top corner
    this.add(
      new ScreenButton({
        x: 20,
        y: engine.drawHeight - 110,
        width: 100,
        height: 40,
        title: 'Exit',
        onClick: () => {
          engine.goToScene('main-menu');
        },
      })
    );

    this.add(
      new ScreenButton({
        x: 20,
        y: engine.drawHeight - 60,
        width: 100,
        height: 40,
        title: 'Debug Menu',
        onClick: () => {
          this.showDebugMenu(engine);
        },
      })
    );

    // End Turn button in right bottom corner
    this.add(
      new ScreenButton({
        x: engine.drawWidth - 170,
        y: engine.drawHeight - 60,
        width: 150,
        height: 40,
        title: 'End Turn',
        onClick: () => {
          this.turnManager.endTurn();
        },
      })
    );
  }

  private showDebugMenu(engine: Engine) {
    const debugButtons: ScreenButton[] = [];
    debugButtons.push(
      //test button to add resources in left top corner below back button
      new ScreenButton({
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        title: 'Add Resources',
        onClick: () => {
          this.resourceManager.addResources({
            gold: 50,
            materials: 25,
            food: 40,
            population: 5,
          });
        },
      }),

      //test button to spend resources in left top corner below add resources button
      new ScreenButton({
        x: 0,
        y: 50,
        width: 100,
        height: 40,
        title: 'Spend Resources',
        onClick: () => {
          if (!this.turnManager.spendActionPoints(1)) return;
          this.resourceManager.spendResources({
            gold: 30,
            materials: 10,
            food: 20,
            population: 2,
          });
        },
      }),

      new ScreenButton({
        x: 0,
        y: 100,
        width: 120,
        height: 40,
        title: 'New Ruler',
        onClick: () => {
          this.gameManager.rulerManager.regenerate();
        },
      })
    );

    // Close existing popup if any
    if (this.testPopup) {
      this.testPopup.close();
      this.testPopup = undefined;
    }

    const popup = new ScreenPopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      anchor: 'center',
      width: 520,
      height: 300,
      title: 'Debug Menu',
      content: debugButtons,
      onClose: () => {
        this.testPopup = undefined;
      },
      contentBuilder: () => {},
    });

    this.testPopup = popup;
    this.add(popup);
  }
}
