import { Actor } from 'excalibur';
import { GameComponent } from '../components';

/**
 * Base Entity class that wraps Excalibur's Actor
 * Entities are game objects that can have components attached
 */
export class GameEntity extends Actor {
  private gameComponents: Map<string, GameComponent> = new Map();

  /**
   * Add a component to this entity
   */
  addGameComponent(component: GameComponent): this {
    this.gameComponents.set(component.name, component);
    return this;
  }

  /**
   * Get a component by name
   */
  getGameComponent<T extends GameComponent>(name: string): T | undefined {
    return this.gameComponents.get(name) as T | undefined;
  }

  /**
   * Check if entity has a component
   */
  hasGameComponent(name: string): boolean {
    return this.gameComponents.has(name);
  }

  /**
   * Remove a component from this entity
   */
  removeGameComponent(name: string): boolean {
    return this.gameComponents.delete(name);
  }

  /**
   * Get all components
   */
  getAllGameComponents(): GameComponent[] {
    return Array.from(this.gameComponents.values());
  }
}
