import { Color, Engine, Font, Label, Scene, TextAlign } from 'excalibur';
import { ScreenButton } from '../ui/elements/ScreenButton';

export class MainMenu extends Scene {
  onInitialize(engine: Engine): void {
    this.backgroundColor = Color.fromHex('#34495e');
    this.render(engine);
  }

  onActivate(): void {
    this.render(this.engine);
  }

  private render(engine: Engine): void {
    this.clear();

    const title = new Label({
      text: 'Roguelike Strategy Game',
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
    const playButton = new ScreenButton({
      x: engine.drawWidth / 2 - 75,
      y: engine.drawHeight / 2 + 20,
      width: 150,
      height: 50,
      title: 'Play',
      onClick: () => {
        engine.goToScene('preparation');
      },
    });
    this.add(playButton);

    const optionsButton = new ScreenButton({
      x: engine.drawWidth / 2 - 75,
      y: engine.drawHeight / 2 + 80,
      width: 150,
      height: 50,
      title: 'Options',
    });
    optionsButton.toggle(false);
    this.add(optionsButton);
    optionsButton.on('pointerup', () => {
      console.log('Options button clicked!');
    });

    const creditsButton = new ScreenButton({
      x: engine.drawWidth / 2 - 75,
      y: engine.drawHeight / 2 + 140,
      width: 150,
      height: 50,
      title: 'Credits',
    });
    creditsButton.toggle(false);
    this.add(creditsButton);
    creditsButton.on('pointerup', () => {
      console.log('Credits button clicked!');
    });
  }
}
