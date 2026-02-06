import { Color, Engine, Font, Label, Scene, TextAlign } from 'excalibur';
import { ScreenButton } from '../ui/elements/ScreenButton';

export class InitializationScene extends Scene {
  onInitialize(engine: Engine): void {
    // Set background color
    this.backgroundColor = Color.fromHex('#1abc9c');
    const title = new Label({
      text: 'New Game',
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2 - 100,
      font: new Font({
        size: 32,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(title);

    this.addButtons(engine);
  }

  private addButtons(engine: Engine) {
    // Start Game in right bottom corner
    const startButton = new ScreenButton({
      x: engine.drawWidth - 170,
      y: engine.drawHeight - 70,
      width: 150,
      height: 50,
      title: 'Start Game',
    });
    this.add(startButton);
    startButton.on('pointerup', () => {
      engine.goToScene('gameplay');
    });

    // Back to Main Menu in left bottom corner
    const backButton = new ScreenButton({
      x: 20,
      y: engine.drawHeight - 70,
      width: 150,
      height: 50,
      title: 'Back to Menu',
    });
    this.add(backButton);
    backButton.on('pointerup', () => {
      engine.goToScene('main-menu');
    });
  }
}
