import {
  Color,
  Engine,
  Font,
  FontUnit,
  Label,
  Scene,
  TextAlign,
  vec,
} from 'excalibur';
import { GameManager } from '../_common/GameManager';
import { TurnManager } from '../_common/TurnManager';
import { ResourceDisplay } from '../ui/elements/ResourceDisplay';
import { ScreenButton } from '../ui/elements/ScreenButton';
import {
  ScreenList,
  type ScreenListButtonItem,
} from '../ui/elements/ScreenList';
import { ScreenPopup } from '../ui/elements/ScreenPopup';

/**
 * Demo scene showcasing the ECS pattern
 */
export class GameplayScene extends Scene {
  private gameManager!: GameManager;
  private turnManager!: TurnManager;
  private testPopup?: ScreenPopup;
  onInitialize(engine: Engine): void {
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
    this.turnManager = new TurnManager(this.gameManager, engine);
    this.gameManager.logData();

    // Set background color
    this.backgroundColor = Color.fromHex('#2c3e50');

    this.addResourceDisplay(engine);
    this.addButtons(engine);
  }

  private addResourceDisplay(engine: Engine) {
    const resourceDisplay = new ResourceDisplay({
      x: engine.drawWidth - 20,
      y: 20,
      bgColor: Color.fromHex('#1a252f'),
      gameManager: this.gameManager,
      anchor: 'top-right',
    });
    this.add(resourceDisplay);
  }

  private addButtons(engine: Engine) {
    // little Back to Main Menu button in left top corner
    const backButton = new ScreenButton({
      x: 20,
      y: 20,
      width: 150,
      height: 40,
      title: 'Exit',
    });
    this.add(backButton);
    backButton.on('pointerup', () => {
      engine.goToScene('main-menu');
    });

    //test button to add resources in left top corner below back button
    const addResourcesButton = new ScreenButton({
      x: 20,
      y: 70,
      width: 150,
      height: 40,
      title: 'Add Resources',
    });
    this.add(addResourcesButton);
    addResourcesButton.on('pointerup', () => {
      this.gameManager.addResources({
        gold: 50,
        materials: 25,
        food: 40,
        population: 5,
      });
    });

    //test button to spend resources in left top corner below add resources button
    const spendResourcesButton = new ScreenButton({
      x: 20,
      y: 120,
      width: 150,
      height: 40,
      title: 'Spend Resources',
    });
    this.add(spendResourcesButton);
    spendResourcesButton.on('pointerup', () => {
      this.gameManager.spendResources({
        gold: 30,
        materials: 10,
        food: 20,
        population: 2,
      });
    });

    // Test Popup button below spend resources
    const popupButton = new ScreenButton({
      x: 20,
      y: 170,
      width: 150,
      height: 40,
      title: 'Show Popup',
    });
    this.add(popupButton);
    popupButton.on('pointerup', () => {
      // Close existing popup if any
      if (this.testPopup) {
        this.testPopup.close();
        this.testPopup = undefined;
      }

      const resources = this.gameManager.getAllResources();
      const baseFont = new Font({
        size: 14,
        unit: FontUnit.Px,
        color: Color.White,
        textAlign: TextAlign.Left,
      });

      const testButton = new ScreenButton({
        x: 0,
        y: 0,
        width: 120,
        height: 30,
        title: 'Test Button',
      });
      testButton.on('pointerup', () => {
        console.log('Test Button in Popup clicked!');
      });

      this.testPopup = new ScreenPopup({
        x: engine.drawWidth / 2,
        y: engine.drawHeight / 2,
        anchor: 'center',
        width: 520,
        height: 300,
        title: 'Test Popup',
        content: testButton,
        onClose: () => {
          this.testPopup = undefined;
        },
        contentBuilder: (root) => {
          const lines = [
            'This is a reusable ScreenPopup.',
            'Click X to close it.',
            '',
            `Race: ${this.gameManager.playerData.race}`,
            `Gold: ${resources.gold}`,
            `Materials: ${resources.materials}`,
            `Food: ${resources.food}`,
            `Population: ${resources.population}`,
            '',
            'Try Add/Spend Resources then reopen.',
          ];

          let y = 0;
          for (const line of lines) {
            const label = new Label({
              text: line,
              pos: vec(0, y),
              font: baseFont,
            });
            root.addChild(label);
            y += 20;
          }
        },
      });

      this.add(this.testPopup);
    });

    // Test List button below popup button
    const listButton = new ScreenButton({
      x: 20,
      y: 220,
      width: 150,
      height: 40,
      title: 'Show List',
    });
    this.add(listButton);
    listButton.on('pointerup', () => {
      if (this.testPopup) {
        this.testPopup.close();
        this.testPopup = undefined;
      }

      const items: ScreenListButtonItem[] = [];
      for (let i = 1; i <= 30; i++) {
        items.push({
          title: `List Item ${i}`,
          onClick: () => {
            console.log(`Clicked List Item ${i}`);
          },
          disabled: i % 9 === 0,
        });
      }

      this.testPopup = new ScreenPopup({
        x: engine.drawWidth / 2,
        y: engine.drawHeight / 2,
        anchor: 'center',
        width: 600,
        height: 360,
        title: 'ScreenList Demo',
        onClose: () => {
          this.testPopup = undefined;
        },
        contentBuilder: (root) => {
          const list = new ScreenList({
            x: 0,
            y: 0,
            width: 560,
            height: 240,
            items,
            itemHeight: 22,
            gap: 6,
            padding: 10,
            bgColor: Color.fromHex('#14202b'),
          });
          root.addChild(list);

          const hint = new Label({
            text: 'Tip: hover list and use mouse wheel to scroll.',
            pos: vec(0, 255),
            font: new Font({
              size: 12,
              unit: FontUnit.Px,
              color: Color.fromHex('#c8d6e5'),
              textAlign: TextAlign.Left,
            }),
          });
          root.addChild(hint);
        },
      });

      this.add(this.testPopup);
    });

    // End Turn button in right bottom corner
    const endTurnButton = new ScreenButton({
      x: engine.drawWidth - 170,
      y: engine.drawHeight - 70,
      width: 150,
      height: 40,
      title: 'End Turn',
    });
    this.add(endTurnButton);
    endTurnButton.on('pointerup', () => {
      this.turnManager.endTurn();
    });
  }
}
