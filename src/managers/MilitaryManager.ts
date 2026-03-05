import type {
  MilitaryAssignment,
  MilitaryManagerOptions,
  MilitarySaveState,
  MilitarySnapshot,
  MilitaryTaskType,
  MilitaryThreat,
  ThreatOutcome,
  ThreatType,
  TrainingOrder,
  UnitReadiness,
  UnitRole,
  UnitStack,
} from '../_common/models/military.models';
import type { ResourceCost } from '../_common/models/resource.models';
import type { SeededRandom } from '../_common/random';
import { getUnitDefinition } from '../data/military';

/**
 * Single source of truth for all military state:
 * roster, training queue, assignments, and aggregated metrics.
 */
export class MilitaryManager {
  private roster: UnitStack[] = [];
  private trainingQueue: TrainingOrder[] = [];
  private assignments: MilitaryAssignment[] = [];
  private threats: MilitaryThreat[] = [];
  private lastOutcomes: ThreatOutcome[] = [];
  private orderSerial = 0;
  private assignmentSerial = 0;
  private threatSerial = 0;
  private version = 0;

  private readonly getBarracksCapacity: () => number;
  private readonly getGarrisonCapacity: () => number;
  private readonly isTechUnlocked: (techId: string) => boolean;

  constructor(options: MilitaryManagerOptions) {
    this.getBarracksCapacity = options.getBarracksCapacity;
    this.getGarrisonCapacity = options.getGarrisonCapacity;
    this.isTechUnlocked = options.isTechnologyUnlocked;

    if (options.initial) {
      this.roster = options.initial.roster.map((s) => ({ ...s }));
      this.trainingQueue = options.initial.trainingQueue.map((o) => ({ ...o }));
      this.assignments = options.initial.assignments.map((a) => ({
        ...a,
        allocatedUnits: { ...a.allocatedUnits },
      }));
      this.threats = (options.initial.threats ?? []).map((t) => ({ ...t }));
      this.lastOutcomes = (options.initial.lastOutcomes ?? []).map((o) => ({
        ...o,
        casualties: { ...o.casualties },
        resourceLosses: { ...o.resourceLosses },
      }));
      this.orderSerial = options.initial.orderSerial;
      this.assignmentSerial = options.initial.assignmentSerial;
      this.threatSerial = options.initial.threatSerial ?? 0;
      this.version = options.initial.version;
    }
  }

  // ─── Version tracking ────────────────────────────────────────────

  /** Version counter incremented on every state mutation. */
  getMilitaryVersion(): number {
    return this.version;
  }

  // ─── Roster queries ──────────────────────────────────────────────

  /** Get the full roster (read-only view). */
  getRoster(): readonly Readonly<UnitStack>[] {
    return this.roster;
  }

  /**
   * Count units of a given role at any readiness level.
   * If readiness is omitted, counts all units of that role.
   */
  getUnitCount(unitId: UnitRole, readiness?: UnitReadiness): number {
    let total = 0;
    for (const stack of this.roster) {
      if (stack.unitId !== unitId) continue;
      if (readiness !== undefined && stack.readiness !== readiness) continue;
      total += stack.count;
    }
    return total;
  }

  /** Count all units at a given readiness level. */
  getTotalUnits(readiness?: UnitReadiness): number {
    let total = 0;
    for (const stack of this.roster) {
      if (readiness !== undefined && stack.readiness !== readiness) continue;
      total += stack.count;
    }
    return total;
  }

  // ─── Training ────────────────────────────────────────────────────

  /** Get the current training queue (read-only). */
  getTrainingQueue(): readonly Readonly<TrainingOrder>[] {
    return this.trainingQueue;
  }

  /** Total number of units currently in training across all orders. */
  getTrainingSlotUsage(): number {
    let total = 0;
    for (const order of this.trainingQueue) {
      total += order.count;
    }
    return total;
  }

