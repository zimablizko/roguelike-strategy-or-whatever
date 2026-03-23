import type { RulerTraitDefinition } from '../../_common/models/ruler-traits.models';

export const rulerTraitDefinitions: Record<string, RulerTraitDefinition> = {
  tireless: {
    id: 'tireless',
    name: 'Tireless',
    polarity: 'positive',
    description:
      'This ruler thrives under pressure and can sustain a longer day of decisions.',
    effectSummary: '+2 Focus',
    effect: {
      focus: 2,
    },
  },
  'silver-tongue': {
    id: 'silver-tongue',
    name: 'Silver Tongue',
    polarity: 'positive',
    description:
      'Every negotiation feels smoother when this ruler steps into the room.',
    effectSummary: '+2 Charisma',
    effect: {
      charisma: 2,
    },
  },
  'iron-constitution': {
    id: 'iron-constitution',
    name: 'Iron Constitution',
    polarity: 'positive',
    description:
      'A sturdy body and disciplined habits give this ruler unusual resilience.',
    effectSummary: 'Health improves by 1 step',
    effect: {
      healthStep: 1,
    },
  },
  tactician: {
    id: 'tactician',
    name: 'Tactician',
    polarity: 'positive',
    description:
      'A sharp strategic mind keeps both court and campaign moving with purpose.',
    effectSummary: '+1 Focus, +1 Charisma',
    effect: {
      focus: 1,
      charisma: 1,
    },
  },
  frail: {
    id: 'frail',
    name: 'Frail',
    polarity: 'negative',
    description:
      'Even ordinary strain leaves this ruler exhausted and vulnerable to illness.',
    effectSummary: 'Health worsens by 1 step',
    effect: {
      healthStep: -1,
    },
  },
  blunt: {
    id: 'blunt',
    name: 'Blunt',
    polarity: 'negative',
    description:
      'The ruler acts decisively, but their words often close doors instead of opening them.',
    effectSummary: '+1 Focus, -2 Charisma',
    effect: {
      focus: 1,
      charisma: -2,
    },
  },
  indolent: {
    id: 'indolent',
    name: 'Indolent',
    polarity: 'negative',
    description:
      'Charm comes naturally, but sustained effort does not.',
    effectSummary: '-2 Focus, +1 Charisma',
    effect: {
      focus: -2,
      charisma: 1,
    },
  },
};
