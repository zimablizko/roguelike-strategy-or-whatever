import { Color, Engine, Scene, ScreenElement, vec } from 'excalibur';
import { Resources } from '../_common/resources';
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

    const logo = new ScreenElement({
      x: engine.drawWidth / 2 - 2,
      y: engine.drawHeight / 2 - 120,
    });
    logo.anchor = vec(0.5, 0.5);
    logo.graphics.use(Resources.MainMenuLogo.toSprite());
    this.add(logo);

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