  /** Maximum training slots available from all barracks. */
  getTrainingCapacity(): number {
    return this.getBarracksCapacity();
  }

  /** Available training slots (capacity minus current usage). */
  getAvailableTrainingSlots(): number {
    return Math.max(
      0,
      this.getTrainingCapacity() - this.getTrainingSlotUsage()
    );
  }

  /** Maximum garrisoned (non-training) units across all barracks.
   *  Standing Army tech doubles garrison capacity. */
  getMaxGarrison(): number {
    const base = this.getGarrisonCapacity();
    return this.isTechUnlocked('mil-standing-army') ? base * 2 : base;
  }

  /** Current number of non-training (available + assigned) units. */
  getGarrisonUsage(): number {
    let count = 0;
    for (const stack of this.roster) {
      if (stack.readiness !== 'training') {
        count += stack.count;
      }
    }
    return count;
  }

  /** How many more units can be garrisoned. */
  getAvailableGarrisonSlots(): number {
    return Math.max(0, this.getMaxGarrison() - this.getGarrisonUsage());
  }

  /**
   * Get the resource cost to train `count` units of the given type.
   * Returns undefined if unit definition not found.
   */
  getTrainingCost(unitId: UnitRole, count: number): ResourceCost | undefined {
    const def = getUnitDefinition(unitId);
    if (!def) return undefined;
    const cost: ResourceCost = {};
    for (const [res, amount] of Object.entries(def.trainingCost)) {
      (cost as Record<string, number>)[res] = (amount as number) * count;
    }
    return cost;
  }

  /**
   * Check whether a training order can be placed.
   * Returns a reason string if not possible, or undefined if OK.
   */
  canTrain(unitId: UnitRole, count: number): string | undefined {
    if (count <= 0) return 'Count must be positive.';
    const def = getUnitDefinition(unitId);
    if (!def) return `Unknown unit type: ${unitId}`;
    if (this.getAvailableTrainingSlots() < count) {
      return 'Not enough training slots for this order.';
    }
    if (this.getAvailableGarrisonSlots() < count) {
      return 'Not enough garrison capacity — build more Barracks.';
    }
    return undefined;
  }

  /**
   * Enqueue a training order. Caller is responsible for deducting resources.
   * Returns the new order, or undefined if validation fails.
   */
  enqueueTraining(unitId: UnitRole, count: number): TrainingOrder | undefined {
    const reason = this.canTrain(unitId, count);
    if (reason) return undefined;
    const def = getUnitDefinition(unitId)!;
    const order: TrainingOrder = {
      orderId: ++this.orderSerial,
      unitId,
      turnsLeft: def.trainingTime,
      count,
    };
    this.trainingQueue.push(order);
    // Also add a "training" roster entry so counts stay consistent.
    this.addToRoster(unitId, count, 'training');
    this.version++;
    return order;
  }

  /**
   * Advance training by one turn. Completed orders move units to 'available'.
   * Returns array of completed order summaries.
   */
  advanceTraining(): Array<{ unitId: UnitRole; count: number }> {
    const completed: Array<{ unitId: UnitRole; count: number }> = [];
    const remaining: TrainingOrder[] = [];

    for (const order of this.trainingQueue) {
      order.turnsLeft--;
      if (order.turnsLeft <= 0) {
        // Move from 'training' to 'available' in roster.
        this.removeFromRoster(order.unitId, order.count, 'training');
        this.addToRoster(order.unitId, order.count, 'available');
        completed.push({ unitId: order.unitId, count: order.count });
      } else {
        remaining.push(order);
      }
    }
    this.trainingQueue = remaining;
    if (completed.length > 0) this.version++;
    return completed;
  }

  // ─── Assignments ─────────────────────────────────────────────────

  /** Get all active assignments (read-only). */
  getAssignments(): readonly Readonly<MilitaryAssignment>[] {
    return this.assignments;
  }

