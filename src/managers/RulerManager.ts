import { clamp } from '../_common/math';
import { SeededRandom } from '../_common/random';
import type {
  RulerData,
  RulerManagerOptions,
} from '../_common/models/ruler.models';
import { Resources } from '../_common/resources';

/**
 * Manages ruler state (name/age/popularity/portrait).
 * Ruler is generated when this manager is created.
 */
export class RulerManager {
  private ruler: RulerData;
  private readonly rng: SeededRandom;

  constructor(options: RulerManagerOptions = {}) {
    this.rng = options.rng ?? new SeededRandom();
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
    this.ruler.popularity = clamp(Math.floor(value), 0, 100);
  }

  addPopularity(delta: number): void {
    this.setPopularity(this.ruler.popularity + delta);
  }

  private generateRuler(initial?: RulerManagerOptions['initial']): RulerData {
    const names = ['Aurelia', 'Cedric', 'Elowen', 'Rowan', 'Dorian', 'Lyra'];
    const name =
      initial?.name ??
      names[this.rng.randomInt(0, names.length - 1)] ??
      'Ruler';

    const age = initial?.age ?? this.rng.randomInt(18, 55);
    const popularity = clamp(
      initial?.popularity ?? this.rng.randomInt(35, 75),
      0,
      100
    );

    // Placeholder portrait using an existing loaded icon.
    const portrait = initial?.portrait ?? Resources.PopulationIcon;

    return { name, age, popularity, portrait };
  }
}
