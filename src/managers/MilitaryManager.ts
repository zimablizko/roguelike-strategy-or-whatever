import { clamp } from '../_common/math';
import type {
  BattleAttackQueueItem,
  BattleResult,
  PendingBattleAction,
  BattleSideState,
  BattleState,
  BattleTurnSummary,
  BattleUnitState,
  MilitaryAssignment,
  MilitaryManagerOptions,
  MilitarySaveState,
  MilitarySnapshot,
  MilitaryTaskType,
  MilitaryThreat,
  StartBattleOptions,
  ThreatOutcome,
  ThreatType,
  TrainingOrder,
  UnitReadiness,
  UnitRole,
  UnitStack,
} from '../_common/models/military.models';
import type { ResourceCost } from '../_common/models/resource.models';
import type { SeededRandom } from '../_common/random';
import {
  getBattleCommandDefinition,
  getBattleStatusDefinition,
  getUnitBattleCommands,
  getUnitDefinition,
} from '../data/military';

type UnitCountMap = Partial<Record<UnitRole, number>>;
type BattleSnapshotEntry = {
  unitId: UnitRole;
  alive: number;
  killed: number;
  routed: number;
};
type BattleSnapshot = Record<string, BattleSnapshotEntry>;

/**
 * Single source of truth for all military state:
 * roster, training queue, assignments, threats, and tactical battles.
 */
export class MilitaryManager {
  private roster: UnitStack[] = [];
  private trainingQueue: TrainingOrder[] = [];
  private assignments: MilitaryAssignment[] = [];
  private threats: MilitaryThreat[] = [];
  private lastOutcomes: ThreatOutcome[] = [];
  private activeBattle?: BattleState;
  private lastBattleResult?: BattleResult;
  private orderSerial = 0;
  private assignmentSerial = 0;
  private threatSerial = 0;
  private battleSerial = 0;
  private version = 0;

  private readonly getBarracksCapacity: () => number;
  private readonly getGarrisonCapacity: () => number;
  private readonly isTechUnlocked: (techId: string) => boolean;
  private readonly grantResources: (resources: ResourceCost) => void;

  constructor(options: MilitaryManagerOptions) {
    this.getBarracksCapacity = options.getBarracksCapacity;
    this.getGarrisonCapacity = options.getGarrisonCapacity;
    this.isTechUnlocked = options.isTechnologyUnlocked;
    this.grantResources = options.grantResources ?? (() => {});

    if (options.initial) {
      this.roster = options.initial.roster.map((stack) => ({
        ...stack,
        readiness: 'available',
      }));
      this.trainingQueue = [];
      this.assignments = [];
      this.threats = [];
      this.lastOutcomes = [];
      this.activeBattle = options.initial.activeBattle
        ? this.cloneBattleState(options.initial.activeBattle)
        : undefined;
      this.lastBattleResult = options.initial.lastBattleResult
        ? this.cloneBattleResult(options.initial.lastBattleResult)
        : undefined;
      this.orderSerial = options.initial.orderSerial;
      this.assignmentSerial = options.initial.assignmentSerial;
      this.threatSerial = options.initial.threatSerial ?? 0;
      this.battleSerial = options.initial.battleSerial ?? 0;
      this.version = options.initial.version;
    }
  }

  // ─── Version tracking ────────────────────────────────────────────

  getMilitaryVersion(): number {
    return this.version;
  }

  // ─── Roster queries ──────────────────────────────────────────────

  getRoster(): readonly Readonly<UnitStack>[] {
    return this.roster;
  }

  getUnitCount(unitId: UnitRole, readiness?: UnitReadiness): number {
    let total = 0;
    for (const stack of this.roster) {
      if (stack.unitId !== unitId) continue;
      if (readiness !== undefined && stack.readiness !== readiness) continue;
      total += stack.count;
    }
    return total;
  }

  getTotalUnits(readiness?: UnitReadiness): number {
    let total = 0;
    for (const stack of this.roster) {
      if (readiness !== undefined && stack.readiness !== readiness) continue;
      total += stack.count;
    }
    return total;
  }

  getPopulationUsage(): number {
    return Object.values(this.getSnapshot().composition).reduce(
      (sum, count) => sum + (count ?? 0),
      0
    );
  }

  addUnits(
    unitId: UnitRole,
    count: number,
    readiness: UnitReadiness = 'available'
  ): void {
    if (count <= 0) return;
    this.addToRoster(unitId, count, readiness);
    this.version++;
  }

  // ─── Training ────────────────────────────────────────────────────

  getTrainingQueue(): readonly Readonly<TrainingOrder>[] {
    return this.trainingQueue;
  }

  getTrainingSlotUsage(): number {
    let total = 0;
    for (const order of this.trainingQueue) {
      total += order.count;
    }
    return total;
  }

  getTrainingCapacity(): number {
    return this.getBarracksCapacity();
  }

  getAvailableTrainingSlots(): number {
    return Math.max(0, this.getTrainingCapacity() - this.getTrainingSlotUsage());
  }

  getMaxGarrison(): number {
    const base = this.getGarrisonCapacity();
    return this.isTechUnlocked('mil-standing-army') ? base * 2 : base;
  }

  getGarrisonUsage(): number {
    let count = 0;
    for (const stack of this.roster) {
      if (stack.readiness !== 'training') {
        count += stack.count;
      }
    }
    return count;
  }

  getAvailableGarrisonSlots(): number {
    return Math.max(0, this.getMaxGarrison() - this.getGarrisonUsage());
  }

