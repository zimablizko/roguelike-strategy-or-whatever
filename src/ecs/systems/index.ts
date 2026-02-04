import { Actor, Engine, Keys, Vector } from 'excalibur';
import { VelocityComponent, PositionComponent, PlayerControlledComponent } from '../components';

/**
 * System for handling player input and movement
 */
export class PlayerMovementSystem {
  private engine: Engine;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  update(entities: Actor[], _delta: number): void {
    const players = entities.filter(e => 
      e.has(PlayerControlledComponent) && e.has(VelocityComponent)
    );

    for (const player of players) {
      const velocity = player.get(VelocityComponent)!; // Non-null assertion safe due to filter above
      const movement = new Vector(0, 0);
      const speed = velocity.speed;

      // WASD or Arrow key movement
      if (this.engine.input.keyboard.isHeld(Keys.W) || 
          this.engine.input.keyboard.isHeld(Keys.Up)) {
        movement.y -= 1;
      }
      if (this.engine.input.keyboard.isHeld(Keys.S) || 
          this.engine.input.keyboard.isHeld(Keys.Down)) {
        movement.y += 1;
      }
      if (this.engine.input.keyboard.isHeld(Keys.A) || 
          this.engine.input.keyboard.isHeld(Keys.Left)) {
        movement.x -= 1;
      }
      if (this.engine.input.keyboard.isHeld(Keys.D) || 
          this.engine.input.keyboard.isHeld(Keys.Right)) {
        movement.x += 1;
      }

      // Normalize diagonal movement
      if (movement.size > 0) {
        movement.normalize();
        player.vel = movement.scale(speed);
      } else {
        player.vel = Vector.Zero;
      }
    }
  }
}

/**
 * System for updating entity positions based on velocity
 */
export class MovementSystem {
  update(entities: Actor[], _delta: number): void {
    for (const entity of entities) {
      if (entity.has(PositionComponent) && entity.has(VelocityComponent)) {
        const position = entity.get(PositionComponent)!; // Non-null assertion safe due to has() check
        position.x = entity.pos.x;
        position.y = entity.pos.y;
      }
    }
  }
}
