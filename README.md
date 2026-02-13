# Roguelike Strategy Game

A roguelike strategy game built with [Excalibur.js](https://excaliburjs.com/) and bundled with [Vite](https://vitejs.dev/). This project uses a Manager-based architecture with dedicated UI views.

## Features

- ⚡ **Vite** for fast development and optimized builds
- 🎮 **Excalibur.js** game engine
- 🏗️ **Manager Pattern** for clean, modular game state management
- 📦 **TypeScript** for type safety
- 🗺️ Procedural map generation with Voronoi zones
- 🏰 Building placement and management system
- 👑 Ruler system with stats
- 💰 Resource management (gold, materials, food, population)

## Project Structure

```
src/
├── _common/
│   ├── config.ts          # Game configuration constants
│   ├── math.ts            # Shared math utilities
│   ├── random.ts          # Seedable PRNG
│   ├── resources.ts       # Asset loading
│   └── text.ts            # Shared text utilities
├── data/
│   └── buildings.ts       # Building definitions
├── managers/
│   ├── GameManager.ts     # Top-level manager
│   ├── MapManager.ts      # Procedural map generation
│   ├── ResourceManager.ts # Resource state management
│   ├── RulerManager.ts    # Ruler data
│   ├── StateManager.ts    # State, buildings, technologies
│   └── TurnManager.ts     # Turn lifecycle and income
├── scenes/
│   ├── GameOverScene.ts
│   ├── GameplayScene.ts   # Main gameplay scene
│   ├── InitializationScene.ts
│   └── MainMenu.ts
├── ui/                    # UI views, elements, popups, tooltips
├── game.ts                # Game initialization
└── main.ts                # Entry point
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

- Click tiles on the procedural map to interact
- Build structures using the **Quick Build** panel (press **B**)
- Manage resources (gold, materials, food, population)
- End your turn to collect passive building income
- Expand your state borders from the Castle

## Architecture

### Managers
Dedicated manager classes own game state:
- **GameManager** — Orchestrates sub-managers
- **ResourceManager** — Single source of truth for resources
- **StateManager** — Buildings, state data, technologies
- **MapManager** — Procedural map with Voronoi zones
- **RulerManager** — Ruler identity and stats
- **TurnManager** — Turn lifecycle and passive income

### UI Views
Views poll manager state each frame using version counters to skip unnecessary re-renders.

### Extending the Game

**Adding a new building** — edit `src/data/buildings.ts`. The `StateBuildingId` type is derived automatically.

**Adding shared utilities** — place them in `src/_common/` and import everywhere.

## License

ISC