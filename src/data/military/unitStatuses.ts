import type {
  BattleStatusDefinition,
  BattleStatusId,
} from '../../_common/models/military.models';

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
