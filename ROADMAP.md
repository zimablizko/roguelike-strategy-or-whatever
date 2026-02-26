# Roadmap

This document outlines the planned features and milestones for the Roguelike Strategy Game. It is organized into phases, progressing from core gameplay mechanics to polish and content expansion.

> **Current State:** The project has a working ECS foundation with player movement (WASD/arrows), four entity types (Player, Enemy, Wall, Item), basic components (Position, Velocity, Sprite, PlayerControlled, Health), and two systems (PlayerMovement, Movement). A demo scene showcases these features.

---

## Phase 1: Core Gameplay Mechanics

Establish the fundamental systems that make the game playable.

### Collision Detection & Response
- [ ] Add collision detection between Player and Wall entities (block movement)
- [ ] Add collision detection between Player and Enemy entities (trigger combat)
- [ ] Add collision detection between Player and Item entities (trigger pickup)
- [ ] Add collision detection between Enemy and Wall entities (pathfinding obstacle)

### Turn-Based System
- [ ] Design and implement a `TurnManager` to coordinate entity actions
- [ ] Convert real-time movement to turn-based tile movement
- [ ] Implement action point / move budget per turn
- [ ] Add end-turn input (e.g., Space or Enter key)
- [ ] Add visual indicator for whose turn it is

### Tile / Grid System
- [ ] Define a grid-based map structure (tile size, map dimensions)
- [ ] Snap entity positions to grid cells
- [ ] Implement grid-based movement (one tile per move action)
- [ ] Add a `TileMapComponent` or integrate with Excalibur's `TileMap`

### Combat System
- [ ] Implement melee attack action (adjacent tile targeting)
- [ ] Connect `HealthComponent` to damage calculations
- [ ] Add attack and defense stats via new `StatsComponent`
- [ ] Implement entity death and removal on zero health
- [ ] Add damage numbers or hit feedback visuals

---

## Phase 2: Enemy AI & Interaction

Make enemies and items meaningful gameplay elements.

### Enemy AI
- [ ] Implement basic chase behavior (move toward player each turn)
- [ ] Add line-of-sight detection (`FOVComponent`)
- [ ] Implement patrol behavior (move along a predefined path when player is not visible)
- [ ] Add different AI profiles per enemy type (aggressive, defensive, ranged)
- [ ] Implement A* or Dijkstra pathfinding around walls

### Item & Inventory System
- [ ] Create `InventoryComponent` with capacity limits
- [ ] Implement item pickup on collision
- [ ] Add item types: health potion, weapon, armor, key
- [ ] Create `ItemEffectComponent` to define what items do when used
- [ ] Add inventory UI panel (list items, use/drop actions)
- [ ] Implement equipment slots (weapon, armor, accessory)

### Entity Variety
- [ ] Add new enemy types with distinct stats and behaviors (e.g., Goblin, Skeleton, Slime)
- [ ] Add ranged enemy type with projectile attacks
- [ ] Add boss enemy type with special abilities
- [ ] Add environmental hazards (traps, spikes, lava tiles)
- [ ] Add friendly NPC entities with dialogue

---

## Phase 3: Procedural Generation

Introduce the roguelike element with randomized content.

### Dungeon Generation
- [ ] Implement a room-and-corridor dungeon generator (e.g., BSP or random room placement)
- [ ] Define room templates (size ranges, shapes)
- [ ] Place walls, floors, and doors procedurally
- [ ] Ensure connectivity (all rooms reachable)
- [ ] Add entrance (stairs up) and exit (stairs down) placement

### Entity Placement
- [ ] Randomly place enemies based on dungeon depth / difficulty curve
- [ ] Randomly place items and treasure with loot tables
- [ ] Place the player at the dungeon entrance
- [ ] Add spawn rules (enemies not too close to player start, items in dead ends)

### Level Progression
- [ ] Implement multi-floor dungeons (descending deeper)
- [ ] Scale difficulty per floor (more enemies, stronger stats)
- [ ] Add persistent progression between floors (keep inventory and health)
- [ ] Implement permadeath (game over on player death, restart from floor 1)

---

## Phase 4: User Interface & HUD

Provide players with clear information and menus.

### In-Game HUD
- [ ] Display player health bar
- [ ] Display current dungeon floor number
- [ ] Display turn counter
- [ ] Add minimap showing explored areas
- [ ] Show status effects and buffs/debuffs

