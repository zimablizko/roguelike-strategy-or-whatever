import { Component } from 'excalibur';

/**
 * Component for storing position data
 */
export class PositionComponent extends Component {
  constructor(public x: number, public y: number) {
    super();
  }
}

/**
 * Component for storing movement speed
 */
export class VelocityComponent extends Component {
  constructor(public speed: number = 100) {
    super();
  }
}

/**
 * Component for visual rendering properties
 */
export class SpriteComponent extends Component {
  constructor(
    public color: string = '#ffffff',
    public width: number = 32,
    public height: number = 32
  ) {
    super();
  }
}

/**
 * Component for entities that can be controlled by player
 */
export class PlayerControlledComponent extends Component {
  constructor() {
    super();
  }
}

/**
 * Component for health and damage
 */
export class HealthComponent extends Component {
  constructor(
    public current: number = 100,
    public max: number = 100
  ) {
    super();
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
