import { clamp } from '../_common/math';
import { applyRulerTraitEffects, normalizeRulerTraitIds } from '../data/traits';
import type {
  RulerData,
  RulerHealth,
  RulerManagerOptions,
  RulerSkillId,
} from '../_common/models/ruler.models';
import {
  RULER_HEALTH_LEVELS,
  RULER_SKILL_LABELS,
} from '../_common/models/ruler.models';
import { SeededRandom } from '../_common/random';
import { generateRulerName } from '../data/gameSetup';

/**
 * Manages ruler state (name/age/portrait/stats/health).
 * Ruler is generated when this manager is created.
 */
export class RulerManager {
  private ruler: RulerData;
  private readonly rng: SeededRandom;
  private readonly applyTraitEffectsByDefault: boolean;

  constructor(options: RulerManagerOptions = {}) {
    this.rng = options.rng ?? new SeededRandom();
    this.applyTraitEffectsByDefault = options.applyTraitEffects ?? true;
    this.ruler = this.generateRuler(options.initial, this.applyTraitEffectsByDefault);
  }

  getRuler(): RulerData {
    return { ...this.ruler, traits: [...this.ruler.traits] };
  }

  /**
   * Get ruler data by reference (read-only view).
   * Use for hot UI polling paths to avoid per-frame allocations.
   */
  getRulerRef(): Readonly<RulerData> {
    return this.ruler;
  }

  regenerate(initial?: RulerManagerOptions['initial']): void {
    this.ruler = this.generateRuler(initial, this.applyTraitEffectsByDefault);
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

  getGovernance(): number {
    return this.ruler.governance;
  }

  getIntrigue(): number {
    return this.ruler.intrigue;
  }

  getWarfare(): number {
    return this.ruler.warfare;
  }

  getSkillValue(skill: RulerSkillId): number {
    switch (skill) {
      case 'charisma':
        return this.ruler.charisma;
      case 'governance':
        return this.ruler.governance;
      case 'intrigue':
        return this.ruler.intrigue;
      case 'warfare':
        return this.ruler.warfare;
      default:
        return 0;
    }
  }

  getSkillLabel(skill: RulerSkillId): string {
    return RULER_SKILL_LABELS[skill] ?? skill;
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

  private generateRuler(
    initial?: RulerManagerOptions['initial'],
    applyTraitEffects: boolean = true
  ): RulerData {
    const name = initial?.name ?? generateRulerName(this.rng);
    const traits = normalizeRulerTraitIds(initial?.traits);

    const age = initial?.age ?? this.rng.randomInt(18, 55);

    // Portrait is optional; a real portrait image should be provided externally.
    const portrait = initial?.portrait;

    // Focus: average 6, range 4–8
    const focus = clamp(initial?.focus ?? this.rng.randomInt(4, 8), 1, 20);

    // Charisma: average 10, range 8–12
    const charisma = clamp(
      initial?.charisma ?? this.rng.randomInt(8, 12),
      1,
      20
    );
    const governance = clamp(
      initial?.governance ?? this.rng.randomInt(8, 12),
      1,
      20
    );
    const intrigue = clamp(
      initial?.intrigue ?? this.rng.randomInt(8, 12),
      1,
      20
    );
    const warfare = clamp(
      initial?.warfare ?? this.rng.randomInt(8, 12),
      1,
      20
    );

    // Health: defaults to 'Good'
    const health: RulerHealth = initial?.health ?? 'Good';

    if (!applyTraitEffects || traits.length === 0) {
      return {
        name,
        age,
        portrait,
        traits,
        focus,
        charisma,
        governance,
        intrigue,
        warfare,
        health,
      };
    }

    return {
      name,
      portrait,
      traits,
      ...applyRulerTraitEffects(
        {
          age,
          focus,
          charisma,
          governance,
          intrigue,
          warfare,
          health,
        },
        traits
      ),
    };
  }
}
