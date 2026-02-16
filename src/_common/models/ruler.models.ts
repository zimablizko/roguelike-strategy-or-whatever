import type { ImageSource } from 'excalibur';
import type { SeededRandom } from '../random';

export type RulerData = {
  name: string;
  age: number;
  popularity: number;
  portrait: ImageSource;
};

export interface RulerManagerOptions {
  initial?: Partial<Omit<RulerData, 'portrait'>> & { portrait?: ImageSource };
  rng?: SeededRandom;
}
