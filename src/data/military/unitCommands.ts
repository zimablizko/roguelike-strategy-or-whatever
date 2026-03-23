import type {
  BattleCommandDefinition,
  BattleCommandId,
} from '../../_common/models/military.models';

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
