import { clamp } from '../_common/math';
import type {
  PoliticalEntity,
  PoliticalEntityId,
  PoliticalRequestConditionContext,
  PoliticalRequestInstance,
  PoliticsManagerOptions,
  PoliticsSaveState,
  ReputationTier,
} from '../_common/models/politics.models';
import { reputationTierFromValue } from '../_common/models/politics.models';
import type { ResourceType } from '../_common/models/resource.models';
import type { SeededRandom } from '../_common/random';
import {
  getPoliticalRequestDefinition,
  politicalRequestDefinitions,
} from '../data/politicalRequests';

/** Default starting reputation for all entities. */
const DEFAULT_REPUTATION = 50;

/** Reputation penalty for ignoring (letting expire) a request. */
const EXPIRE_REPUTATION_PENALTY = -2;

/** Entity display definitions (name mapping). */
const ENTITY_DEFINITIONS: ReadonlyArray<{
  id: PoliticalEntityId;
  name: string;
}> = [
  { id: 'common-folk', name: 'Common Folk' },
  { id: 'economy-advisor', name: 'Economy Advisor' },
  { id: 'military-advisor', name: 'Military Advisor' },
  { id: 'politics-advisor', name: 'Politics Advisor' },
];

/**
 * Single source of truth for political reputation, requests, and delegation state.
 */
export class PoliticsManager {
  private entities: Map<PoliticalEntityId, PoliticalEntity> = new Map();
  private activeRequests: PoliticalRequestInstance[] = [];
  private cooldowns: Map<string, number> = new Map();
  /** Tracks the turn on which each entity is next scheduled to generate a request. */
  private entityScheduledTurns: Map<PoliticalEntityId, number> = new Map();
  private instanceSerial = 0;
  private version = 0;

  private readonly isTechUnlocked: (techId: string) => boolean;
  private readonly getResource: (type: string) => number;
  private readonly getBuildingCount: (buildingId: string) => number;

  constructor(options: PoliticsManagerOptions) {
    this.isTechUnlocked = options.isTechUnlocked;
    this.getResource = options.getResource;
    this.getBuildingCount = options.getBuildingCount;

    if (options.initial) {
      for (const entry of options.initial.entities) {
        this.entities.set(entry.id, {
          id: entry.id,
          name:
            ENTITY_DEFINITIONS.find((d) => d.id === entry.id)?.name ?? entry.id,
          reputation: clamp(entry.reputation, 0, 100),
        });
      }
      this.activeRequests = options.initial.activeRequests.map((r) => ({
        ...r,
      }));
      for (const cd of options.initial.cooldowns) {
        this.cooldowns.set(cd.definitionId, cd.lastTurn);
      }
      for (const entry of options.initial.entityScheduledTurns ?? []) {
        this.entityScheduledTurns.set(entry.entityId, entry.scheduledTurn);
      }
      this.instanceSerial = options.initial.instanceSerial;
      this.version = options.initial.version;
    } else {
      for (const def of ENTITY_DEFINITIONS) {
        this.entities.set(def.id, {
          id: def.id,
          name: def.name,
          reputation: DEFAULT_REPUTATION,
        });
      }
    }
  }

  // ─── Version tracking ────────────────────────────────────────────

  /** Version counter incremented on every state mutation. */
  getVersion(): number {
    return this.version;
  }

  // ─── Active entities ─────────────────────────────────────────────

  /**
   * Returns the entity IDs that are currently active (eligible to generate requests).
   * Common Folk are always active. Advisors require the Administration tech.
   */
  getActiveEntityIds(): PoliticalEntityId[] {
    const ids: PoliticalEntityId[] = ['common-folk'];
    if (this.isTechUnlocked('pol-clan-council')) {
      ids.push('economy-advisor', 'military-advisor', 'politics-advisor');
    }
    return ids;
  }

  // ─── Entity / Reputation queries ─────────────────────────────────

  /** Get all entities in display order. */
  getEntities(): readonly PoliticalEntity[] {
    return ENTITY_DEFINITIONS.map(
      (def) =>
        this.entities.get(def.id) ?? {
          id: def.id,
          name: def.name,
          reputation: DEFAULT_REPUTATION,
        }
    );
  }

  /** Get reputation value for a specific entity. */
  getReputation(entityId: PoliticalEntityId): number {
    return this.entities.get(entityId)?.reputation ?? DEFAULT_REPUTATION;
  }

  /** Get the display tier for an entity's reputation. */
  getReputationTier(entityId: PoliticalEntityId): ReputationTier {
    return reputationTierFromValue(this.getReputation(entityId)).tier;
  }