  /**
   * Create a new assignment, moving allocated units from 'available' to 'assigned'.
   * Returns the assignment, or undefined if any unit count is unavailable.
   */
  createAssignment(
    taskType: MilitaryTaskType,
    allocatedUnits: Partial<Record<UnitRole, number>>,
    target?: string,
    risk: MilitaryAssignment['risk'] = 'unknown'
  ): MilitaryAssignment | undefined {
    // Validate availability.
    for (const [unitId, count] of Object.entries(allocatedUnits) as [
      UnitRole,
      number,
    ][]) {
      if (count <= 0) continue;
      if (this.getUnitCount(unitId, 'available') < count) {
        return undefined;
      }
    }
    // Move units.
    for (const [unitId, count] of Object.entries(allocatedUnits) as [
      UnitRole,
      number,
    ][]) {
      if (count <= 0) continue;
      this.removeFromRoster(unitId, count, 'available');
      this.addToRoster(unitId, count, 'assigned');
    }

    const assignment: MilitaryAssignment = {
      assignmentId: ++this.assignmentSerial,
      taskType,
      target,
      allocatedUnits: { ...allocatedUnits },
      risk,
    };
    this.assignments.push(assignment);
    this.version++;
    return assignment;
  }

  /**
   * Dissolve an assignment and return its units to 'available'.
   */
  removeAssignment(assignmentId: number): boolean {
    const idx = this.assignments.findIndex(
      (a) => a.assignmentId === assignmentId
    );
    if (idx === -1) return false;
    const assignment = this.assignments[idx];
    for (const [unitId, count] of Object.entries(assignment.allocatedUnits) as [
      UnitRole,
      number,
    ][]) {
      if (count <= 0) continue;
      this.removeFromRoster(unitId, count, 'assigned');
      this.addToRoster(unitId, count, 'available');
    }
    this.assignments.splice(idx, 1);
    this.version++;
    return true;
  }

  // ─── Upkeep ──────────────────────────────────────────────────────

  /**
   * Calculate total upkeep cost for all non-training units.
   * Standing Army reduces meat upkeep by 1 per unit (min 0).
   */
  getTotalUpkeep(): ResourceCost {
    const total: Record<string, number> = {};
    const hasStandingArmy = this.isTechUnlocked('mil-standing-army');
    for (const stack of this.roster) {
      if (stack.readiness === 'training') continue;
      const def = getUnitDefinition(stack.unitId);
      if (!def) continue;
      for (const [res, amount] of Object.entries(def.upkeep)) {
        let perUnit = amount as number;
        if (hasStandingArmy && res === 'meat') {
          perUnit = Math.max(0, perUnit - 1);
        }
        total[res] = (total[res] ?? 0) + perUnit * stack.count;
      }
    }
    return total as ResourceCost;
  }

  // ─── Snapshot ────────────────────────────────────────────────────

  /**
   * Compute an aggregated snapshot of military metrics.
   */
  getSnapshot(): MilitarySnapshot {
    const composition: Partial<Record<UnitRole, number>> = {};
    let totalPower = 0;
    let availableCount = 0;
    let assignedCount = 0;
    let trainingCount = 0;
    const hasIronWeapons = this.isTechUnlocked('mil-iron-weapons');

    for (const stack of this.roster) {
      composition[stack.unitId] =
        (composition[stack.unitId] ?? 0) + stack.count;

      const def = getUnitDefinition(stack.unitId);
      let unitPower = def ? def.power : 0;
      // Iron Weapons: footmen gain +1 power
      if (hasIronWeapons && stack.unitId === 'footman') {
        unitPower += 1;
      }
      const power = unitPower * stack.count;

      switch (stack.readiness) {
        case 'available':
          availableCount += stack.count;
          totalPower += power;
          break;
        case 'assigned':
          assignedCount += stack.count;
          totalPower += power;
          break;
        case 'training':
          trainingCount += stack.count;
          break;
      }
    }

    return {
      totalPower,
      availableCount,
      assignedCount,
      trainingCount,
      composition,
    };
  }