  getTrainingCost(unitId: UnitRole, count: number): ResourceCost | undefined {
    const def = getUnitDefinition(unitId);
    if (!def) return undefined;
    const cost: ResourceCost = {};
    for (const [res, amount] of Object.entries(def.trainingCost)) {
      (cost as Record<string, number>)[res] = (amount as number) * count;
    }
    return cost;
  }

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
    this.addToRoster(unitId, count, 'training');
    this.version++;
    return order;
  }

  advanceTraining(): Array<{ unitId: UnitRole; count: number }> {
    const completed: Array<{ unitId: UnitRole; count: number }> = [];
    const remaining: TrainingOrder[] = [];

    for (const order of this.trainingQueue) {
      order.turnsLeft--;
      if (order.turnsLeft <= 0) {
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

  getAssignments(): readonly Readonly<MilitaryAssignment>[] {
    return this.assignments;
  }

  createAssignment(
    taskType: MilitaryTaskType,
    allocatedUnits: Partial<Record<UnitRole, number>>,
    target?: string,
    risk: MilitaryAssignment['risk'] = 'unknown'
  ): MilitaryAssignment | undefined {
    for (const [unitId, count] of Object.entries(allocatedUnits) as [
      UnitRole,
      number | undefined,
    ][]) {
      const amount = count ?? 0;
      if (amount <= 0) continue;
      if (this.getUnitCount(unitId, 'available') < amount) {
        return undefined;
      }
    }

    for (const [unitId, count] of Object.entries(allocatedUnits) as [
      UnitRole,
      number | undefined,
    ][]) {
      const amount = count ?? 0;
      if (amount <= 0) continue;
      this.removeFromRoster(unitId, amount, 'available');
      this.addToRoster(unitId, amount, 'assigned');
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

  removeAssignment(assignmentId: number): boolean {
    const idx = this.assignments.findIndex(
      (a) => a.assignmentId === assignmentId
    );
    if (idx === -1) return false;
    const assignment = this.assignments[idx];
    for (const [unitId, count] of Object.entries(assignment.allocatedUnits) as [
      UnitRole,
      number | undefined,
    ][]) {
      const amount = count ?? 0;
      if (amount <= 0) continue;
      this.removeFromRoster(unitId, amount, 'assigned');
      this.addToRoster(unitId, amount, 'available');
    }
    this.assignments.splice(idx, 1);
    this.version++;
    return true;
  }

  // ─── Upkeep ──────────────────────────────────────────────────────

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

  getSnapshot(): MilitarySnapshot {
    const composition: Partial<Record<UnitRole, number>> = {};
    let totalPower = 0;
    let availableCount = 0;
    let assignedCount = 0;
    let trainingCount = 0;
    const hasIronWeapons = this.isTechUnlocked('mil-iron-weapons');

    for (const stack of this.roster) {
      composition[stack.unitId] = (composition[stack.unitId] ?? 0) + stack.count;

      const def = getUnitDefinition(stack.unitId);
      let unitPower = def ? def.power : 0;
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

    if (this.activeBattle?.player.usesRoster) {
      for (const [unitId, count] of Object.entries(
        this.activeBattle.player.reserveUnits
      ) as [UnitRole, number | undefined][]) {
        const amount = count ?? 0;
        if (amount <= 0) continue;
        composition[unitId] = (composition[unitId] ?? 0) + amount;
        availableCount += amount;
        const def = getUnitDefinition(unitId);
        if (!def) continue;
        let unitPower = def.power;
        if (hasIronWeapons && unitId === 'footman') {
          unitPower += 1;
        }
        totalPower += unitPower * amount;
      }
      for (const unit of this.activeBattle.player.units) {
        const alive = this.getBattleUnitAliveCount(unit);
        if (alive <= 0) continue;
        composition[unit.unitId] = (composition[unit.unitId] ?? 0) + alive;
        availableCount += alive;
        const def = getUnitDefinition(unit.unitId);
        if (!def) continue;
        let unitPower = def.power;
        if (hasIronWeapons && unit.unitId === 'footman') {
          unitPower += 1;
        }
        totalPower += unitPower * alive;
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

  // ─── Tactical Battles ────────────────────────────────────────────

  getActiveBattle(): Readonly<BattleState> | undefined {
    return this.activeBattle;
  }

  getLastBattleResult(): Readonly<BattleResult> | undefined {
    return this.lastBattleResult;
  }

  clearLastBattleResult(): void {
    if (!this.lastBattleResult) return;
    this.lastBattleResult = undefined;
    this.version++;
  }

  startBattle(options: StartBattleOptions): BattleState | undefined {
    if (this.activeBattle) {
      return undefined;
    }

    const playerOptions = options.player ?? {};
    const reserveFromRoster =
      playerOptions.reserveFromRoster ?? playerOptions.units === undefined;
    const playerUnits =
      playerOptions.units ?? this.collectAvailableRosterUnits();
    const enemyUnits = options.enemy.units;

    if (!this.hasAnyUnits(playerUnits) || !this.hasAnyUnits(enemyUnits)) {
      return undefined;
    }

    if (reserveFromRoster) {
      for (const [unitId, count] of Object.entries(playerUnits) as [
        UnitRole,
        number | undefined,
      ][]) {
        const amount = count ?? 0;
        if (amount <= 0) continue;
        if (this.getUnitCount(unitId, 'available') < amount) {
          return undefined;
        }
      }
      for (const [unitId, count] of Object.entries(playerUnits) as [
        UnitRole,
        number | undefined,
      ][]) {
        const amount = count ?? 0;
        if (amount <= 0) continue;
        this.removeFromRoster(unitId, amount, 'available');
      }
    }

    this.lastBattleResult = undefined;
      this.activeBattle = {
        battleId: ++this.battleSerial,
        name: options.name,
        phase: 'preparation',
        turnNumber: 0,
        roundNumber: 0,
        rewardMultiplier: Math.max(0, options.rewardMultiplier ?? 1),
        attackQueue: [],
        pendingWinner: undefined,
        pendingRoundNotes: [],
        battleLog: [],
        player: this.buildBattleSide(
        playerOptions.label ?? 'Player',
        clamp(playerOptions.morale ?? 65, 0, 100),
        reserveFromRoster,
        playerUnits,
        'player',
        3,
        true
      ),
      enemy: this.buildBattleSide(
        options.enemy.label ?? 'Enemy',
        clamp(options.enemy.morale ?? 58, 0, 100),
        false,
        enemyUnits,
        'enemy',
        99,
        false
      ),
    };
    this.version++;
    return this.activeBattle;
  }

  createBattleGroup(unitId: UnitRole): boolean {
    const battle = this.activeBattle;
    if (!battle || battle.phase !== 'preparation') return false;
    const player = battle.player;
    if (player.units.length >= player.maxGroups) return false;
    const available = player.reserveUnits[unitId] ?? 0;
    if (available <= 0) return false;
    const def = getUnitDefinition(unitId);
    if (!def) return false;

    player.reserveUnits[unitId] = available - 1;
    player.units.push({
      battleUnitId: `player-${unitId}-${++this.battleSerial}`,
      unitId,
      initialQuantity: 1,
      remainingHealth: def.health,
      killedCount: 0,
      routedCount: 0,
      selectedCommandId: undefined,
      activeStatuses: [],
    });
    this.version++;
    return true;
  }

  adjustBattleGroupSize(battleUnitId: string, delta: number): boolean {
    const battle = this.activeBattle;
    if (!battle || battle.phase !== 'preparation' || delta === 0) return false;
    const group = battle.player.units.find((unit) => unit.battleUnitId === battleUnitId);
    if (!group) return false;
    const def = getUnitDefinition(group.unitId);
    if (!def) return false;

    const quantity = this.getBattleUnitAliveCount(group);
    if (delta > 0) {
      const reserve = battle.player.reserveUnits[group.unitId] ?? 0;
      if (reserve < delta) return false;
      battle.player.reserveUnits[group.unitId] = reserve - delta;
      group.initialQuantity += delta;
      group.remainingHealth += def.health * delta;
    } else {
      const removeCount = Math.abs(delta);
      if (quantity - removeCount < 1) return false;
      battle.player.reserveUnits[group.unitId] =
        (battle.player.reserveUnits[group.unitId] ?? 0) + removeCount;
      group.initialQuantity -= removeCount;
      group.remainingHealth = Math.max(
        def.health,
        group.remainingHealth - def.health * removeCount
      );
    }
    this.version++;
    return true;
  }

  removeBattleGroup(battleUnitId: string): boolean {
    const battle = this.activeBattle;
    if (!battle || battle.phase !== 'preparation') return false;
    const idx = battle.player.units.findIndex((unit) => unit.battleUnitId === battleUnitId);
    if (idx === -1) return false;
    const group = battle.player.units[idx];
    const quantity = this.getBattleUnitAliveCount(group);
    battle.player.reserveUnits[group.unitId] =
      (battle.player.reserveUnits[group.unitId] ?? 0) + quantity;
    battle.player.units.splice(idx, 1);
    this.version++;
    return true;
  }

  startPreparedBattle(): boolean {
    const battle = this.activeBattle;
    if (!battle || battle.phase !== 'preparation') return false;
    if (battle.player.units.length === 0) return false;
    battle.phase = 'battle';
    battle.attackQueue = [];
    battle.pendingWinner = undefined;
    battle.pendingAction = undefined;
    battle.pendingRoundNotes = [];
    battle.roundNumber = 0;
    battle.battleLog = [
      `${battle.name} begins.`,
      'Formations locked. Press Fight to resolve the round.',
    ];
    this.version++;
    return true;
  }

  prepareNextBattleAction(rng: SeededRandom): PendingBattleAction | undefined {
    const battle = this.activeBattle;
    if (!battle || battle.phase !== 'battle') return undefined;
    if (battle.pendingWinner) return undefined;
    if (battle.pendingAction) return battle.pendingAction;

    if (battle.attackQueue.length === 0) {
      battle.pendingRoundNotes = [];
      this.startNewBattleRound(battle, rng, battle.pendingRoundNotes);
      if (battle.attackQueue.length === 0) {
        this.version++;
        return undefined;
      }
    }

    while (battle.attackQueue.length > 0) {
      const next = battle.attackQueue.shift()!;
      const attackerSide = next.side === 'player' ? battle.player : battle.enemy;
      const defenderSide = next.side === 'player' ? battle.enemy : battle.player;
      const attacker = attackerSide.units.find(
        (unit) => unit.battleUnitId === next.battleUnitId
      );
      if (!attacker || this.getBattleUnitAliveCount(attacker) <= 0) {
        continue;
      }
      const preview = this.buildPendingBattleAction(
        battle,
        next.side,
        attacker,
        defenderSide,
        rng
      );
      if (!preview) {
        continue;
      }
      battle.pendingAction = preview;
      this.version++;
      return preview;
    }

    const winner = this.getBattleWinner(battle);
    if (winner) {
      battle.pendingWinner = winner;
      this.version++;
    }
    return undefined;
  }

  finalizePendingBattle(): boolean {
    const battle = this.activeBattle;
    if (!battle || !battle.pendingWinner) {
      return false;
    }
    this.finishBattle(battle, battle.pendingWinner);
    this.version++;
    return true;
  }

  issueBattleCommand(
    battleUnitId: string,
    commandId: string | undefined
  ): boolean {
    const battle = this.activeBattle;
    if (!battle) return false;
    const unit = battle.player.units.find((entry) => entry.battleUnitId === battleUnitId);
    if (!unit) return false;

    if (!commandId) {
      if (unit.selectedCommandId === undefined) return false;
      unit.selectedCommandId = undefined;
      this.version++;
      return true;
    }

    const valid = getUnitBattleCommands(unit.unitId).some(
      (command) => command.id === commandId
    );
    if (!valid) return false;

    unit.selectedCommandId = commandId as BattleUnitState['selectedCommandId'];
    this.version++;
    return true;
  }

  resolveBattleTurn(rng: SeededRandom): BattleTurnSummary | undefined {
    if (!this.prepareNextBattleAction(rng)) {
      return undefined;
    }
    return this.commitPreparedBattleAction();
  }

  // ─── Threats ─────────────────────────────────────────────────────

  getThreats(): readonly Readonly<MilitaryThreat>[] {
    return this.threats;
  }

  getLastOutcomes(): readonly Readonly<ThreatOutcome>[] {
    return this.lastOutcomes;
  }

  clearLastOutcomes(): void {
    this.lastOutcomes = [];
  }

  generateThreats(turnNumber: number, rng: SeededRandom): MilitaryThreat[] {
    const newThreats: MilitaryThreat[] = [];
    if (turnNumber < 5) return newThreats;
    const baseChance = Math.min(0.45, 0.15 + (turnNumber - 5) * 0.015);
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

  resolveThreats(rng: SeededRandom): ThreatOutcome[] {
    const outcomes: ThreatOutcome[] = [];

    for (const threat of this.threats) {
      threat.turnsLeft--;
    }

    const remaining: MilitaryThreat[] = [];
    for (const threat of this.threats) {
      const matchingAssignment = this.assignments.find(
        (a) => a.taskType === threat.counterTask
      );

      if (matchingAssignment) {
        let playerPower = 0;
        const specialistBonuses: string[] = [];
        const hasIronWeapons = this.isTechUnlocked('mil-iron-weapons');
        const hasFortEngineering = this.isTechUnlocked(
          'mil-fortification-engineering'
        );

        for (const [unitId, count] of Object.entries(
          matchingAssignment.allocatedUnits
        ) as [UnitRole, number | undefined][]) {
          const amount = count ?? 0;
          if (amount <= 0) continue;
          const def = getUnitDefinition(unitId);
          if (!def) continue;
          let unitPower = def.power;
          if (hasIronWeapons && unitId === 'footman') {
            unitPower += 1;
          }
          playerPower += unitPower * amount;

          if (
            unitId === 'spy' &&
            (threat.type === 'raid' || threat.type === 'border-pressure')
          ) {
            specialistBonuses.push('Spy intel: ambush risk reduced');
            playerPower += amount;
          }
          if (unitId === 'engineer' && threat.type === 'border-pressure') {
            specialistBonuses.push('Engineer fortifications: +2 power');
            playerPower += 2 * amount;
          }
        }

        if (
          hasFortEngineering &&
          (threat.counterTask === 'border-defense' ||
            threat.counterTask === 'anti-raid')
        ) {
          specialistBonuses.push('Fortification Engineering: +2 defense power');
          playerPower += 2;
        }

        if (hasIronWeapons) {
          const footmanCount = matchingAssignment.allocatedUnits.footman ?? 0;
          if (footmanCount > 0) {
            specialistBonuses.push(`Iron Weapons: +${footmanCount} footman power`);
          }
        }

        const modifier = 0.8 + rng.next() * 0.4;
        const effectivePower = Math.round(playerPower * modifier);
        const victory = effectivePower >= threat.enemyPower;

        const casualties: Partial<Record<UnitRole, number>> = {};
        if (!victory) {
          const lossFraction = 0.3 + rng.next() * 0.2;
          for (const [unitId, count] of Object.entries(
            matchingAssignment.allocatedUnits
          ) as [UnitRole, number | undefined][]) {
            const amount = count ?? 0;
            if (amount <= 0) continue;
            const lost = Math.max(1, Math.round(amount * lossFraction));
            casualties[unitId] = lost;
            this.removeFromRoster(unitId, lost, 'assigned');
          }
        } else {
          const lossFraction = rng.next() * 0.2;
          for (const [unitId, count] of Object.entries(
            matchingAssignment.allocatedUnits
          ) as [UnitRole, number | undefined][]) {
            const amount = count ?? 0;
            if (amount <= 0) continue;
            const lost = Math.round(amount * lossFraction);
            if (lost > 0) {
              casualties[unitId] = lost;
              this.removeFromRoster(unitId, lost, 'assigned');
            }
          }
        }

        for (const [unitId, count] of Object.entries(
          matchingAssignment.allocatedUnits
        ) as [UnitRole, number | undefined][]) {
          const amount = count ?? 0;
          if (amount <= 0) continue;
          const lost = casualties[unitId] ?? 0;
          const surviving = amount - lost;
          if (surviving > 0) {
            this.removeFromRoster(unitId, surviving, 'assigned');
            this.addToRoster(unitId, surviving, 'available');
          }
        }
        this.assignments = this.assignments.filter(
          (a) => a.assignmentId !== matchingAssignment.assignmentId
        );

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

  removeUnits(unitId: UnitRole, count: number): number {
    let removed = 0;
    removed += this.removeFromRoster(unitId, count - removed, 'assigned');
    if (removed < count) {
      removed += this.removeFromRoster(unitId, count - removed, 'available');
    }
    if (removed > 0) this.version++;
    return removed;
  }

  // ─── Serialization ──────────────────────────────────────────────

  getSaveState(): MilitarySaveState {
    return {
      roster: this.roster.map((s) => ({ ...s })),
      trainingQueue: [],
      assignments: [],
      threats: [],
      lastOutcomes: [],
      activeBattle: this.activeBattle
        ? this.cloneBattleState(this.activeBattle)
        : undefined,
      lastBattleResult: this.lastBattleResult
        ? this.cloneBattleResult(this.lastBattleResult)
        : undefined,
      orderSerial: this.orderSerial,
      assignmentSerial: this.assignmentSerial,
      threatSerial: this.threatSerial,
      battleSerial: this.battleSerial,
      version: this.version,
    };
  }

  // ─── Threat helpers ──────────────────────────────────────────────

  private createThreat(
    type: ThreatType,
    turnNumber: number,
    rng: SeededRandom
  ): MilitaryThreat {
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

  // ─── Battle helpers ──────────────────────────────────────────────

  private collectAvailableRosterUnits(): UnitCountMap {
    const units: UnitCountMap = {};
    for (const stack of this.roster) {
      if (stack.readiness !== 'available' || stack.count <= 0) continue;
      units[stack.unitId] = (units[stack.unitId] ?? 0) + stack.count;
    }
    return units;
  }

  private hasAnyUnits(units: UnitCountMap): boolean {
    return Object.values(units).some((count) => (count ?? 0) > 0);
  }

  private buildBattleSide(
    label: string,
    morale: number,
    usesRoster: boolean,
    units: UnitCountMap,
    sidePrefix: 'player' | 'enemy',
    maxGroups: number,
    editable: boolean
  ): BattleSideState {
    const reserveUnits: UnitCountMap = {};
    for (const [unitId, count] of Object.entries(units) as [
      UnitRole,
      number | undefined,
    ][]) {
      const amount = Math.max(0, Math.floor(count ?? 0));
      if (amount > 0) {
        reserveUnits[unitId] = amount;
      }
    }

    const side: BattleSideState = {
      label,
      morale,
      startingMorale: morale,
      usesRoster,
      reserveUnits,
      maxGroups,
      units: [],
    };

    if (editable) {
      const defaultTypes = Object.entries(reserveUnits)
        .filter(([, count]) => (count ?? 0) > 0)
        .slice(0, maxGroups) as Array<[UnitRole, number]>;
      for (const [unitId] of defaultTypes) {
        const amount = reserveUnits[unitId] ?? 0;
        if (amount <= 0) continue;
        side.units.push(
          this.createBattleUnit(sidePrefix, unitId, amount, side.units.length + 1)
        );
        side.reserveUnits[unitId] = 0;
      }
      return side;
    }

    for (const [unitId, count] of Object.entries(reserveUnits) as [
      UnitRole,
      number | undefined,
    ][]) {
      const amount = count ?? 0;
      if (amount <= 0) continue;
      side.units.push(
        this.createBattleUnit(sidePrefix, unitId, amount, side.units.length + 1)
      );
      side.reserveUnits[unitId] = 0;
    }

    return side;
  }

  private createBattleUnit(
    sidePrefix: 'player' | 'enemy',
    unitId: UnitRole,
    amount: number,
    serial: number
  ): BattleUnitState {
    const def = getUnitDefinition(unitId)!;
    return {
      battleUnitId: `${sidePrefix}-${unitId}-${serial}-${this.battleSerial}`,
      unitId,
      initialQuantity: amount,
      remainingHealth: def.health * amount,
      killedCount: 0,
      routedCount: 0,
      selectedCommandId: undefined,
      activeStatuses: [],
    };
  }

  private ageStatuses(side: BattleSideState): void {
    for (const unit of side.units) {
      unit.activeStatuses = unit.activeStatuses
        .map((status) => ({
          ...status,
          turnsLeft: status.turnsLeft - 1,
        }))
        .filter((status) => status.turnsLeft > 0);
    }
  }

  private startNewBattleRound(
    battle: BattleState,
    rng: SeededRandom,
    roundNotes: string[]
  ): void {
    battle.roundNumber++;
    this.ageStatuses(battle.player);
    this.ageStatuses(battle.enemy);
    const spentPlayerActions = this.applyCommands(
      battle.player,
      battle.enemy,
      rng,
      true,
      roundNotes
    );
    const spentEnemyActions = this.applyCommands(
      battle.enemy,
      battle.player,
      rng,
      false,
      roundNotes
    );
    this.applyMoraleRouts(battle.player, rng, roundNotes);
    this.applyMoraleRouts(battle.enemy, rng, roundNotes);
    battle.attackQueue = this.buildAttackQueue(
      battle,
      new Set([...spentPlayerActions, ...spentEnemyActions])
    );
    const opener = battle.attackQueue[0]?.side === 'player'
      ? battle.player.label
      : battle.attackQueue[0]?.side === 'enemy'
        ? battle.enemy.label
        : 'No one';
    battle.battleLog.push(
      battle.attackQueue.length > 0
        ? `Round ${battle.roundNumber}: ${opener} act first.`
        : `Round ${battle.roundNumber}: orders only, no attacks.`
    );
    if (roundNotes.length > 0) {
      battle.battleLog.push(`Events: ${roundNotes.join(' | ')}`);
    }
    battle.battleLog = battle.battleLog.slice(-40);
  }

  private buildAttackQueue(
    battle: BattleState,
    spentActions: ReadonlySet<string>
  ): BattleAttackQueueItem[] {
    const playerAlive = battle.player.units.filter(
      (unit) =>
        this.getBattleUnitAliveCount(unit) > 0 &&
        !spentActions.has(unit.battleUnitId)
    );
    const enemyAlive = battle.enemy.units.filter(
      (unit) =>
        this.getBattleUnitAliveCount(unit) > 0 &&
        !spentActions.has(unit.battleUnitId)
    );
    const startsWithPlayer = battle.player.morale >= battle.enemy.morale;
    const maxLen = Math.max(playerAlive.length, enemyAlive.length);
    const queue: BattleAttackQueueItem[] = [];

    for (let i = 0; i < maxLen; i++) {
      if (startsWithPlayer) {
        if (playerAlive[i]) {
          queue.push({
            side: 'player',
            battleUnitId: playerAlive[i].battleUnitId,
          });
        }
        if (enemyAlive[i]) {
          queue.push({
            side: 'enemy',
            battleUnitId: enemyAlive[i].battleUnitId,
          });
        }
      } else {
        if (enemyAlive[i]) {
          queue.push({
            side: 'enemy',
            battleUnitId: enemyAlive[i].battleUnitId,
          });
        }
        if (playerAlive[i]) {
          queue.push({
            side: 'player',
            battleUnitId: playerAlive[i].battleUnitId,
          });
        }
      }
    }

    return queue;
  }

  private buildPendingBattleAction(
    battle: BattleState,
    attackerSideKey: 'player' | 'enemy',
    attacker: BattleUnitState,
    defenderSide: BattleSideState,
    rng: SeededRandom
  ): PendingBattleAction | undefined {
    const defender = this.chooseRandomTarget(defenderSide, rng);
    if (!defender) return undefined;

    const attackerSide =
      attackerSideKey === 'player' ? battle.player : battle.enemy;
    const attackerDef = getUnitDefinition(attacker.unitId);
    const defenderDef = getUnitDefinition(defender.unitId);
    if (!attackerDef || !defenderDef) return undefined;

    const attackType =
      attackerDef.attackType === 'ranged' ? 'ranged' : 'melee';
    const damage = this.getAttackPower(attacker, attackerSide.morale, attackType, rng);
    const counterDamage =
      attackerDef.attackType !== 'ranged' && defenderDef.attackType !== 'ranged'
        ? this.getAttackPower(defender, defenderSide.morale, 'melee', rng) * 0.1
        : 0;

    return {
      attackerSide: attackerSideKey,
      attackerUnitId: attacker.battleUnitId,
      defenderSide: attackerSideKey === 'player' ? 'enemy' : 'player',
      defenderUnitId: defender.battleUnitId,
      attackType: attackerDef.attackType,
      attackerLabel: this.getUnitLabel(attacker.unitId),
      defenderLabel: this.getUnitLabel(defender.unitId),
      damage,
      counterDamage,
      roundNumber: battle.roundNumber,
    };
  }

  commitPreparedBattleAction(): BattleTurnSummary | undefined {
    const battle = this.activeBattle;
    if (!battle || battle.phase !== 'battle' || !battle.pendingAction) {
      return undefined;
    }

    const action = battle.pendingAction;
    const attackerSide =
      action.attackerSide === 'player' ? battle.player : battle.enemy;
    const defenderSide =
      action.defenderSide === 'player' ? battle.player : battle.enemy;
    const attacker = attackerSide.units.find(
      (unit) => unit.battleUnitId === action.attackerUnitId
    );
    const defender = defenderSide.units.find(
      (unit) => unit.battleUnitId === action.defenderUnitId
    );
    if (!attacker || !defender) {
      battle.pendingAction = undefined;
      this.version++;
      return undefined;
    }

    battle.turnNumber++;
    const playerBefore = this.captureBattleSnapshot(battle.player);
    const enemyBefore = this.captureBattleSnapshot(battle.enemy);
    const commandResults = [...battle.pendingRoundNotes];
    const highlights: string[] = [];
    battle.pendingRoundNotes = [];

    const dealtDamage = this.applyDamageToBattleUnit(
      defender,
      action.damage,
      action.attackType === 'ranged'
    );
    let returnDamage = 0;
    if (action.counterDamage > 0) {
      returnDamage = this.applyDamageToBattleUnit(attacker, action.counterDamage, false);
    }

    const playerAfter = this.captureBattleSnapshot(battle.player);
    const enemyAfter = this.captureBattleSnapshot(battle.enemy);
    const playerCasualties = this.diffBattleSnapshot(
      battle.player,
      playerBefore,
      playerAfter,
      'killed'
    );
    const enemyCasualties = this.diffBattleSnapshot(
      battle.enemy,
      enemyBefore,
      enemyAfter,
      'killed'
    );
    const playerRouted = this.diffBattleSnapshot(
      battle.player,
      playerBefore,
      playerAfter,
      'routed'
    );
    const enemyRouted = this.diffBattleSnapshot(
      battle.enemy,
      enemyBefore,
      enemyAfter,
      'routed'
    );
    const attackerLosses = this.sumUnitCounts(
      action.attackerSide === 'player' ? playerCasualties : enemyCasualties
    );
    const defenderLosses = this.sumUnitCounts(
      action.defenderSide === 'player' ? playerCasualties : enemyCasualties
    );

    this.adjustBattleMorale(
      battle.player,
      action.attackerSide === 'player' ? defenderLosses : attackerLosses,
      action.attackerSide === 'player' ? attackerLosses : defenderLosses,
      action.attackerSide === 'player' ? dealtDamage : returnDamage,
      action.attackerSide === 'player' ? returnDamage : dealtDamage
    );
    this.adjustBattleMorale(
      battle.enemy,
      action.attackerSide === 'enemy' ? defenderLosses : attackerLosses,
      action.attackerSide === 'enemy' ? attackerLosses : defenderLosses,
      action.attackerSide === 'enemy' ? dealtDamage : returnDamage,
      action.attackerSide === 'enemy' ? returnDamage : dealtDamage
    );

    const clashLog =
      action.counterDamage > 0
        ? `T${battle.turnNumber} ${action.attackerLabel} -> ${action.defenderLabel}: ${Math.round(
            dealtDamage
          )} dmg, ${defenderLosses} losses. Return ${Math.round(returnDamage)} dmg, ${attackerLosses} losses.`
        : `T${battle.turnNumber} ${action.attackerLabel} -> ${action.defenderLabel}: ${Math.round(
            dealtDamage
          )} dmg, ${defenderLosses} losses.`;
    highlights.push(clashLog);

    const summary: BattleTurnSummary = {
      turnNumber: battle.turnNumber,
      roundNumber: battle.roundNumber,
      playerDamage:
        action.attackerSide === 'player'
          ? Math.round(dealtDamage)
          : Math.round(returnDamage),
      enemyDamage:
        action.attackerSide === 'enemy'
          ? Math.round(dealtDamage)
          : Math.round(returnDamage),
      playerMorale: battle.player.morale,
      enemyMorale: battle.enemy.morale,
      playerCasualties,
      enemyCasualties,
      playerRouted,
      enemyRouted,
      action,
      commandResults,
      highlights,
    };

    battle.pendingAction = undefined;
    battle.lastTurnSummary = summary;
    battle.battleLog.push(clashLog);
    battle.battleLog = battle.battleLog.slice(-40);

    const winner = this.getBattleWinner(battle);
    if (winner) {
      battle.pendingWinner = winner;
    }

    this.version++;
    return summary;
  }

  private applyCommands(
    side: BattleSideState,
    enemy: BattleSideState,
    rng: SeededRandom,
    isPlayerSide: boolean,
    commandResults: string[]
  ): Set<string> {
    const spentActions = new Set<string>();
    for (const unit of side.units) {
      if (this.getBattleUnitAliveCount(unit) <= 0) continue;

      const chosenCommandId = isPlayerSide
        ? unit.selectedCommandId
        : this.pickEnemyCommand(unit, side.morale, rng);
      if (!chosenCommandId) continue;

      const command = getBattleCommandDefinition(chosenCommandId);
      if (!command) continue;

      const obeyChance = isPlayerSide
        ? clamp(side.morale / 100 + 0.25 - command.disciplineDifficulty, 0.2, 0.95)
        : clamp(side.morale / 100 + 0.15, 0.35, 0.9);

      if (rng.next() > obeyChance) {
        if (isPlayerSide) {
          commandResults.push(
            `${this.getUnitLabel(unit.unitId)} ignore ${command.name}.`
          );
        }
        continue;
      }

      unit.activeStatuses = unit.activeStatuses.filter(
        (status) => status.statusId !== command.statusId
      );
      unit.activeStatuses.push({
        statusId: command.statusId,
        sourceCommandId: command.id,
        turnsLeft: 1,
      });

      if (command.statusId === 'disrupting') {
        enemy.morale = clamp(enemy.morale - 3, 0, 100);
      }

      spentActions.add(unit.battleUnitId);

      if (isPlayerSide) {
        commandResults.push(
          `${this.getUnitLabel(unit.unitId)} use ${command.name}.`
        );
      }
    }
    return spentActions;
  }

  private pickEnemyCommand(
    unit: BattleUnitState,
    morale: number,
    rng: SeededRandom
  ): BattleUnitState['selectedCommandId'] {
    const commands = getUnitBattleCommands(unit.unitId);
    if (commands.length === 0) return undefined;
    if (unit.unitId === 'footman' && morale < 65 && rng.next() < 0.55) {
      return 'shield-up';
    }
    if (unit.unitId === 'militia' && morale > 45 && rng.next() < 0.45) {
      return 'press-forward';
    }
    if (unit.unitId === 'archer' && rng.next() < 0.5) {
      return 'volley';
    }
    if (unit.unitId === 'spy' && rng.next() < 0.55) {
      return 'sow-panic';
    }
    if (unit.unitId === 'engineer' && rng.next() < 0.45) {
      return 'brace-line';
    }
    return undefined;
  }

  private applyMoraleRouts(
    side: BattleSideState,
    rng: SeededRandom,
    highlights: string[]
  ): void {
    if (side.morale >= 40) return;

    for (const unit of side.units) {
      const alive = this.getBattleUnitAliveCount(unit);
      if (alive <= 0) continue;

      const routChance = clamp((40 - side.morale) / 70, 0, 0.7);
      if (rng.next() > routChance) continue;

      const fleeFraction = 0.08 + rng.next() * 0.12 + (35 - side.morale) / 180;
      const fleeing = Math.min(alive, Math.max(1, Math.floor(alive * fleeFraction)));
      if (fleeing <= 0) continue;

      const def = getUnitDefinition(unit.unitId);
      if (!def) continue;
      unit.remainingHealth = Math.max(0, unit.remainingHealth - fleeing * def.health);
      unit.routedCount += fleeing;
      highlights.push(
        `${side.label}: ${fleeing} ${this.getUnitLabel(unit.unitId)} rout.`
      );
    }
  }

  private chooseRandomTarget(
    side: BattleSideState,
    rng: SeededRandom
  ): BattleUnitState | undefined {
    const aliveUnits = side.units.filter(
      (unit) => this.getBattleUnitAliveCount(unit) > 0
    );
    if (aliveUnits.length === 0) return undefined;

    const frontline = aliveUnits.filter((unit) => {
      const def = getUnitDefinition(unit.unitId);
      return def && def.attackType !== 'ranged';
    });
    const candidates = frontline.length > 0 ? frontline : aliveUnits;
    return candidates[rng.randomInt(0, candidates.length - 1)];
  }

  private getAttackPower(
    unit: BattleUnitState,
    morale: number,
    phase: 'ranged' | 'melee',
    rng: SeededRandom
  ): number {
    const alive = this.getBattleUnitAliveCount(unit);
    const def = getUnitDefinition(unit.unitId);
    if (!def || alive <= 0) return 0;

    let power = def.power * alive;
    if (this.isTechUnlocked('mil-iron-weapons') && unit.unitId === 'footman') {
      power += alive;
    }

    let multiplier = clamp(0.7 + morale / 100, 0.55, 1.35);
    for (const status of unit.activeStatuses) {
      const statusDef = getBattleStatusDefinition(status.statusId);
      if (!statusDef) continue;
      multiplier *= statusDef.powerMultiplier ?? 1;
      multiplier *=
        phase === 'ranged'
          ? statusDef.rangedPowerMultiplier ?? 1
          : statusDef.meleePowerMultiplier ?? 1;
    }

    if (def.attackType === 'support' && phase === 'melee') {
      multiplier *= 0.75;
    }

    const variance = 0.88 + rng.next() * 0.24;
    return power * multiplier * variance;
  }

  private applyDamageToBattleUnit(
    unit: BattleUnitState,
    rawDamage: number,
    rangedAttack: boolean
  ): number {
    const def = getUnitDefinition(unit.unitId);
    if (!def || rawDamage <= 0) return 0;

    let defenseMultiplier = def.defense;
    for (const status of unit.activeStatuses) {
      const statusDef = getBattleStatusDefinition(status.statusId);
      if (!statusDef) continue;
      defenseMultiplier *= statusDef.defenseMultiplier ?? 1;
      if (rangedAttack) {
        defenseMultiplier *= statusDef.rangedDefenseMultiplier ?? 1;
      }
    }

    const effectiveDamage = rawDamage / Math.max(0.35, defenseMultiplier);
    unit.remainingHealth = Math.max(0, unit.remainingHealth - effectiveDamage);
    const alive = this.getBattleUnitAliveCount(unit);
    unit.killedCount = Math.max(
      unit.killedCount,
      unit.initialQuantity - unit.routedCount - alive
    );
    return effectiveDamage;
  }

  private adjustBattleMorale(
    side: BattleSideState,
    lossesInflicted: number,
    lossesTaken: number,
    damageDealt: number,
    damageTaken: number
  ): void {
    let nextMorale = side.morale;
    nextMorale += lossesInflicted * 1.8;
    nextMorale -= lossesTaken * 3.2;
    nextMorale += damageDealt > damageTaken ? 2 : -2;

    const currentStrength = this.getBattleSideAliveCount(side);
    const initialStrength = side.units.reduce(
      (sum, unit) => sum + unit.initialQuantity,
      0
    );
    if (initialStrength > 0 && currentStrength / initialStrength < 0.35) {
      nextMorale -= 6;
    }

    side.morale = clamp(Math.round(nextMorale), 0, 100);
  }

  private getBattleWinner(
    battle: BattleState
  ): BattleResult['winner'] | undefined {
    if (battle.phase !== 'battle') {
      return undefined;
    }
    const playerAlive = this.getBattleSideAliveCount(battle.player);
    const enemyAlive = this.getBattleSideAliveCount(battle.enemy);

    if (playerAlive <= 0 && enemyAlive <= 0) return 'draw';
    if (enemyAlive <= 0) return 'player';
    if (playerAlive <= 0) return 'enemy';

    if (battle.enemy.morale <= 5 && enemyAlive <= this.getInitialSideSize(battle.enemy) * 0.5) {
      return 'player';
    }
    if (battle.player.morale <= 5 && playerAlive <= this.getInitialSideSize(battle.player) * 0.5) {
      return 'enemy';
    }

    if (battle.turnNumber >= 12) {
      const playerScore = this.getSideExhaustionScore(battle.player);
      const enemyScore = this.getSideExhaustionScore(battle.enemy);
      if (playerScore === enemyScore) return 'draw';
      return playerScore > enemyScore ? 'player' : 'enemy';
    }

    return undefined;
  }

  private finishBattle(
    battle: BattleState,
    winner: BattleResult['winner']
  ): void {
    if (battle.player.usesRoster) {
      for (const [unitId, count] of Object.entries(
        battle.player.reserveUnits
      ) as [UnitRole, number | undefined][]) {
        const amount = count ?? 0;
        if (amount > 0) {
          this.addToRoster(unitId, amount, 'available');
        }
      }
      for (const unit of battle.player.units) {
        const survivors = this.getBattleUnitAliveCount(unit) + unit.routedCount;
        if (survivors > 0) {
          this.addToRoster(unit.unitId, survivors, 'available');
        }
      }
    }

    const rewards =
      winner === 'player'
        ? this.calculateBattleRewards(battle)
        : ({} as ResourceCost);
    if (Object.keys(rewards).length > 0) {
      this.grantResources(rewards);
    }

    const summaryLines: string[] = [];
    if (winner === 'player') {
      summaryLines.push(
        `${battle.enemy.label} are broken after ${battle.turnNumber} turn${
          battle.turnNumber !== 1 ? 's' : ''
        }.`
      );
    } else if (winner === 'enemy') {
      summaryLines.push(
        `${battle.player.label} collapse after ${battle.turnNumber} turn${
          battle.turnNumber !== 1 ? 's' : ''
        }.`
      );
    } else {
      summaryLines.push(
        `Both sides disengage after ${battle.turnNumber} grinding turn${
          battle.turnNumber !== 1 ? 's' : ''
        }.`
      );
    }
    if (battle.lastTurnSummary?.highlights.length) {
      summaryLines.push(...battle.lastTurnSummary.highlights.slice(0, 3));
    }

    this.lastBattleResult = {
      battleId: battle.battleId,
      name: battle.name,
      winner,
      turns: battle.turnNumber,
      playerKilled: this.collectBattleCounts(battle.player, 'killed'),
      enemyKilled: this.collectBattleCounts(battle.enemy, 'killed'),
      playerRouted: this.collectBattleCounts(battle.player, 'routed'),
      enemyRouted: this.collectBattleCounts(battle.enemy, 'routed'),
      rewards,
      playerMorale: battle.player.morale,
      enemyMorale: battle.enemy.morale,
      summaryLines,
    };
    this.activeBattle = undefined;
  }

  private calculateBattleRewards(battle: BattleState): ResourceCost {
    const enemyLosses =
      this.sumUnitCounts(this.collectBattleCounts(battle.enemy, 'killed')) +
      this.sumUnitCounts(this.collectBattleCounts(battle.enemy, 'routed'));
    const gold = Math.max(
      6,
      Math.round((enemyLosses * 2 + battle.turnNumber * 2) * battle.rewardMultiplier)
    );
    const meat = Math.max(
      2,
      Math.round((enemyLosses + battle.turnNumber) * 0.4 * battle.rewardMultiplier)
    );

    const rewards: ResourceCost = { gold, meat };
    const enemyFootmen = battle.enemy.units
      .filter((unit) => unit.unitId === 'footman')
      .reduce((sum, unit) => sum + unit.initialQuantity, 0);
    if (enemyFootmen > 0) {
      rewards.stone = Math.max(1, Math.round(enemyFootmen * 0.25));
    }
    return rewards;
  }

  private captureBattleSnapshot(side: BattleSideState): BattleSnapshot {
    const snapshot: BattleSnapshot = {};
    for (const unit of side.units) {
      snapshot[unit.battleUnitId] = {
        unitId: unit.unitId,
        alive: this.getBattleUnitAliveCount(unit),
        killed: unit.killedCount,
        routed: unit.routedCount,
      };
    }
    return snapshot;
  }

  private diffBattleSnapshot(
    side: BattleSideState,
    before: BattleSnapshot,
    after: BattleSnapshot,
    field: 'killed' | 'routed'
  ): UnitCountMap {
    const changes: UnitCountMap = {};
    for (const unit of side.units) {
      const beforeValue = before[unit.battleUnitId]?.[field] ?? 0;
      const afterValue = after[unit.battleUnitId]?.[field] ?? 0;
      const delta = Math.max(0, afterValue - beforeValue);
      if (delta <= 0) continue;
      changes[unit.unitId] = (changes[unit.unitId] ?? 0) + delta;
    }
    return changes;
  }

  private collectBattleCounts(
    side: BattleSideState,
    field: 'killed' | 'routed'
  ): UnitCountMap {
    const counts: UnitCountMap = {};
    for (const unit of side.units) {
      const value = field === 'killed' ? unit.killedCount : unit.routedCount;
      if (value <= 0) continue;
      counts[unit.unitId] = (counts[unit.unitId] ?? 0) + value;
    }
    return counts;
  }

  private getBattleUnitAliveCount(unit: BattleUnitState): number {
    const def = getUnitDefinition(unit.unitId);
    if (!def) return 0;
    if (unit.remainingHealth <= 0) return 0;
    return Math.ceil(unit.remainingHealth / def.health);
  }

  private getBattleSideAliveCount(side: BattleSideState): number {
    return side.units.reduce(
      (sum, unit) => sum + this.getBattleUnitAliveCount(unit),
      0
    );
  }

  private getInitialSideSize(side: BattleSideState): number {
    return side.units.reduce((sum, unit) => sum + unit.initialQuantity, 0);
  }

  private getSideExhaustionScore(side: BattleSideState): number {
    const moraleWeight = side.morale * 1.5;
    let powerWeight = 0;
    for (const unit of side.units) {
      const alive = this.getBattleUnitAliveCount(unit);
      if (alive <= 0) continue;
      const def = getUnitDefinition(unit.unitId);
      powerWeight += alive * (def?.power ?? 0);
    }
    return Math.round(moraleWeight + powerWeight * 4);
  }

  private sumUnitCounts(counts: UnitCountMap): number {
    return Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
  }

  private getUnitLabel(unitId: UnitRole): string {
    const def = getUnitDefinition(unitId);
    return def?.name ?? unitId;
  }

  private cloneBattleState(state: BattleState): BattleState {
    return {
      ...state,
      attackQueue: state.attackQueue.map((entry) => ({ ...entry })),
      pendingWinner: state.pendingWinner,
      pendingAction: state.pendingAction ? { ...state.pendingAction } : undefined,
      pendingRoundNotes: [...state.pendingRoundNotes],
      battleLog: [...state.battleLog],
      player: this.cloneBattleSide(state.player),
      enemy: this.cloneBattleSide(state.enemy),
      lastTurnSummary: state.lastTurnSummary
        ? {
            ...state.lastTurnSummary,
            playerCasualties: { ...state.lastTurnSummary.playerCasualties },
            enemyCasualties: { ...state.lastTurnSummary.enemyCasualties },
            playerRouted: { ...state.lastTurnSummary.playerRouted },
            enemyRouted: { ...state.lastTurnSummary.enemyRouted },
            commandResults: [...state.lastTurnSummary.commandResults],
            highlights: [...state.lastTurnSummary.highlights],
          }
        : undefined,
    };
  }

  private cloneBattleSide(side: BattleSideState): BattleSideState {
    return {
      ...side,
      reserveUnits: { ...side.reserveUnits },
      units: side.units.map((unit) => ({
        ...unit,
        activeStatuses: unit.activeStatuses.map((status) => ({ ...status })),
      })),
    };
  }

  private cloneBattleResult(result: BattleResult): BattleResult {
    return {
      ...result,
      playerKilled: { ...result.playerKilled },
      enemyKilled: { ...result.enemyKilled },
      playerRouted: { ...result.playerRouted },
      enemyRouted: { ...result.enemyRouted },
      rewards: { ...result.rewards },
      summaryLines: [...result.summaryLines],
    };
  }

  // ─── Internal roster helpers ─────────────────────────────────────

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
