import type { UnitDefinition } from '../../_common/models/military.models';

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
    health: 10,
    defense: 1,
    attackType: 'melee',
    upkeep: { meat: 1 },
    trainingCost: { gold: 10, meat: 5 },
    trainingTime: 1,
    tags: ['infantry', 'light'],
    commandIds: ['press-forward'],
    requiredTechnologies: [],
  },
  footman: {
    id: 'footman',
    name: 'Footman',
    description:
      'Armored infantry forming the backbone of a professional army.',
    class: 'common',
    power: 3,
    health: 14,
    defense: 1.25,
    attackType: 'melee',
    upkeep: { gold: 1, meat: 2 },
    trainingCost: { gold: 25, stone: 10, meat: 10 },
    trainingTime: 2,
    tags: ['infantry', 'heavy'],
    commandIds: ['shield-up'],
    requiredTechnologies: ['mil-drill-doctrine'],
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    description:
      'Ranged skirmishers effective against lightly armored targets and in defense.',
    class: 'common',
    power: 2,
    health: 7,
    defense: 0.95,
    attackType: 'ranged',
    upkeep: { gold: 1, meat: 1 },
    trainingCost: { gold: 20, wood: 5, meat: 5 },
    trainingTime: 2,
    tags: ['ranged', 'light'],
    commandIds: ['volley'],
    requiredTechnologies: ['mil-fletching'],
  },
  spy: {
    id: 'spy',
    name: 'Spy',
    description:
      'Covert operative that gathers intelligence and disrupts enemy plans. Improves intel, lowers ambush risk, and boosts raid interception.',
    class: 'specialist',
    power: 1,
    health: 6,
    defense: 0.8,
    attackType: 'support',
    upkeep: { gold: 3 },
    trainingCost: { gold: 40 },
    trainingTime: 3,
    tags: ['specialist', 'intel', 'covert'],
    commandIds: ['sow-panic'],
    requiredTechnologies: ['mil-iron-weapons'],
  },
  engineer: {
    id: 'engineer',
    name: 'Engineer',
    description:
      'Specialist in fortifications and siege equipment. Improves siege outcomes and campaign efficiency.',
    class: 'specialist',
    power: 1,
    health: 10,
    defense: 1.15,
    attackType: 'support',
    upkeep: { gold: 2, stone: 1 },
    trainingCost: { gold: 35, stone: 15 },
    trainingTime: 3,
    tags: ['specialist', 'siege', 'fortification'],
    commandIds: ['brace-line'],
    requiredTechnologies: ['mil-fortification-engineering'],
  },
} as const satisfies Record<string, UnitDefinition>;

/** All valid unit role ids, derived from the definitions object. */
export type MilitaryUnitId = keyof typeof unitDefinitions;
