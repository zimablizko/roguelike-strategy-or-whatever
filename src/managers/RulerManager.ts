import { clamp } from '../_common/math';
import type {
  RulerData,
  RulerHealth,
  RulerManagerOptions,
} from '../_common/models/ruler.models';
import { RULER_HEALTH_LEVELS } from '../_common/models/ruler.models';
import { SeededRandom } from '../_common/random';
import { Resources } from '../_common/resources';

/**
 * Manages ruler state (name/age/portrait/focus/charisma/health).
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

  /** Get the ruler's focus stat (determines max actions per turn). */
  getFocus(): number {
    return this.ruler.focus;
  }

  /** Get the ruler's charisma stat. */
  getCharisma(): number {
    return this.ruler.charisma;
  }

  /** Get the ruler's verbal health status. */
  getHealth(): RulerHealth {
    return this.ruler.health;
  }

  /** Set the ruler's health to a new level. */
  setHealth(health: RulerHealth): void {
    this.ruler.health = health;
  }

  /**
   * Move health one step up or down.
   * Returns the new health value.
   */
  adjustHealth(delta: 1 | -1): RulerHealth {
    const idx = RULER_HEALTH_LEVELS.indexOf(this.ruler.health);
    const newIdx = clamp(idx + delta, 0, RULER_HEALTH_LEVELS.length - 1);
    this.ruler.health = RULER_HEALTH_LEVELS[newIdx];
    return this.ruler.health;
  }

  private generateRuler(initial?: RulerManagerOptions['initial']): RulerData {
    const names = ['Aurelia', 'Cedric', 'Elowen', 'Rowan', 'Dorian', 'Lyra'];
    const name =
      initial?.name ??
      names[this.rng.randomInt(0, names.length - 1)] ??
      'Ruler';

    const age = initial?.age ?? this.rng.randomInt(18, 55);

    // Placeholder portrait using an existing loaded icon.
    const portrait = initial?.portrait ?? Resources.PopulationIcon;

    // Focus: average 6, range 4–8
    const focus = clamp(initial?.focus ?? this.rng.randomInt(4, 8), 1, 20);

    // Charisma: average 10, range 8–12
    const charisma = clamp(
      initial?.charisma ?? this.rng.randomInt(8, 12),
      1,
      20
    );

    // Health: defaults to 'Good'
    const health: RulerHealth = initial?.health ?? 'Good';

    return { name, age, portrait, focus, charisma, health };
  }
}