  // ─── Threats ─────────────────────────────────────────────────────

  /** Get all active threats (read-only). */
  getThreats(): readonly Readonly<MilitaryThreat>[] {
    return this.threats;
  }

  /** Get outcome reports from the last turn resolution. */
  getLastOutcomes(): readonly Readonly<ThreatOutcome>[] {
    return this.lastOutcomes;
  }

  /** Clear last outcomes (call after UI has displayed them). */
  clearLastOutcomes(): void {
    this.lastOutcomes = [];
  }

  /**
   * Roll for new threats at end-of-turn. Chance scales with turn number.
   * Returns newly generated threats.
   */
  generateThreats(turnNumber: number, rng: SeededRandom): MilitaryThreat[] {
    const newThreats: MilitaryThreat[] = [];
    // No threats before turn 5
    if (turnNumber < 5) return newThreats;
    // Base 15% chance scaling +1.5%/turn, capped at 45%
    const baseChance = Math.min(0.45, 0.15 + (turnNumber - 5) * 0.015);
    // Max 2 active threats
    if (this.threats.length >= 2) return newThreats;

    if (rng.randomChance(baseChance)) {
      const types: ThreatType[] = ['raid', 'revolt', 'border-pressure'];
      const typeIdx = rng.randomInt(0, types.length - 1);
      const type = types[typeIdx];
      const threat = this.createThreat(type, turnNumber, rng);
      this.threats.push(threat);
      newThreats.push(threat);
      this.version++;
    }

    return newThreats;
  }

  private createThreat(
    type: ThreatType,
    turnNumber: number,
    rng: SeededRandom
  ): MilitaryThreat {
    // Type-based difficulty multiplier: revolts are hardest
    const typeMultiplier: Record<ThreatType, number> = {
      raid: 1.0,
      revolt: 1.3,
      'border-pressure': 1.1,
    };
    const basePower = Math.max(2, Math.floor(turnNumber / 3));
    const variance = rng.randomInt(0, Math.max(1, Math.floor(basePower / 2)));
    const enemyPower = Math.round(
      (basePower + variance) * typeMultiplier[type]
    );

    const names: Record<ThreatType, string[]> = {
      raid: [
        'Border Raid',
        'Bandit Attack',
        'Nomad Incursion',
        'Frontier Skirmish',
      ],
      revolt: [
        'Peasant Uprising',
        'Tax Revolt',
        'Worker Rebellion',
        'Civil Unrest',
      ],
      'border-pressure': [
        'Border Dispute',
        'Territorial Encroachment',
        'Rival Patrol',
        'Frontier Tension',
      ],
    };
    const counterTasks: Record<ThreatType, MilitaryTaskType> = {
      raid: 'anti-raid',
      revolt: 'suppress-revolt',
      'border-pressure': 'border-defense',
    };

    const namePool = names[type];
    const name = namePool[rng.randomInt(0, namePool.length - 1)];

    return {
      threatId: ++this.threatSerial,
      type,
      name,
      enemyPower,
      turnsLeft: 3,
      counterTask: counterTasks[type],
    };
  }

