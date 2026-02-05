import { Color, Engine, Font, Label, Scene, TextAlign } from 'excalibur';

export class InitializationScene extends Scene {
  onInitialize(engine: Engine): void {
    // Set background color
    this.backgroundColor = Color.fromHex('#1abc9c');
    const title = new Label({
      text: 'New Game',
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2 - 20,
      font: new Font({
        size: 32,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(title);

    // Create Start button
    const startButton = new Label({
      text: 'Start Game',
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2 + 20,
      font: new Font({
        size: 24,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });

    startButton.on('pointerup', () => {
      engine.goToScene('gameplay');
    });

    this.add(startButton);
  }
}
