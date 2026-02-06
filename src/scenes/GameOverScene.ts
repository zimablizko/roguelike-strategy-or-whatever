import { Color, Font, Label, Scene, TextAlign } from 'excalibur';
import { ScreenButton } from '../ui/elements/ScreenButton';

export class GameOverScene extends Scene {
  onInitialize() {
    // Set background color
    this.backgroundColor = Color.fromHex('#e74c3c');
    // Create Game Over label
    const gameOverLabel = new Label({
      text: 'Game Over',
      x: this.engine.drawWidth / 2,
      y: this.engine.drawHeight / 2 - 50,
      font: new Font({
        size: 48,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(gameOverLabel);

    // Create Restart button
    const restartButton = new ScreenButton({
      x: this.engine.drawWidth / 2 - 75,
      y: this.engine.drawHeight / 2 + 20,
      width: 150,
      height: 50,
      title: 'Restart',
    });
    this.add(restartButton);
    restartButton.on('pointerup', () => {
      this.engine.goToScene('main-menu');
    });
  }
}