  /**
   * Resolve all active threats against matching assignments.
   * Called at end-of-turn after training completes.
   * Returns outcome reports.
   */
  resolveThreats(rng: SeededRandom): ThreatOutcome[] {
    const outcomes: ThreatOutcome[] = [];

    for (const threat of this.threats) {
      threat.turnsLeft--;
    }

    // Resolve threats that have matching assignments or have expired
    const remaining: MilitaryThreat[] = [];
    for (const threat of this.threats) {
      const matchingAssignment = this.assignments.find(
        (a) => a.taskType === threat.counterTask
      );

      if (matchingAssignment) {
        // Calculate player power from the assignment
        let playerPower = 0;
        const specialistBonuses: string[] = [];
        const hasIronWeapons = this.isTechUnlocked('mil-iron-weapons');
        const hasFortEngineering = this.isTechUnlocked(
          'mil-fortification-engineering'
        );

        for (const [unitId, count] of Object.entries(
          matchingAssignment.allocatedUnits
        ) as [UnitRole, number][]) {
          if (count <= 0) continue;
          const def = getUnitDefinition(unitId);
          if (!def) continue;
          let unitPower = def.power;
          // Iron Weapons: footmen gain +1 power
          if (hasIronWeapons && unitId === 'footman') {
            unitPower += 1;
          }
          playerPower += unitPower * count;

          // Specialist bonuses
          if (
            unitId === 'spy' &&
            (threat.type === 'raid' || threat.type === 'border-pressure')
          ) {
            specialistBonuses.push('Spy intel: ambush risk reduced');
            playerPower += count; // +1 effective power per spy
          }
          if (unitId === 'engineer' && threat.type === 'border-pressure') {
            specialistBonuses.push('Engineer fortifications: +2 power');
            playerPower += 2 * count;
          }
        }

        // Fortification Engineering: +2 base power for border-defense and anti-raid
        if (
          hasFortEngineering &&
          (threat.counterTask === 'border-defense' ||
            threat.counterTask === 'anti-raid')
        ) {
          specialistBonuses.push('Fortification Engineering: +2 defense power');
          playerPower += 2;
        }

        // Iron Weapons tech bonus logged once
        if (hasIronWeapons) {
          const footmanCount = matchingAssignment.allocatedUnits.footman ?? 0;
          if (footmanCount > 0) {
            specialistBonuses.push(
              `Iron Weapons: +${footmanCount} footman power`
            );
          }
        }

        // Random modifier: ±20%
        const modifier = 0.8 + rng.next() * 0.4;
        const effectivePower = Math.round(playerPower * modifier);
        const victory = effectivePower >= threat.enemyPower;

        // Calculate casualties
        const casualties: Partial<Record<UnitRole, number>> = {};
        if (!victory) {
          // On loss: lose ~30-50% of assigned units
          const lossFraction = 0.3 + rng.next() * 0.2;
          for (const [unitId, count] of Object.entries(
            matchingAssignment.allocatedUnits
          ) as [UnitRole, number][]) {
            if (count <= 0) continue;
            const lost = Math.max(1, Math.round(count * lossFraction));
            casualties[unitId] = lost;
            this.removeFromRoster(unitId, lost, 'assigned');
          }
        } else {
          // On win: lose ~0-20% of assigned units
          const lossFraction = rng.next() * 0.2;
          for (const [unitId, count] of Object.entries(
            matchingAssignment.allocatedUnits
          ) as [UnitRole, number][]) {
            if (count <= 0) continue;
            const lost = Math.round(count * lossFraction);
            if (lost > 0) {
              casualties[unitId] = lost;
              this.removeFromRoster(unitId, lost, 'assigned');
            }
          }
        }

        // Dissolve the assignment after resolution
        // Return surviving units to available
        for (const [unitId, count] of Object.entries(
          matchingAssignment.allocatedUnits
        ) as [UnitRole, number][]) {
          if (count <= 0) continue;
          const lost = casualties[unitId] ?? 0;
          const surviving = count - lost;
          if (surviving > 0) {
            this.removeFromRoster(unitId, surviving, 'assigned');
            this.addToRoster(unitId, surviving, 'available');
          }
        }
        this.assignments = this.assignments.filter(
          (a) => a.assignmentId !== matchingAssignment.assignmentId
        );

        // Resource losses on defeat
        const resourceLosses: Partial<Record<string, number>> = {};
        if (!victory) {
          if (threat.type === 'raid') {
            resourceLosses.gold = rng.randomInt(5, 20);
            resourceLosses.meat = rng.randomInt(3, 10);
          } else if (threat.type === 'revolt') {
            resourceLosses.gold = rng.randomInt(10, 30);
          } else if (threat.type === 'border-pressure') {
            resourceLosses.stone = rng.randomInt(3, 10);
          }
        }

        outcomes.push({
          threatId: threat.threatId,
          threatName: threat.name,
          threatType: threat.type,
          victory,
          playerPower: effectivePower,
          enemyPower: threat.enemyPower,
          casualties,
          resourceLosses,
          specialistBonuses,
        });
      } else if (threat.turnsLeft <= 0) {
        // Threat expired uncontested — automatic defeat
        const resourceLosses: Partial<Record<string, number>> = {};
        if (threat.type === 'raid') {
          resourceLosses.gold = rng.randomInt(10, 30);
          resourceLosses.meat = rng.randomInt(5, 15);
        } else if (threat.type === 'revolt') {
          resourceLosses.gold = rng.randomInt(15, 40);
        } else if (threat.type === 'border-pressure') {
          resourceLosses.stone = rng.randomInt(5, 15);
          resourceLosses.gold = rng.randomInt(5, 15);
        }

        outcomes.push({
          threatId: threat.threatId,
          threatName: threat.name,
          threatType: threat.type,
          victory: false,
          playerPower: 0,
          enemyPower: threat.enemyPower,
          casualties: {},
          resourceLosses,
          specialistBonuses: [],
        });
      } else {
        remaining.push(threat);
      }
    }

    this.threats = remaining;
    this.lastOutcomes = outcomes;
    if (outcomes.length > 0) this.version++;
    return outcomes;
  }

