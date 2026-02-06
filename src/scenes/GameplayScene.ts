import {
  Actor,
  Color,
  Engine,
  Font,
  Label,
  Scene,
  TextAlign,
  vec,
} from 'excalibur';
import { ScreenButton } from '../ui/elements/ScreenButton';

/**
 * Demo scene showcasing the ECS pattern
 */
export class GameplayScene extends Scene {
  private gameEntities: Actor[] = [];

  onInitialize(engine: Engine): void {
    // Set background color
    this.backgroundColor = Color.fromHex('#2c3e50');

    // Create title label
    const title = new Label({
      text: 'Roguelike Strategy Demo',
      pos: vec(engine.drawWidth / 2, 30),
      font: new Font({
        size: 24,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(title);

    // Create instructions label
    const instructions = new Label({
      text: 'Use WASD or Arrow Keys to move the blue player',
      pos: vec(engine.drawWidth / 2, 60),
      font: new Font({
        size: 14,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(instructions);

    // Status info
    const status = new Label({
      text: `Entities: ${this.gameEntities.length}`,
      pos: vec(engine.drawWidth / 2, engine.drawHeight - 30),
      font: new Font({
        size: 12,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(status);
    this.addButtons(engine);
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
  }
}
