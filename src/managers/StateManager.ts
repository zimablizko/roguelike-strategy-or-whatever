export type StateTiles = {
  forest: number;
  stone: number;
  plains: number;
  water: number;
};

export type StateData = {
  name: string;
  size: number;
  tiles: StateTiles;
};

export interface StateManagerOptions {
  initial?: Partial<Omit<StateData, 'size' | 'tiles'>> & {
    tiles?: Partial<StateTiles>;
  };
}

/**
 * Manages state data (name/tile counters/size).
 * State is generated when this manager is created.
 */
export class StateManager {
  private state: StateData;

  constructor(options: StateManagerOptions = {}) {
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
    this.state.tiles[type] = this.clamp(Math.floor(value), 0);
    this.recomputeSize();
  }

  addTileCount(type: keyof StateTiles, delta: number): void {
    this.setTileCount(type, this.state.tiles[type] + delta);
  }

  private generateState(initial?: StateManagerOptions['initial']): StateData {
    const names = ['Northmarch', 'Valeborn', 'Ironreach', 'Sunfield', 'Duskford'];
    const name =
      initial?.name ??
      names[Math.floor(Math.random() * names.length)] ??
      'Unnamed State';

    const tiles = this.generateTiles(initial?.tiles);
    const size = this.sumTiles(tiles);
    return { name, size, tiles };
  }

  private generateTiles(initial?: Partial<StateTiles>): StateTiles {
    return {
      forest: this.clamp(initial?.forest ?? this.randomInt(8, 40), 0),
      stone: this.clamp(initial?.stone ?? this.randomInt(4, 28), 0),
      plains: this.clamp(initial?.plains ?? this.randomInt(10, 48), 0),
      water: this.clamp(initial?.water ?? this.randomInt(2, 24), 0),
    };
  }

  private sumTiles(tiles: StateTiles): number {
    return tiles.forest + tiles.stone + tiles.plains + tiles.water;
  }

  private recomputeSize(): void {
    this.state.size = this.sumTiles(this.state.tiles);
  }

  private randomInt(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

  private clamp(value: number, min: number): number {
    return Math.max(min, value);
  }
}
