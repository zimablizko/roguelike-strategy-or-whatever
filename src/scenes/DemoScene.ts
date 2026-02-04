import { Scene, Color, Label, vec, Font, TextAlign, Engine, Actor } from 'excalibur';
import { createPlayer, createEnemy, createWall, createItem } from '../ecs/entities';
import { updatePlayerMovement, updateMovement } from '../ecs/systems';

/**
 * Demo scene showcasing the ECS pattern
 */
export class DemoScene extends Scene {
  private gameEntities: Actor[] = [];

  onInitialize(engine: Engine): void {
    // Set background color
    this.backgroundColor = Color.fromHex('#2c3e50');

    // Create title label
    const title = new Label({
      text: 'Roguelike Strategy Demo',
      pos: vec(engine.drawWidth / 2, 30),
      font: new Font({
        size: 24,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(title);

    // Create instructions label
    const instructions = new Label({
      text: 'Use WASD or Arrow Keys to move the blue player',
      pos: vec(engine.drawWidth / 2, 60),
      font: new Font({
        size: 14,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(instructions);

    // Create player in the center
    const player = createPlayer(400, 300);
    this.gameEntities.push(player);
    this.add(player);

    // Create some enemies
    this.createEnemy(200, 200);
    this.createEnemy(600, 200);
    this.createEnemy(200, 400);
    this.createEnemy(600, 400);

    // Create walls/obstacles
    this.createWallLine(150, 250, 5, true);
    this.createWallLine(650, 250, 5, true);
    this.createWallLine(350, 150, 3, false);
    this.createWallLine(350, 450, 3, false);

    // Create some collectible items
    this.createItem(300, 300);
    this.createItem(500, 300);
    this.createItem(400, 200);
    this.createItem(400, 400);

    // Status info
    const status = new Label({
      text: `Entities: ${this.gameEntities.length}`,
      pos: vec(engine.drawWidth / 2, engine.drawHeight - 30),
      font: new Font({
        size: 12,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(status);
  }

  onPreUpdate(engine: Engine, _delta: number): void {
    // Update game systems
    updatePlayerMovement(this.gameEntities, engine);
    updateMovement(this.gameEntities);
  }

  private createEnemy(x: number, y: number): void {
    const enemy = createEnemy(x, y);
    this.gameEntities.push(enemy);
    this.add(enemy);
  }

  private createWall(x: number, y: number): void {
    const wall = createWall(x, y);
    this.gameEntities.push(wall);
    this.add(wall);
  }

  private createWallLine(startX: number, startY: number, count: number, vertical: boolean): void {
    for (let i = 0; i < count; i++) {
      const x = vertical ? startX : startX + (i * 40);
      const y = vertical ? startY + (i * 40) : startY;
      this.createWall(x, y);
    }
  }

  private createItem(x: number, y: number): void {
    const item = createItem(x, y);
    this.gameEntities.push(item);
    this.add(item);
  }
}
