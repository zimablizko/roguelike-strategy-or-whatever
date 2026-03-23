import type {
  StatePrehistoryDefinition,
  StatePrehistoryId,
} from '../../_common/models/game-setup.models';

export const statePrehistoryOrder: StatePrehistoryId[] = [
  'distant-colony',
  'military-campaign',
  'farmers-community',
];

export const statePrehistoryDefinitions = {
  'distant-colony': {
    id: 'distant-colony',
    label: 'Distant colony',
    description:
      'We settle a new colony on a far-off shore of the realm. The Crown is distant, help is scarce, and the burden is ours alone.',
    effectSummary:
      'Start with more general resources to survive without royal support.',
    startingResources: {
      gold: 60,
      wood: 40,
      stone: 40,
      meat: 15,
      bread: 15,
    },
  },
  'military-campaign': {
    id: 'military-campaign',
    label: 'Military campaign',
    description:
      'We seized this land from local barbarians and now must secure it with steel. The frontier is unstable and the enemy may regroup.',
    effectSummary:
      'Start with 5 Footmen and Standing Army research. Barbarian invasion random events become possible.',
    startingTechnologies: ['mil-drill-doctrine'],
    startingUnits: [{ unitId: 'footman', count: 5 }],
  },
  'farmers-community': {
    id: 'farmers-community',
    label: 'Farmers community',
    description:
      'We found this village to feed the sovereign. The settlement is humble, practical, and shaped around fields and granaries.',
    effectSummary:
      'Start with Agriculture research and a larger food reserve.',
    startingResources: {
      wheat: 20,
      meat: 20,
      bread: 20,
    },
    startingTechnologies: ['eco-agriculture'],
  },
} as const satisfies Record<StatePrehistoryId, StatePrehistoryDefinition>;
