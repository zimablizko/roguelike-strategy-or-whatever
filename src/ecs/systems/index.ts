import { Actor, Engine, Keys, Vector } from 'excalibur';
import { VelocityComponent, PositionComponent, PlayerControlledComponent } from '../components';

/**
 * Handle player input and movement
 * @param entities - All entities in the scene
 * @param engine - The game engine instance
 */
export function updatePlayerMovement(entities: Actor[], engine: Engine): void {
  const players = entities.filter(e => 
    e.has(PlayerControlledComponent) && e.has(VelocityComponent)
  );

  for (const player of players) {
    const velocity = player.get(VelocityComponent)!;
    const movement = new Vector(0, 0);
    const speed = velocity.speed;

    // WASD or Arrow key movement
    if (engine.input.keyboard.isHeld(Keys.W) || 
        engine.input.keyboard.isHeld(Keys.Up)) {
      movement.y -= 1;
    }
    if (engine.input.keyboard.isHeld(Keys.S) || 
        engine.input.keyboard.isHeld(Keys.Down)) {
      movement.y += 1;
    }
    if (engine.input.keyboard.isHeld(Keys.A) || 
        engine.input.keyboard.isHeld(Keys.Left)) {
      movement.x -= 1;
    }
    if (engine.input.keyboard.isHeld(Keys.D) || 
        engine.input.keyboard.isHeld(Keys.Right)) {
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

/**
 * Update entity positions based on velocity
 * @param entities - All entities in the scene
 */
export function updateMovement(entities: Actor[]): void {
  for (const entity of entities) {
    if (entity.has(PositionComponent) && entity.has(VelocityComponent)) {
      const position = entity.get(PositionComponent)!;
      position.x = entity.pos.x;
      position.y = entity.pos.y;
    }
  }
}
