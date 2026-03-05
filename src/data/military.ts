import type {
  UnitDefinition,
  UnitRole,
} from '../_common/models/military.models';

/**
 * All military unit definitions.
 * Adding a new unit only requires editing this object.
 */
export const unitDefinitions = {
  militia: {
    id: 'militia',
    name: 'Militia',
    description:
      'Lightly armed civilians called to defend in emergencies. Cheap but weak.',
    class: 'common',
    power: 1,
    upkeep: { meat: 1 },
    trainingCost: { gold: 10, meat: 5 },
    trainingTime: 1,
    tags: ['infantry', 'light'],
    requiredTechnologies: [],
  },
  footman: {
    id: 'footman',
    name: 'Footman',
    description:
      'Armored infantry forming the backbone of a professional army.',
    class: 'common',
    power: 3,
    upkeep: { gold: 1, meat: 2 },
    trainingCost: { gold: 25, stone: 10, meat: 10 },
    trainingTime: 2,
    tags: ['infantry', 'heavy'],
    requiredTechnologies: ['mil-drill-doctrine'],
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    description:
      'Ranged skirmishers effective against lightly armored targets and in defense.',
    class: 'common',
    power: 2,
    upkeep: { gold: 1, meat: 1 },
    trainingCost: { gold: 20, wood: 5, meat: 5 },
    trainingTime: 2,
    tags: ['ranged', 'light'],
    requiredTechnologies: ['mil-drill-doctrine'],
  },
  spy: {
    id: 'spy',
    name: 'Spy',
    description:
      'Covert operative that gathers intelligence and disrupts enemy plans. Improves intel, lowers ambush risk, and boosts raid interception.',
    class: 'specialist',
    power: 1,
    upkeep: { gold: 3 },
    trainingCost: { gold: 40 },
    trainingTime: 3,
    tags: ['specialist', 'intel', 'covert'],
    requiredTechnologies: ['mil-iron-weapons'],
  },
  engineer: {
    id: 'engineer',
    name: 'Engineer',
    description:
      'Specialist in fortifications and siege equipment. Improves siege outcomes and campaign efficiency.',
    class: 'specialist',
    power: 1,
    upkeep: { gold: 2, stone: 1 },
    trainingCost: { gold: 35, stone: 15 },
    trainingTime: 3,
    tags: ['specialist', 'siege', 'fortification'],
    requiredTechnologies: ['mil-fortification-engineering'],
  },
} as const satisfies Record<string, UnitDefinition>;

/** All valid unit role ids, derived from the definitions object. */
export type MilitaryUnitId = keyof typeof unitDefinitions;

/**
 * Get unit definition by role id. Returns undefined if not found.
 */
export function getUnitDefinition(id: UnitRole): UnitDefinition | undefined {
  return unitDefinitions[id as MilitaryUnitId] as UnitDefinition | undefined;
}

/**
 * Get all unit definitions as an array.
 */
export function getAllUnitDefinitions(): UnitDefinition[] {
  return Object.values(unitDefinitions) as UnitDefinition[];
}

/**
 * Check if a string is a valid unit role id.
 */
export function isUnitRole(id: string): id is UnitRole {
  return Object.prototype.hasOwnProperty.call(unitDefinitions, id);
}

/** Training slots provided by each barracks instance. */
export const BARRACKS_TRAINING_SLOTS_PER_INSTANCE = 4;

/** Garrison (max non-training units) provided by each barracks instance. */
export const BARRACKS_GARRISON_PER_INSTANCE = 8;
