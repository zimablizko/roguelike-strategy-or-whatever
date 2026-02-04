import { Color, vec } from 'excalibur';
import { GameEntity } from './Entity';
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
export function createPlayer(x: number, y: number): GameEntity {
  const player = new GameEntity({
    pos: vec(x, y),
    width: 32,
    height: 32,
    color: Color.Blue,
  });

  player.addGameComponent(new PositionComponent(x, y));
  player.addGameComponent(new SpriteComponent('#4a90e2', 32, 32));
  player.addGameComponent(new VelocityComponent(200));
  player.addGameComponent(new PlayerControlledComponent());
  player.addGameComponent(new HealthComponent(100, 100));

  return player;
}

/**
 * Create an enemy entity
 */
export function createEnemy(x: number, y: number): GameEntity {
  const enemy = new GameEntity({
    pos: vec(x, y),
    width: 32,
    height: 32,
    color: Color.Red,
  });

  enemy.addGameComponent(new PositionComponent(x, y));
  enemy.addGameComponent(new SpriteComponent('#e74c3c', 32, 32));
  enemy.addGameComponent(new VelocityComponent(80));
  enemy.addGameComponent(new HealthComponent(50, 50));

  return enemy;
}

/**
 * Create a wall/obstacle entity
 */
export function createWall(x: number, y: number): GameEntity {
  const wall = new GameEntity({
    pos: vec(x, y),
    width: 32,
    height: 32,
    color: Color.Gray,
  });

  wall.addGameComponent(new PositionComponent(x, y));
  wall.addGameComponent(new SpriteComponent('#7f8c8d', 32, 32));

  return wall;
}

/**
 * Create a collectible item entity
 */
export function createItem(x: number, y: number): GameEntity {
  const item = new GameEntity({
    pos: vec(x, y),
    width: 24,
    height: 24,
    color: Color.Yellow,
  });

  item.addGameComponent(new PositionComponent(x, y));
  item.addGameComponent(new SpriteComponent('#f1c40f', 24, 24));

  return item;
}