  // ─── Casualties ──────────────────────────────────────────────────

  /**
   * Remove units (e.g. from combat losses). Targets 'assigned' units first,
   * then 'available'. Returns the actual number removed.
   */
  removeUnits(unitId: UnitRole, count: number): number {
    let removed = 0;
    // Remove from assigned first.
    removed += this.removeFromRoster(unitId, count - removed, 'assigned');
    if (removed < count) {
      removed += this.removeFromRoster(unitId, count - removed, 'available');
    }
    if (removed > 0) this.version++;
    return removed;
  }

  // ─── Serialization ──────────────────────────────────────────────

  /** Export state for save. */
  getSaveState(): MilitarySaveState {
    return {
      roster: this.roster.map((s) => ({ ...s })),
      trainingQueue: this.trainingQueue.map((o) => ({ ...o })),
      assignments: this.assignments.map((a) => ({
        ...a,
        allocatedUnits: { ...a.allocatedUnits },
      })),
      threats: this.threats.map((t) => ({ ...t })),
      lastOutcomes: this.lastOutcomes.map((o) => ({
        ...o,
        casualties: { ...o.casualties },
        resourceLosses: { ...o.resourceLosses },
      })),
      orderSerial: this.orderSerial,
      assignmentSerial: this.assignmentSerial,
      threatSerial: this.threatSerial,
      version: this.version,
    };
  }

  // ─── Internal helpers ────────────────────────────────────────────

  private addToRoster(
    unitId: UnitRole,
    count: number,
    readiness: UnitReadiness
  ): void {
    const existing = this.roster.find(
      (s) => s.unitId === unitId && s.readiness === readiness
    );
    if (existing) {
      existing.count += count;
    } else {
      this.roster.push({ unitId, count, readiness });
    }
  }

  private removeFromRoster(
    unitId: UnitRole,
    count: number,
    readiness: UnitReadiness
  ): number {
    const existing = this.roster.find(
      (s) => s.unitId === unitId && s.readiness === readiness
    );
    if (!existing || existing.count <= 0) return 0;
    const removed = Math.min(existing.count, count);
    existing.count -= removed;
    if (existing.count <= 0) {
      this.roster = this.roster.filter((s) => s.count > 0);
    }
    return removed;
  }
}