### Menus & Screens
- [ ] Create a title screen / main menu (New Game, Continue, Settings)
- [ ] Create a game over screen with run summary (floors cleared, enemies defeated)
- [ ] Create a pause menu (Resume, Settings, Quit)
- [ ] Create a settings screen (controls, volume, display)

### Feedback & Messaging
- [ ] Add a message log panel (combat results, item pickups, events)
- [ ] Implement floating damage/heal numbers
- [ ] Add screen shake or flash on hit
- [ ] Add turn transition animation

---

## Phase 5: Audio & Visuals

Replace placeholder graphics and add sound.

### Sprite Art
- [ ] Replace colored rectangles with pixel art sprites for all entities
- [ ] Add idle and movement animations for Player and Enemies
- [ ] Add attack animations
- [ ] Add death/despawn animations
- [ ] Create tileset for dungeon floors, walls, and doors

### Visual Effects
- [ ] Add fog of war (hide unexplored tiles, dim previously explored tiles)
- [ ] Add lighting effects (torches, glowing items)
- [ ] Add particle effects (damage sparks, heal glow, item shimmer)
- [ ] Implement smooth camera follow on player movement

### Audio
- [ ] Add background music tracks (menu theme, dungeon ambience)
- [ ] Add sound effects for movement, attacks, item pickup, and UI interactions
- [ ] Add audio settings (master volume, music volume, SFX volume)
- [ ] Implement contextual music changes (combat music on enemy encounter)

---

## Phase 6: Advanced Systems

Deepen the strategic gameplay.

### Character Progression
- [ ] Implement experience points and leveling system
- [ ] Add stat increases on level up (health, attack, defense, speed)
- [ ] Add skill or ability tree with unlockable active/passive skills
- [ ] Implement class or archetype selection at game start (Warrior, Rogue, Mage)

### Status Effects
- [ ] Implement poison (damage over time)
- [ ] Implement stun (skip turn)
- [ ] Implement buff/debuff system (temporary stat modifiers)
- [ ] Add status effect icons and duration tracking in HUD

### Save & Load
- [ ] Implement game state serialization (localStorage or IndexedDB)
- [ ] Add save-on-exit and load-on-start for mid-run persistence
- [ ] Implement run history / high score tracking
- [ ] Respect permadeath rules (delete save on death)

---

## Phase 7: Content & Polish

Expand the game with more content and quality-of-life features.

### Content Expansion
- [ ] Add multiple dungeon themes (cave, castle, crypt) with unique tilesets
- [ ] Add 10+ enemy types across different themes
- [ ] Add 20+ item types (consumables, equipment, special items)
- [ ] Add random events and encounters (shrines, merchants, treasure rooms)
- [ ] Add unlockable content based on achievements

### Quality of Life
- [ ] Add keyboard shortcut reference overlay (press `?` to view)
- [ ] Add tooltips on hover for items and enemies
- [ ] Add undo-last-move option (limited uses per floor)
- [ ] Improve accessibility (colorblind modes, screen reader hints)
- [ ] Add mouse/touch input support

### Testing & Stability
- [ ] Set up a test framework (Vitest or similar)
- [ ] Add unit tests for all components and systems
- [ ] Add integration tests for scene initialization and entity interactions
- [ ] Add performance benchmarks for procedural generation and pathfinding

### Developer Experience
- [ ] Add a debug overlay (toggle with `F12` or backtick key) showing entity data and grid
- [ ] Add level editor or seed-based generation for reproducible dungeons
- [ ] Document all systems and components with JSDoc
- [ ] Add contributing guidelines (`CONTRIBUTING.md`)

---

## Future Ideas (Unscheduled)

These are ideas that may be explored after the core phases are complete:

- **Multiplayer:** Co-op or competitive turn-based multiplayer via WebSockets
- **Modding support:** Expose configuration files for custom enemies, items, and dungeons
- **Mobile support:** Responsive layout and touch controls for mobile browsers
- **Leaderboard:** Online leaderboard for high scores and speedruns
- **Daily challenge:** Seeded daily dungeon with shared leaderboard
- **Story mode:** Scripted narrative campaign with hand-crafted levels and dialogue
