import { Color, DisplayMode, Engine } from 'excalibur';
import { CONFIG } from './_common/config';
import { loader } from './_common/resources';
import { FONT_FAMILY } from './_common/text';
import {
  GameOverScene,
  GameplayScene,
  InitializationScene,
  MainMenu,
} from './scenes';

/**
 * Main game class that initializes and manages the Excalibur engine
 */
export class Game {
  private engine: Engine;

  constructor() {
    this.engine = new Engine({
      width: CONFIG.GAME_WIDTH,
      height: CONFIG.GAME_HEIGHT,
      displayMode: DisplayMode.FitScreen,
      backgroundColor: Color.Black,
      canvasElementId: 'game',
      pixelRatio: window.devicePixelRatio,
      antialiasing: true,
      handleContextLost: (e) => {
        e.preventDefault();
        this.engine.clock.stop();
        console.warn('WebGL context lost — stopped clock, awaiting restore');
      },
      handleContextRestored: () => {
        console.log('WebGL context restored — reloading page');
        location.reload();
      },
    });
  }

  /**
   * Initialize the game and add scenes
   */
  async initialize(): Promise<void> {
    // Add scenes
    this.engine.add('gameplay', new GameplayScene());
    this.engine.add('preparation', new InitializationScene());
    this.engine.add('main-menu', new MainMenu());
    this.engine.add('game-over', new GameOverScene());

    if (CONFIG.DEBUG) {
      console.log(
        'Debug mode enabled, starting with scene:',
        CONFIG.DEBUG_OPTIONS.START_SCENE
      );
      await this.engine.goToScene(CONFIG.DEBUG_OPTIONS.START_SCENE);
      return;
    }

    await this.engine.goToScene('main-menu');
  }

  /**
   * Start the game
   */
  async start(): Promise<void> {
    // Force the browser to download the custom font NOW, not lazily on first use.
    // Without this, Excalibur Text objects rasterize with a fallback font on the
    // first frame and cache that stale texture until a full re-render.
    await document.fonts.load(`16px "${FONT_FAMILY}"`);
    await this.initialize();
    await this.engine.start(loader);
  }

  /**
   * Get the engine instance
   */
  getEngine(): Engine {
    return this.engine;
  }
}
