# GitHub Copilot Instructions for Roguelike Strategy Game

## Project Overview

This is a roguelike strategy game built with **Excalibur.js** game engine and bundled with **Vite**. The project uses TypeScript and follows the **Entity-Component-System (ECS)** architectural pattern.

## Tech Stack

- **Game Engine**: Excalibur.js v0.32.0
- **Build Tool**: Vite v7.3.1
- **Language**: TypeScript v5.9.3
- **Module System**: ES Modules
- **Target**: ES2020

## Project Structure

```
src/
├── ecs/
│   ├── components/     # Data containers extending Excalibur's Component class
│   ├── entities/       # Factory functions that create Actors with components
│   └── systems/        # Functions containing game logic that process entities
├── scenes/             # Excalibur Scene implementations
├── game.ts             # Game initialization and configuration
└── main.ts             # Application entry point
```

## Development Commands

- **Development server**: `npm run dev` (runs on port 3000)
- **Build**: `npm run build` (runs TypeScript compiler then Vite build)
- **Preview**: `npm run preview` (preview production build)
- **Deploy**: `npm run deploy` (build and deploy to GitHub Pages)

## Architecture Guidelines

### Entity-Component-System (ECS) Pattern

The project follows strict ECS separation of concerns:

1. **Components** (Data only)
   - Extend `Component` from Excalibur
   - Contain only data properties and simple getters/setters
   - Located in `src/ecs/components/index.ts`
   - Example: `PositionComponent`, `VelocityComponent`, `HealthComponent`

2. **Entities** (Actors with Components)
   - Created using factory functions in `src/ecs/entities/factories.ts`
   - Factory functions return Excalibur `Actor` instances with components attached
   - Use `Actor.addComponent()` to attach components
   - Example: `createPlayer()`, `createEnemy()`, `createWall()`

3. **Systems** (Game Logic)
   - Pure functions in `src/ecs/systems/index.ts`
   - Process entities by filtering for required components
   - Called from scene's `onPreUpdate()` or `onPostUpdate()` methods
   - Example: `updatePlayerMovement()`, `updateMovement()`

### Coding Conventions

- **TypeScript**: Use strict type checking (enabled in tsconfig.json)
- **Imports**: Use named imports from Excalibur (e.g., `import { Actor, Color, vec } from 'excalibur'`)
- **Comments**: Use JSDoc comments for classes, functions, and complex logic
- **Component Access**: Use `entity.has(Component)` to check existence, `entity.get(Component)!` to access
- **Vector Creation**: Use `vec(x, y)` helper from Excalibur
- **Color Creation**: Use `Color.Blue`, `Color.Red` constants or hex strings

### Component Guidelines

When creating new components:
```typescript
import { Component } from 'excalibur';

/**
 * Component description
 */
export class MyComponent extends Component {
  constructor(public myData: any) {
    super();
  }
}
```

### Entity Factory Guidelines

When creating new entity factories:
```typescript
import { Actor, Color, vec } from 'excalibur';

/**
 * Create a my-entity entity
 */
export function createMyEntity(x: number, y: number): Actor {
  const entity = new Actor({
    pos: vec(x, y),
    width: 32,
    height: 32,
    color: Color.Blue,
  });

  entity.addComponent(new MyComponent(data));
  return entity;
}
```

### System Function Guidelines

When creating new system functions:
```typescript
import { Actor } from 'excalibur';

/**
 * System description
 * @param entities - All entities in the scene
 */
export function updateMySystem(entities: Actor[]): void {
  // Filter entities with required components
  const relevantEntities = entities.filter(e => e.has(MyComponent));
  
  // Process each entity
  for (const entity of relevantEntities) {
    const component = entity.get(MyComponent)!;
    // Game logic here
  }
}
```

## Player Controls

- **Movement**: WASD or Arrow Keys
- Movement is normalized for diagonal input
- Velocity-based movement system

## Game Entities

- **Player**: Blue square (32x32), controlled by player, has health
- **Enemy**: Red square (32x32), has health and velocity
- **Wall**: Gray square (32x32), static obstacle
- **Item**: Yellow square (24x24), collectible

## Build Configuration

- **TypeScript**: Strict mode enabled, no unused locals/parameters allowed
- **Vite**: ES modules, bundler mode, development port 3000
- **Base Path**: Configured for GitHub Pages deployment (`/<repo-name>/`)

## Deployment

The project auto-deploys to GitHub Pages via GitHub Actions on pushes to main/master branch.

## Important Notes for Copilot

1. **Always follow ECS pattern**: Keep data in components, logic in systems
2. **Use Excalibur APIs**: Don't reinvent what Excalibur provides (Actor, Component, Scene, etc.)
3. **Type safety**: Use TypeScript types, avoid `any` when possible
4. **Factory pattern**: Create entities through factory functions, not directly in scenes
5. **Component filtering**: Use `entity.has()` before `entity.get()` to avoid errors
6. **No tests**: This project does not have a test suite configured yet
7. **Build before deploy**: Always run `npm run build` to ensure TypeScript compiles successfully
