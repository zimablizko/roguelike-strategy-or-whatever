import type {
  ActiveCondition,
  ConditionEffects,
  ConditionId,
  ConditionSaveState,
  ConditionSourceType,
} from '../_common/models/condition.models';
import {
  aggregateConditionEffects,
  getConditionDefinition,
  isConditionId,
} from '../data/conditions';
import type { GameLogManager } from './GameLogManager';

export interface ConditionManagerOptions {
  logManager?: GameLogManager;
  initial?: ConditionSaveState;
}

/**
 * Owns and ticks active conditions (multi-turn passive effects).
 * Exposes aggregated effect queries for other managers to consume.
 */
export class ConditionManager {
  private activeConditions: ActiveCondition[] = [];
  private version = 0;
  private cachedEffects?: ConditionEffects;
  private cachedEffectsVersion = -1;
  private readonly logManager?: GameLogManager;

  constructor(options?: ConditionManagerOptions) {
    this.logManager = options?.logManager;
    if (options?.initial) {
      this.load(options.initial);
    }
  }

  // ─── Public API ────────────────────────────────────────────────

  /**
   * Apply a condition. If the condition is not stackable and already active,
   * the existing instance's duration is refreshed to whichever is greater.
   */
  applyCondition(
    conditionId: ConditionId,
    currentTurn: number,
    options?: {
      duration?: number;
      sourceType?: ConditionSourceType;
      sourceId?: string;
    }
  ): void {
    const definition = getConditionDefinition(conditionId);
    if (!definition) return;

    const duration = options?.duration ?? definition.defaultDuration;

    if (!definition.stackable) {
      const existing = this.activeConditions.find(
        (c) => c.conditionId === conditionId
      );
      if (existing) {
        existing.turnsRemaining = Math.max(existing.turnsRemaining, duration);
        this.version++;
        return;
      }
    } else if (definition.maxStacks !== undefined) {
      const stackCount = this.activeConditions.filter(
        (c) => c.conditionId === conditionId
      ).length;
      if (stackCount >= definition.maxStacks) return;
    }

    this.activeConditions.push({
      conditionId,
      turnsRemaining: duration,
      appliedOnTurn: currentTurn,
      sourceType: options?.sourceType ?? 'system',
      sourceId: options?.sourceId,
    });
    this.version++;

    this.logManager?.addNeutral(
      `Condition started: ${definition.name} (${duration} turns).`
    );
  }

  /** Force-remove all instances of a condition. */
  removeCondition(conditionId: ConditionId): void {
    const before = this.activeConditions.length;
    this.activeConditions = this.activeConditions.filter(
      (c) => c.conditionId !== conditionId
    );
    if (this.activeConditions.length !== before) {
      this.version++;
    }
  }

  /**
   * Tick all active conditions: decrement turns remaining, remove expired.
   * Should be called once per turn in TurnManager.endTurn().
   */
  tickConditions(): void {
    if (this.activeConditions.length === 0) return;

    const expiring: ActiveCondition[] = [];
    for (const condition of this.activeConditions) {
      condition.turnsRemaining--;
      if (condition.turnsRemaining <= 0) {
        expiring.push(condition);
      }
    }

    if (expiring.length > 0) {
      this.activeConditions = this.activeConditions.filter(
        (c) => c.turnsRemaining > 0
      );
      for (const expired of expiring) {
        const definition = getConditionDefinition(expired.conditionId);
        if (definition) {
          this.logManager?.addNeutral(`Condition ended: ${definition.name}.`);
        }
      }
    }

    this.version++;
  }

  /** Read-only reference for hot polling paths. */
  getActiveConditionsRef(): readonly ActiveCondition[] {
    return this.activeConditions;
  }

  hasCondition(conditionId: ConditionId): boolean {
    return this.activeConditions.some((c) => c.conditionId === conditionId);
  }

  /**
   * Aggregated effects across all active conditions.
   * Cached until version changes.
   */
  getAggregatedEffects(): ConditionEffects {
    if (this.cachedEffectsVersion === this.version && this.cachedEffects) {
      return this.cachedEffects;
    }
    this.cachedEffects = aggregateConditionEffects(this.activeConditions);
    this.cachedEffectsVersion = this.version;
    return this.cachedEffects;
  }

  getVersion(): number {
    return this.version;
  }

  // ─── Save / Load ──────────────────────────────────────────────

  getSaveState(): ConditionSaveState {
    return {
      activeConditions: this.activeConditions.map((c) => ({ ...c })),
      version: this.version,
    };
  }

  load(state: ConditionSaveState): void {
    this.activeConditions = (state.activeConditions ?? [])
      .filter((c) => isConditionId(c.conditionId))
      .map((c) => ({
        conditionId: c.conditionId,
        turnsRemaining: Math.max(0, c.turnsRemaining),
        appliedOnTurn: Math.max(1, c.appliedOnTurn),
        sourceType: c.sourceType ?? 'system',
        sourceId: c.sourceId,
      }));
    this.version = Math.max(0, state.version ?? 0);
  }
}
