# Roguelike Strategy Game

A roguelike strategy game template built with [Excalibur.js](https://excaliburjs.com/) and bundled with [Vite](https://vitejs.dev/). This project uses the Entity-Component-System (ECS) pattern for game architecture.

## Features

- ⚡ **Vite** for fast development and optimized builds
- 🎮 **Excalibur.js** game engine
- 🏗️ **ECS Pattern** for clean, modular game architecture
- 📦 **TypeScript** for type safety
- 🎨 Demo scene with player movement, enemies, obstacles, and items

## Project Structure

```
src/
├── ecs/
│   ├── components/     # Data containers (Position, Velocity, Health, etc.)
│   ├── entities/       # Game objects (Player, Enemy, Wall, Item)
│   └── systems/        # Game logic (PlayerMovement, Movement)
├── scenes/
│   └── DemoScene.ts    # Demo scene showcasing ECS pattern
├── game.ts             # Game initialization and configuration
└── main.ts             # Application entry point
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rougelike-strategy-or-whatever
```

2. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

The game will be available at `http://localhost:3000`

### Building for Production

Build the project:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## How to Play

- Use **WASD** or **Arrow Keys** to move the blue player
- Avoid red enemies
- Collect yellow items
- Navigate around gray walls

## ECS Architecture

### Components
Components are pure data containers that define properties:
- `PositionComponent` - Entity position
- `VelocityComponent` - Movement speed
- `SpriteComponent` - Visual properties
- `PlayerControlledComponent` - Player control marker
- `HealthComponent` - Health and damage system

### Entities
Entities are game objects composed of components:
- `Player` - Blue controllable character
- `Enemy` - Red obstacles
- `Wall` - Gray barriers
- `Item` - Yellow collectibles

### Systems
Systems contain game logic and operate on entities:
- `PlayerMovementSystem` - Handles player input and movement
- `MovementSystem` - Updates entity positions

## Extending the Game

### Adding a New Component

Create a new component in `src/ecs/components/index.ts`:
```typescript
export class MyComponent extends Component {
  constructor(public myData: any) {
    super('myComponent');
  }
}
```

### Adding a New Entity

Create a factory function in `src/ecs/entities/factories.ts`:
```typescript
export function createMyEntity(x: number, y: number): Entity {
  const entity = new Entity({ pos: vec(x, y) });
  entity.addComponent(new MyComponent(data));
  return entity;
}
```

### Adding a New System

Create a new system in `src/ecs/systems/index.ts`:
```typescript
export class MySystem extends System {
  update(entities: Entity[], delta: number): void {
    // Your game logic here
  }
}
```

## License

ISC