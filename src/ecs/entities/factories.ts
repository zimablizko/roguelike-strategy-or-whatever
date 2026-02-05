import { Actor, Color, vec } from 'excalibur';
import { PositionComponent } from '../components';

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

  return item;
}
