/**
 * Clamp a value between min and max (inclusive).
 */
export function clamp(
  value: number,
  min: number,
  max: number = Number.MAX_SAFE_INTEGER
): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Non-seedable random integer in [min, max] inclusive.
 * Prefer `SeededRandom.randomInt()` for game logic that needs reproducibility.
 */
export function randomInt(min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
