import { Engine, DisplayMode, Color } from 'excalibur';
import { DemoScene } from './scenes';

/**
 * Main game class that initializes and manages the Excalibur engine
 */
export class Game {
  private engine: Engine;

  constructor() {
    this.engine = new Engine({
      width: 800,
      height: 600,
      displayMode: DisplayMode.FitScreen,
      backgroundColor: Color.Black,
    });
  }

  /**
   * Initialize the game and add scenes
   */
  async initialize(): Promise<void> {
    // Add scenes
    this.engine.add('demo', new DemoScene());

    // Start with demo scene
    await this.engine.goToScene('demo');
  }

  /**
   * Start the game
   */
  async start(): Promise<void> {
    await this.initialize();
    await this.engine.start();
  }

  /**
   * Get the engine instance
   */
  getEngine(): Engine {
    return this.engine;
  }
}
