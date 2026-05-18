import type { SeededRandom } from '../_common/random';
import type {
  Person,
  PersonClass,
  PersonOccupation,
  PersonSaveState,
} from '../_common/models/person.models';
import type { StateBuildingInstance } from '../_common/models/building-manager.models';
import { generateName } from '../data/persons/personNames';

export interface PersonManagerOptions {
  rng: SeededRandom;
  initial?: PersonSaveState;
}

/** Priority order for housing allocation (lower index = higher priority). */
const HOUSING_PRIORITY: PersonClass[] = ['ruler', 'noble', 'peasant', 'beggar'];

/** Buildings that provide housing slots. */
const HOUSING_SLOTS: Partial<Record<string, number>> = {
  castle: 20,
  house: 5,
};

export class PersonManager {
  private people: Person[];
  private serial: number;
  private version: number;
  private readonly rng: SeededRandom;

  constructor(options: PersonManagerOptions) {
    this.rng = options.rng;
    this.people = options.initial ? [...options.initial.people] : [];
    this.serial = options.initial?.serial ?? 0;
    this.version = 0;
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  getAllPeople(): readonly Person[] {
    return this.people;
  }

  /** Housed peasants with no current occupation — eligible for work or training. */
  getFreePeasants(): Person[] {
    return this.people.filter(
      (p) => p.class === 'peasant' && p.occupation === null && p.housingInstanceId !== undefined
    );
  }

  getPersonById(id: string): Person | undefined {
    return this.people.find((p) => p.id === id);
  }

  getPeopleCount(): number {
    return this.people.length;
  }

  getVersion(): number {
    return this.version;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  addPerson(personClass: PersonClass, rng?: SeededRandom, nameOverride?: string): Person {
    const r = rng ?? this.rng;
    const person: Person = {
      id: `person-${++this.serial}`,
      name: nameOverride ?? generateName(personClass, r),
      class: personClass,
      occupation: null,
    };
    this.people.push(person);
    this.version++;
    return person;
  }

  /** Remove a person permanently (execute/exile). Not valid for ruler class. */
  removePerson(id: string): void {
    const idx = this.people.findIndex((p) => p.id === id && p.class !== 'ruler');
    if (idx === -1) return;
    this.people.splice(idx, 1);
    this.version++;
  }

  /** Change social class. Not valid for ruler. */
  setClass(id: string, newClass: PersonClass): void {
    const person = this.people.find((p) => p.id === id && p.class !== 'ruler');
    if (!person) return;
    person.class = newClass;
    this.version++;
  }

  rename(id: string, rng?: SeededRandom): void {
    const person = this.people.find((p) => p.id === id);
    if (!person) return;
    const r = rng ?? this.rng;
    person.name = generateName(person.class, r);
    this.version++;
  }

  assignToBuilding(id: string, instanceId: string, occupation: PersonOccupation): void {
    const person = this.people.find((p) => p.id === id);
    if (!person) return;
    person.buildingInstanceId = instanceId;
    person.occupation = occupation;
    this.version++;
  }

  /** Detach worker from a production building. Returns the freed person (or undefined if none). */
  removeFromBuilding(instanceId: string): Person | undefined {
    const person = this.people.find((p) => p.buildingInstanceId === instanceId);
    if (!person) return undefined;
    person.buildingInstanceId = undefined;
    person.occupation = null;
    this.version++;
    return person;
  }

  assignAsSoldier(id: string, unitRole: string): void {
    const person = this.people.find((p) => p.id === id);
    if (!person) return;
    person.occupation = unitRole as PersonOccupation;
    person.unitRole = unitRole;
    person.buildingInstanceId = undefined;
    this.version++;
  }

  /** Remove `count` soldiers of a given role (called on battle losses). */
  removeSoldiers(unitRole: string, count: number): void {
    let removed = 0;
    for (let i = this.people.length - 1; i >= 0 && removed < count; i--) {
      if (this.people[i].unitRole === unitRole) {
        this.people.splice(i, 1);
        removed++;
      }
    }
    if (removed > 0) this.version++;
  }

  // ── Housing ────────────────────────────────────────────────────────────────

  /**
   * Recompute housing assignments from current building instances.
   * Priority: ruler → nobles → peasants → beggars.
   * Anyone left without housing loses their job and becomes 'beggar'.
   */
  reallocateHousing(instances: readonly StateBuildingInstance[]): void {
    // Collect available housing slots per instance
    const slots: Array<{ instanceId: string; slotsLeft: number; isCastle: boolean }> = [];
    for (const inst of instances) {
      if (inst.turnsRemaining && inst.turnsRemaining > 0) continue;
      const cap = HOUSING_SLOTS[inst.buildingId];
      if (cap) {
        slots.push({ instanceId: inst.instanceId, slotsLeft: cap, isCastle: inst.buildingId === 'castle' });
      }
    }

    // Sort slots: castles first (nobles + ruler prefer castle)
    slots.sort((a, b) => (b.isCastle ? 1 : 0) - (a.isCastle ? 1 : 0));

    // Clear existing housing
    for (const p of this.people) {
      p.housingInstanceId = undefined;
    }

    // Sort people by priority
    const sorted = [...this.people].sort(
      (a, b) => HOUSING_PRIORITY.indexOf(a.class) - HOUSING_PRIORITY.indexOf(b.class)
    );

    let changed = false;

    for (const person of sorted) {
      let housed = false;

      // Ruler and nobles prefer castle slots
      const preferCastle = person.class === 'ruler' || person.class === 'noble';
      const orderedSlots = preferCastle
        ? slots
        : [...slots].sort((a, b) => (a.isCastle ? 1 : 0) - (b.isCastle ? 1 : 0));

      for (const slot of orderedSlots) {
        if (slot.slotsLeft > 0) {
          person.housingInstanceId = slot.instanceId;
          slot.slotsLeft--;
          housed = true;
          break;
        }
      }

      if (!housed) {
        // Lose job and become beggar
        if (person.class !== 'beggar' || person.occupation !== null) {
          person.occupation = null;
          if (person.class !== 'ruler') {
            person.class = 'beggar';
          }
          person.buildingInstanceId = undefined;
          changed = true;
        }
      }
    }

    // Sync back actual housing to original people array
    for (const sp of sorted) {
      const orig = this.people.find((p) => p.id === sp.id);
      if (orig) {
        if (orig.housingInstanceId !== sp.housingInstanceId) changed = true;
        orig.housingInstanceId = sp.housingInstanceId;
        orig.class = sp.class;
        orig.occupation = sp.occupation;
        orig.buildingInstanceId = sp.buildingInstanceId;
      }
    }

    if (changed) this.version++;
  }

  /**
   * If `peopleCount < housingCapacity`, ~20% chance per call to add a new peasant.
   * Intended to be called every 7 turns.
   */
  tryWeeklyArrival(housingCapacity: number, rng?: SeededRandom): Person | undefined {
    if (this.people.length >= housingCapacity) return undefined;
    const r = rng ?? this.rng;
    if (r.next() > 0.2) return undefined;
    return this.addPerson('peasant', r);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Total housing slots available from currently complete buildings. */
  static computeHousingCapacity(instances: readonly StateBuildingInstance[]): number {
    let total = 0;
    for (const inst of instances) {
      if (inst.turnsRemaining && inst.turnsRemaining > 0) continue;
      const cap = HOUSING_SLOTS[inst.buildingId];
      if (cap) total += cap;
    }
    return total;
  }

  // ── Save / Load ────────────────────────────────────────────────────────────

  getSaveState(): PersonSaveState {
    return {
      people: this.people.map((p) => ({ ...p })),
      serial: this.serial,
    };
  }
}
