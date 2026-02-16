import { clamp } from '../_common/math';
import { SeededRandom } from '../_common/random';
import type { MapPlayerStateSummary } from '../_common/models/map.models';
import type {
  StateData,
  StateManagerOptions,
  StateTiles,
} from '../_common/models/state.models';

/**
 * Manages player state summary (name, tile composition, and size).
 */
export class StateManager {
  private state: StateData;
  private readonly rng: SeededRandom;

  constructor(options: StateManagerOptions = {}) {
    this.rng = options.rng ?? new SeededRandom();
    this.state = this.generateState(options.initial);
  }

  getState(): StateData {
    return {
      ...this.state,
      tiles: { ...this.state.tiles },
    };
  }

  /**
   * Get state data by reference (read-only view).
   * Use for hot UI polling paths to avoid per-frame allocations.
   */
  getStateRef(): Readonly<StateData> {
    return this.state;
  }

  regenerate(initial?: StateManagerOptions['initial']): void {
    this.state = this.generateState(initial);
  }

  setName(name: string): void {
    this.state.name = name.trim() || this.state.name;
  }

  setTileCount(type: keyof StateTiles, value: number): void {
    this.state.tiles[type] = clamp(Math.floor(value), 0);
    this.recomputeSize();
  }

  addTileCount(type: keyof StateTiles, delta: number): void {
    this.setTileCount(type, this.state.tiles[type] + delta);
  }

  applyMapSummary(summary: MapPlayerStateSummary): void {
    this.state.tiles.forest = clamp(Math.floor(summary.tiles.forest), 0);
    this.state.tiles.stone = clamp(Math.floor(summary.tiles.stone), 0);
    this.state.tiles.plains = clamp(Math.floor(summary.tiles.plains), 0);
    this.state.tiles.river = clamp(Math.floor(summary.tiles.river), 0);
    this.state.ocean = clamp(Math.floor(summary.ocean), 0);
    this.state.size = clamp(Math.floor(summary.size), 0);
  }

  private generateState(initial?: StateManagerOptions['initial']): StateData {
    const names = [
      'Northmarch',
      'Valeborn',
      'Ironreach',
      'Sunfield',
      'Duskford',
    ];
    const name =
      initial?.name ??
      names[this.rng.randomInt(0, names.length - 1)] ??
      'Unnamed State';

    const tiles = this.generateTiles(initial?.tiles);
    const ocean = clamp(initial?.ocean ?? this.rng.randomInt(0, 18), 0);
    const size = this.sumTiles(tiles);
    return { name, size, tiles, ocean };
  }

  private generateTiles(initial?: Partial<StateTiles>): StateTiles {
    return {
      forest: clamp(initial?.forest ?? this.rng.randomInt(8, 40), 0),
      stone: clamp(initial?.stone ?? this.rng.randomInt(4, 28), 0),
      plains: clamp(initial?.plains ?? this.rng.randomInt(10, 48), 0),
      river: clamp(initial?.river ?? this.rng.randomInt(2, 24), 0),
    };
  }

  private sumTiles(tiles: StateTiles): number {
    return tiles.forest + tiles.stone + tiles.plains + tiles.river;
  }

  private recomputeSize(): void {
    this.state.size = this.sumTiles(this.state.tiles);
  }
}