  /** Adjust reputation for an entity by a delta (clamped 0–100). */
  adjustReputation(entityId: PoliticalEntityId, delta: number): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    entity.reputation = clamp(entity.reputation + delta, 0, 100);
    this.version++;
  }

  // ─── Requests ────────────────────────────────────────────────────

  /** Get all active (unanswered) request instances. */
  getActiveRequests(): readonly PoliticalRequestInstance[] {
    return this.activeRequests;
  }

  /** Approve a request by its instance id. Returns true if found and processed. */
  approveRequest(
    instanceId: number,
    applyResources: (effects: Partial<Record<ResourceType, number>>) => void
  ): boolean {
    const idx = this.activeRequests.findIndex(
      (r) => r.instanceId === instanceId
    );
    if (idx === -1) return false;

    const instance = this.activeRequests[idx];
    const def = getPoliticalRequestDefinition(instance.definitionId);
    if (!def) return false;

    // Apply reputation changes
    for (const [entityId, delta] of Object.entries(def.approveRepChanges)) {
      this.adjustReputation(entityId as PoliticalEntityId, delta);
    }

    // Apply resource effects
    if (def.approveResourceEffects) {
      applyResources(
        def.approveResourceEffects as Partial<Record<ResourceType, number>>
      );
    }

    this.activeRequests.splice(idx, 1);
    this.version++;
    return true;
  }

  /** Deny a request by its instance id. Returns true if found and processed. */
  denyRequest(instanceId: number): boolean {
    const idx = this.activeRequests.findIndex(
      (r) => r.instanceId === instanceId
    );
    if (idx === -1) return false;

    const instance = this.activeRequests[idx];
    const def = getPoliticalRequestDefinition(instance.definitionId);
    if (!def) return false;

    // Apply reputation changes
    for (const [entityId, delta] of Object.entries(def.denyRepChanges)) {
      this.adjustReputation(entityId as PoliticalEntityId, delta);
    }

    this.activeRequests.splice(idx, 1);
    this.version++;
    return true;
  }

  /**
   * Generate new requests at the start of a turn.
   * Each active entity sends one request per week (7 turns) on a random day.
   * Called by TurnManager during end-turn resolution.
   */
  generateTurnRequests(currentTurn: number, rng: SeededRandom): void {
    // First, expire old requests
    this.expireRequests(currentTurn);

    const activeEntityIds = this.getActiveEntityIds();
    const activeDefIds = new Set(this.activeRequests.map((r) => r.definitionId));
    const activeEntitySet = new Set(this.activeRequests.map((r) => r.entityId));

    // Build condition context
    const ctx: PoliticalRequestConditionContext = {
      turn: currentTurn,
      isTechUnlocked: this.isTechUnlocked,
      getReputation: (entityId) => this.getReputation(entityId),
      getResource: this.getResource,
      getBuildingCount: this.getBuildingCount,
    };

    for (const entityId of activeEntityIds) {
      // Lazy-init: schedule entity's first request to a random day in the first week
      if (!this.entityScheduledTurns.has(entityId)) {
        this.entityScheduledTurns.set(entityId, rng.randomInt(1, 7));
      }

      const scheduledTurn = this.entityScheduledTurns.get(entityId)!;
      if (currentTurn < scheduledTurn) continue;

      // Reschedule to next week (base it on scheduledTurn to avoid drift)
      const nextScheduled = Math.max(currentTurn, scheduledTurn) + 7 + rng.randomInt(0, 6);
      this.entityScheduledTurns.set(entityId, nextScheduled);

      // Skip if this entity already has an active pending request
      if (activeEntitySet.has(entityId)) continue;

      // Find eligible request definitions for this entity
      const eligible = politicalRequestDefinitions.filter((def) => {
        if (def.entityId !== entityId) return false;
        if (activeDefIds.has(def.id)) return false;
        const lastTurn = this.cooldowns.get(def.id);
        if (lastTurn !== undefined && currentTurn - lastTurn < def.cooldownTurns)
          return false;
        if (def.condition && !def.condition(ctx)) return false;
        return true;
      });

      if (eligible.length === 0) continue;

      // Weighted random selection from eligible pool
      const totalWeight = eligible.reduce((sum, d) => sum + d.weight, 0);
      const roll = rng.next() * totalWeight;
      let cumulative = 0;
      for (const def of eligible) {
        cumulative += def.weight;
        if (roll < cumulative) {
          this.instanceSerial++;
          this.activeRequests.push({
            instanceId: this.instanceSerial,
            definitionId: def.id,
            entityId: def.entityId,
            turnCreated: currentTurn,
          });
          this.cooldowns.set(def.id, currentTurn);
          this.version++;
          break;
        }
      }
    }
  }

  /** Expire old unanswered requests and apply reputation penalties. */
  private expireRequests(currentTurn: number): void {
    const toRemove: number[] = [];

    for (const instance of this.activeRequests) {
      const def = getPoliticalRequestDefinition(instance.definitionId);
      if (!def || !def.expireTurns) continue;

      if (currentTurn - instance.turnCreated >= def.expireTurns) {
        // Apply expire penalty
        this.adjustReputation(instance.entityId, EXPIRE_REPUTATION_PENALTY);
        toRemove.push(instance.instanceId);
      }
    }

    if (toRemove.length > 0) {
      this.activeRequests = this.activeRequests.filter(
        (r) => !toRemove.includes(r.instanceId)
      );
      this.version++;
    }
  }

  // ─── Save / Load ─────────────────────────────────────────────────

  /** Get serializable state for save system. */
  getSaveState(): PoliticsSaveState {
    return {
      entities: Array.from(this.entities.values()).map((e) => ({
        id: e.id,
        reputation: e.reputation,
      })),
      activeRequests: this.activeRequests.map((r) => ({ ...r })),
      cooldowns: Array.from(this.cooldowns.entries()).map(
        ([definitionId, lastTurn]) => ({
          definitionId,
          lastTurn,
        })
      ),
      entityScheduledTurns: Array.from(this.entityScheduledTurns.entries()).map(
        ([entityId, scheduledTurn]) => ({ entityId, scheduledTurn })
      ),
      instanceSerial: this.instanceSerial,
      version: this.version,
    };
  }
}
