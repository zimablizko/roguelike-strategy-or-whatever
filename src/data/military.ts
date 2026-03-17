import type {
  BattleCommandDefinition,
  BattleCommandId,
  BattleStatusDefinition,
  BattleStatusId,
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

export const battleCommandDefinitions = {
  'press-forward': {
    id: 'press-forward',
    name: 'Press Forward',
    description:
      'Push aggressively into the enemy line. Raises damage output but leaves the unit exposed.',
    statusId: 'aggressive',
    disciplineDifficulty: 0.12,
  },
  'shield-up': {
    id: 'shield-up',
    name: 'Shield Up',
    description:
      'Raise shields and hold formation. Stronger against ranged volleys but with reduced attack power.',
    statusId: 'shielded',
    disciplineDifficulty: 0.08,
  },
  volley: {
    id: 'volley',
    name: 'Volley',
    description:
      'Loose a coordinated volley for stronger ranged pressure at the cost of staying exposed.',
    statusId: 'volleying',
    disciplineDifficulty: 0.14,
  },
  'sow-panic': {
    id: 'sow-panic',
    name: 'Sow Panic',
    description:
      'Harass and confuse enemy lines, lowering morale if the order is carried out.',
    statusId: 'disrupting',
    disciplineDifficulty: 0.22,
  },
  'brace-line': {
    id: 'brace-line',
    name: 'Brace Line',
    description:
      'Stabilize nearby troops and reinforce positions, improving the line’s resilience.',
    statusId: 'fortified',
    disciplineDifficulty: 0.1,
  },
} as const satisfies Record<BattleCommandId, BattleCommandDefinition>;

export const battleStatusDefinitions = {
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive',
    description: '+20% power, -15% defense.',
    powerMultiplier: 1.2,
    defenseMultiplier: 0.85,
  },
  shielded: {
    id: 'shielded',
    name: 'Shielded',
    description: '-15% power, +55% defense against ranged attacks.',
    powerMultiplier: 0.85,
    rangedDefenseMultiplier: 1.55,
  },
  volleying: {
    id: 'volleying',
    name: 'Volleying',
    description: '+25% ranged power, -10% defense.',
    rangedPowerMultiplier: 1.25,
    defenseMultiplier: 0.9,
  },
  fortified: {
    id: 'fortified',
    name: 'Fortified',
    description: '+25% defense while holding the line.',
    defenseMultiplier: 1.25,
  },
  disrupting: {
    id: 'disrupting',
    name: 'Disrupting',
    description: 'Each successful action drains enemy morale.',
    enemyMoraleHit: 5,
  },
} as const satisfies Record<BattleStatusId, BattleStatusDefinition>;

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

export function getBattleCommandDefinition(
  id: BattleCommandId
): BattleCommandDefinition | undefined {
  return battleCommandDefinitions[id];
}

export function getBattleStatusDefinition(
  id: BattleStatusId
): BattleStatusDefinition | undefined {
  return battleStatusDefinitions[id];
}

export function getUnitBattleCommands(
  unitId: UnitRole
): BattleCommandDefinition[] {
  const def = getUnitDefinition(unitId);
  if (!def) return [];
  return def.commandIds
    .map((commandId) => getBattleCommandDefinition(commandId))
    .filter(
      (command): command is BattleCommandDefinition => command !== undefined
    );
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
