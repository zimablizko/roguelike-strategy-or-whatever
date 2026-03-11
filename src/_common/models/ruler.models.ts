import type { ImageSource } from 'excalibur';
import type { SeededRandom } from '../random';

/** Verbal health rating for the ruler. */
export type RulerHealth = 'Poor' | 'Fair' | 'Good' | 'Strong' | 'Excellent';

export const RULER_HEALTH_LEVELS: readonly RulerHealth[] = [
  'Poor',
  'Fair',
  'Good',
  'Strong',
  'Excellent',
] as const;

export type RulerData = {
  name: string;
  age: number;
  portrait?: ImageSource;
  /** Determines max actions per turn. Average ~6 ±2. */
  focus: number;
  /** Communication effectiveness. Average ~10 ±2. */
  charisma: number;
  /** Verbal health status affecting natural death chance. */
  health: RulerHealth;
};

export interface RulerManagerOptions {
  initial?: Partial<Omit<RulerData, 'portrait'>> & { portrait?: ImageSource };
  rng?: SeededRandom;
}
