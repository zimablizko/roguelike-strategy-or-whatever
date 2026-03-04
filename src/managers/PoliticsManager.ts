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

/** Maximum number of new requests generated per turn (base). */
const BASE_MAX_NEW_REQUESTS = 2;

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
   * Called by TurnManager during end-turn resolution.
   */
  generateTurnRequests(currentTurn: number, rng: SeededRandom): void {
    // First, expire old requests
    this.expireRequests(currentTurn);

    // Town Hall must be unlocked (pol-clan-council researched)
    if (!this.isTechUnlocked('pol-clan-council')) return;

    const maxNew = this.isTechUnlocked('pol-state-bureaucracy')
      ? BASE_MAX_NEW_REQUESTS + 1
      : BASE_MAX_NEW_REQUESTS;

    // Build condition context
    const ctx: PoliticalRequestConditionContext = {
      turn: currentTurn,
      isTechUnlocked: this.isTechUnlocked,
      getReputation: (entityId) => this.getReputation(entityId),
      getResource: this.getResource,
      getBuildingCount: this.getBuildingCount,
    };

    // Collect eligible definitions
    const activeDefIds = new Set(
      this.activeRequests.map((r) => r.definitionId)
    );
    const eligible = politicalRequestDefinitions.filter((def) => {
      // Skip if already active
      if (activeDefIds.has(def.id)) return false;

      // Check cooldown
      const lastTurn = this.cooldowns.get(def.id);
      if (lastTurn !== undefined && currentTurn - lastTurn < def.cooldownTurns)
        return false;

      // Check condition
      if (def.condition && !def.condition(ctx)) return false;

      return true;
    });

    if (eligible.length === 0) return;

    // Weighted random selection
    const totalWeight = eligible.reduce((sum, d) => sum + d.weight, 0);
    const count = Math.min(maxNew, eligible.length);
    const selected: typeof eligible = [];

    for (let i = 0; i < count; i++) {
      // 50% chance to skip a slot (so 0–maxNew requests appear)
      if (rng.next() < 0.3) continue;

      const roll = rng.next() * totalWeight;
      let cumulative = 0;
      for (const def of eligible) {
        if (selected.some((s) => s.id === def.id)) continue;
        cumulative += def.weight;
        if (roll < cumulative) {
          selected.push(def);
          break;
        }
      }
    }

    // Create instances
    for (const def of selected) {
      this.instanceSerial++;
      this.activeRequests.push({
        instanceId: this.instanceSerial,
        definitionId: def.id,
        entityId: def.entityId,
        turnCreated: currentTurn,
      });
      this.cooldowns.set(def.id, currentTurn);
    }

    if (selected.length > 0) {
      this.version++;
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
      instanceSerial: this.instanceSerial,
      version: this.version,
    };
  }
}
