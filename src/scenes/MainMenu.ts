import { Color, Engine, Font, Label, Scene, TextAlign } from 'excalibur';

export class MainMenu extends Scene {
  onInitialize(engine: Engine): void {
    // Set background color
    this.backgroundColor = Color.fromHex('#34495e');
    // Create title label
    const title = new Label({
      text: 'Roguelike Strategy Game',
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
      text: 'New Game',
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2 + 20,
      font: new Font({
        size: 24,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });

    startButton.on('pointerup', () => {
      engine.goToScene('preparation');
    });

    this.add(startButton);
  }
}
