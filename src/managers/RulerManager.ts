import { ImageSource } from 'excalibur';
import { Resources } from '../_common/resources';

export type RulerData = {
  name: string;
  age: number;
  popularity: number; // 0..100
  portrait: ImageSource;
  // talents: not implemented yet
};

export interface RulerManagerOptions {
  initial?: Partial<Omit<RulerData, 'portrait'>> & { portrait?: ImageSource };
}

/**
 * Manages ruler state (name/age/popularity/portrait).
 * Ruler is generated when this manager is created.
 */
export class RulerManager {
  private ruler: RulerData;

  constructor(options: RulerManagerOptions = {}) {
    this.ruler = this.generateRuler(options.initial);
  }

  getRuler(): RulerData {
    return { ...this.ruler };
  }

  /**
   * Get ruler data by reference (read-only view).
   * Use for hot UI polling paths to avoid per-frame allocations.
   */
  getRulerRef(): Readonly<RulerData> {
    return this.ruler;
  }

  regenerate(initial?: RulerManagerOptions['initial']): void {
    this.ruler = this.generateRuler(initial);
  }

  incrementAge(): void {
    this.ruler.age += 1;
  }

  setPopularity(value: number): void {
    this.ruler.popularity = this.clamp(Math.floor(value), 0, 100);
  }

  addPopularity(delta: number): void {
    this.setPopularity(this.ruler.popularity + delta);
  }

  private generateRuler(initial?: RulerManagerOptions['initial']): RulerData {
    const names = ['Aurelia', 'Cedric', 'Elowen', 'Rowan', 'Dorian', 'Lyra'];
    const name =
      initial?.name ??
      names[Math.floor(Math.random() * names.length)] ??
      'Ruler';

    const age = initial?.age ?? this.randomInt(18, 55);
    const popularity = this.clamp(
      initial?.popularity ?? this.randomInt(35, 75),
      0,
      100
    );

    // Placeholder portrait using an existing loaded icon.
    const portrait = initial?.portrait ?? Resources.PopulationIcon;

    return { name, age, popularity, portrait };
  }

  private randomInt(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
