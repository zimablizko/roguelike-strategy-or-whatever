/**
 * Seedable pseudo-random number generator using a 32-bit xorshift algorithm.
 * Use this instead of Math.random() for reproducible game logic.
 */
export class SeededRandom {
  private state: number;

  constructor(seed?: number) {
    // Default seed from current time if not provided
    this.state = (seed ?? Date.now()) | 0;
    if (this.state === 0) {
      this.state = 1;
    }
  }

  /** Get the current seed state (useful for save/load). */
  getState(): number {
    return this.state;
  }

  /** Set the seed state (useful for save/load). */
  setState(state: number): void {
    this.state = state | 0;
    if (this.state === 0) {
      this.state = 1;
    }
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >> 17;
    this.state ^= this.state << 5;
    return ((this.state >>> 0) % 2147483647) / 2147483647;
  }

  /** Returns an integer in [min, max] inclusive. */
  randomInt(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return Math.floor(this.next() * (hi - lo + 1)) + lo;
  }

  /** Returns a float in [0, 1). Alias for next(). */
  randomFloat(): number {
    return this.next();
  }

  /** Returns true with the given probability [0..1]. */
  randomChance(chance: number): boolean {
    return this.next() < chance;
  }
}
