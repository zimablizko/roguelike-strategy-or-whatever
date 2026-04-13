import type { ConditionDefinition } from '../../_common/models/condition.models';

/**
 * All condition definitions keyed by their unique ID.
 * Adding a new entry here automatically extends the `ConditionId` type.
 */
export const conditionDefinitions = {
  drought: {
    id: 'drought',
    name: 'Drought',
    description:
      'A prolonged dry spell scorches the land. Crops wither and forests thin.',
    sentiment: 'negative',
    defaultDuration: 12,
    effects: {
      resourceMultipliers: { wheat: 0.7, meat: 0.85, bread: 0.7, fish: 0.85 },
      resourceModifiers: { wood: -1 },
    },
  },
  flood: {
    id: 'flood',
    name: 'Great Flood',
    description:
      'Rivers swell and burst their banks, damaging foundations and sweeping away supplies.',
    sentiment: 'negative',
    defaultDuration: 8,
    effects: {
      resourceMultipliers: { wheat: 0.8, bread: 0.8 },
      resourceModifiers: { stone: -2 },
      buildSpeedModifier: 0.8,
    },
  },
  'golden-age': {
    id: 'golden-age',
    name: 'Golden Age',
    description:
      'A time of unparalleled prosperity. Trade flourishes, artisans thrive, and knowledge flows freely.',
    sentiment: 'positive',
    defaultDuration: 16,
    effects: {
      resourceMultipliers: {
        gold: 1.2,
        wood: 1.2,
        stone: 1.2,
        wheat: 1.2,
        meat: 1.2,
        bread: 1.2,
        fish: 1.2,
      },
      researchSpeedModifier: 1.15,
    },
  },
  plague: {
    id: 'plague',
    name: 'Plague',
    description:
      'A terrible sickness sweeps through the populace. The weak perish and productivity plummets.',
    sentiment: 'negative',
    defaultDuration: 10,
    effects: {
      resourceModifiers: { population: -1 },
      upkeepMultiplier: 1.3,
    },
  },
  'bountiful-harvest': {
    id: 'bountiful-harvest',
    name: 'Bountiful Harvest',
    description:
      'The fields overflow with grain and the orchards hang heavy with fruit. Nature smiles upon the realm.',
    sentiment: 'positive',
    defaultDuration: 6,
    effects: {
      resourceMultipliers: { wheat: 1.5, bread: 1.5, meat: 1.3 },
    },
  },
  'civil-unrest': {
    id: 'civil-unrest',
    name: 'Civil Unrest',
    description:
      'The people grow restless. Protests disrupt commerce and distract the court.',
    sentiment: 'negative',
    defaultDuration: 8,
    effects: {
      resourceMultipliers: { gold: 0.75 },
      focusModifier: -1,
    },
  },
  'trade-boom': {
    id: 'trade-boom',
    name: 'Trade Boom',
    description:
      'Merchant caravans flock to the realm. Gold flows freely and influence grows.',
    sentiment: 'positive',
    defaultDuration: 10,
    effects: {
      resourceMultipliers: { gold: 1.4 },
      resourceModifiers: { politicalPower: 1 },
    },
  },
  'harsh-winter': {
    id: 'harsh-winter',
    name: 'Harsh Winter',
    description:
      'A bitter cold grips the land. Food is scarce, but frozen quarries yield stone more easily.',
    sentiment: 'neutral',
    defaultDuration: 4,
    effects: {
      resourceMultipliers: { wheat: 0.7, bread: 0.7, fish: 0.7 },
      resourceModifiers: { wood: -2, stone: 1 },
    },
  },
} as const satisfies Record<string, ConditionDefinition>;
