import { Actor, Color, vec } from 'excalibur';
import {
  PositionComponent,
  SpriteComponent,
  VelocityComponent,
  PlayerControlledComponent,
  HealthComponent,
} from '../components';

/**
 * Factory functions for creating pre-configured entities
 */

/**
 * Create a player entity
 */
export function createPlayer(x: number, y: number): Actor {
  const player = new Actor({
    pos: vec(x, y),
    width: 32,
    height: 32,
    color: Color.Blue,
  });

  player.addComponent(new PositionComponent(x, y));
  player.addComponent(new SpriteComponent('#4a90e2', 32, 32));
  player.addComponent(new VelocityComponent(200));
  player.addComponent(new PlayerControlledComponent());
  player.addComponent(new HealthComponent(100, 100));

  return player;
}

/**
 * Create an enemy entity
 */
export function createEnemy(x: number, y: number): Actor {
  const enemy = new Actor({
    pos: vec(x, y),
    width: 32,
    height: 32,
    color: Color.Red,
  });

  enemy.addComponent(new PositionComponent(x, y));
  enemy.addComponent(new SpriteComponent('#e74c3c', 32, 32));
  enemy.addComponent(new VelocityComponent(80));
  enemy.addComponent(new HealthComponent(50, 50));

  return enemy;
}

/**
 * Create a wall/obstacle entity
 */
export function createWall(x: number, y: number): Actor {
  const wall = new Actor({
    pos: vec(x, y),
    width: 32,
    height: 32,
    color: Color.Gray,
  });

  wall.addComponent(new PositionComponent(x, y));
  wall.addComponent(new SpriteComponent('#7f8c8d', 32, 32));

  return wall;
}

/**
 * Create a collectible item entity
 */
export function createItem(x: number, y: number): Actor {
  const item = new Actor({
    pos: vec(x, y),
    width: 24,
    height: 24,
    color: Color.Yellow,
  });

  item.addComponent(new PositionComponent(x, y));
  item.addComponent(new SpriteComponent('#f1c40f', 24, 24));

  return item;
}
