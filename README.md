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
cd roguelike-strategy-or-whatever
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

### Deploying to GitHub Pages

#### Manual Deployment

Deploy the game to GitHub Pages manually:
```bash
npm run deploy
```

This will:
1. Build the project with the correct base path for GitHub Pages
2. Create a `.nojekyll` file to prevent Jekyll processing
3. Initialize a git repository in the dist folder
4. Push the built files to the `gh-pages` branch
5. Make the game available at: https://zimablizko.github.io/roguelike-strategy-or-whatever/

#### Automated Deployment

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys to GitHub Pages:
- **Triggers**: On every push to `main` or `master` branch
- **Manual trigger**: Can be triggered manually from the Actions tab in GitHub
- **What it does**: Installs dependencies, builds the project, and deploys to gh-pages branch

After deployment, your game will be live at: https://zimablizko.github.io/roguelike-strategy-or-whatever/

> **Note**: The first deployment may take a few minutes to become available. Subsequent deployments are usually faster.

## How to Play

- Use **WASD** or **Arrow Keys** to move the blue player
- Avoid red enemies
- Collect yellow items
- Navigate around gray walls

## ECS Architecture

This project uses Excalibur.js's built-in Entity-Component-System (ECS) pattern for clean, modular game architecture.

### Components
Components are data containers that extend Excalibur's `Component` class:
- `PositionComponent` - Entity position tracking
- `VelocityComponent` - Movement speed
- `SpriteComponent` - Visual properties
- `PlayerControlledComponent` - Player control marker
- `HealthComponent` - Health and damage system

### Entities
Entities are Excalibur `Actor` objects with components attached:
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
import { Component } from 'excalibur';

export class MyComponent extends Component {
  constructor(public myData: any) {
    super();
  }
}
```

### Adding a New Entity

Create a factory function in `src/ecs/entities/factories.ts`:
```typescript
import { Actor, vec } from 'excalibur';

export function createMyEntity(x: number, y: number): Actor {
  const entity = new Actor({ pos: vec(x, y) });
  entity.addComponent(new MyComponent(data));
  return entity;
}
```

### Adding a New System

Create a new system in `src/ecs/systems/index.ts`:
```typescript
import { Actor } from 'excalibur';

export class MySystem extends System {
  update(entities: Actor[], delta: number): void {
    // Filter entities that have the components you need
    const relevantEntities = entities.filter(e => e.has(MyComponent));
    
    // Process each entity
    for (const entity of relevantEntities) {
      const component = entity.get(MyComponent);
      // Your game logic here
    }
  }
}
```

## License

ISC