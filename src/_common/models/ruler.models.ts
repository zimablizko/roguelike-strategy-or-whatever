import type { ImageSource } from 'excalibur';
import type { SeededRandom } from '../random';
import type { RulerTraitId } from './ruler-traits.models';

/** Verbal health rating for the ruler. */
export type RulerHealth = 'Poor' | 'Fair' | 'Good' | 'Strong' | 'Excellent';
export type RulerSkillId =
  | 'charisma'
  | 'governance'
  | 'intrigue'
  | 'warfare';

export const RULER_SKILL_LABELS: Record<RulerSkillId, string> = {
  charisma: 'Charisma',
  governance: 'Governance',
  intrigue: 'Intrigue',
  warfare: 'Warfare',
};

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
  traits: RulerTraitId[];
  /** Determines max actions per turn. Average ~6 ±2. */
  focus: number;
  /** Communication effectiveness. Average ~10 ±2. */
  charisma: number;
  /** Administrative and economic competence. Average ~10 ±2. */
  governance: number;
  /** Deception, secrecy, and court maneuvering. Average ~10 ±2. */
  intrigue: number;
  /** Military judgment and command presence. Average ~10 ±2. */
  warfare: number;
  /** Verbal health status affecting natural death chance. */
  health: RulerHealth;
};

export interface RulerManagerOptions {
  initial?: Partial<Omit<RulerData, 'portrait'>> & { portrait?: ImageSource };
  rng?: SeededRandom;
  applyTraitEffects?: boolean;
}
