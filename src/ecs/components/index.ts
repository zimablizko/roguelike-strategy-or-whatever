/**
 * Base class for all custom ECS components
 * Components are pure data containers that can be attached to entities
 */
export abstract class GameComponent {
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }
}

/**
 * Component for storing position data
 */
export class PositionComponent extends GameComponent {
  constructor(public x: number, public y: number) {
    super('position');
  }
}

/**
 * Component for storing movement speed
 */
export class VelocityComponent extends GameComponent {
  constructor(public speed: number = 100) {
    super('velocity');
  }
}

/**
 * Component for visual rendering properties
 */
export class SpriteComponent extends GameComponent {
  constructor(
    public color: string = '#ffffff',
    public width: number = 32,
    public height: number = 32
  ) {
    super('sprite');
  }
}

/**
 * Component for entities that can be controlled by player
 */
export class PlayerControlledComponent extends GameComponent {
  constructor() {
    super('playerControlled');
  }
}

/**
 * Component for health and damage
 */
export class HealthComponent extends GameComponent {
  constructor(
    public current: number = 100,
    public max: number = 100
  ) {
    super('health');
  }

  damage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
  }

  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }

  isDead(): boolean {
    return this.current <= 0;
  }
}
