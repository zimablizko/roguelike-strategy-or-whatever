import type { PoliticalRequestDefinition } from '../../_common/models/politics.models';

/**
 * All political request definitions.
 * Each entity type has requests gated by conditions (tech, reputation, resources, etc.).
 */
export const politicalRequestDefinitions: readonly PoliticalRequestDefinition[] =
  [
    // Crown
    {
      id: 'crown-royal-tribute',
      entityId: 'crown',
      title: 'Royal Tribute',
      description:
        'The sovereign court expects a formal tribute. Send 25 Gold to affirm loyalty and receive renewed royal authority.',
      weight: 9,
      cooldownTurns: 6,
      condition: (ctx) => ctx.getResource('gold') >= 25,
      approveRepChanges: { crown: 6 },
      denyRepChanges: { crown: -4 },
      approveResourceEffects: { gold: -25, politicalPower: 1 },
      expireTurns: 3,
    },
    {
      id: 'crown-oath-renewal',
      entityId: 'crown',
      title: 'Renew Oath of Fealty',
      description:
        'Dispatch envoys and gifts to renew your oath before the sovereign court. Costs 10 Gold and grants 1 Political Power.',
      weight: 7,
      cooldownTurns: 8,
      condition: (ctx) => ctx.getResource('gold') >= 10,
      approveRepChanges: { crown: 4, 'politics-advisor': 1 },
      denyRepChanges: { crown: -3 },
      approveResourceEffects: { gold: -10, politicalPower: 1 },
      expireTurns: 4,
    },
    {
      id: 'crown-muster-accounting',
      entityId: 'crown',
      title: 'Royal Muster Report',
      description:
        'The Crown demands an updated account of your levies and stores. Pay 5 Gold to satisfy royal auditors and preserve confidence.',
      weight: 8,
      cooldownTurns: 5,
      condition: (ctx) => ctx.getResource('gold') >= 5,
      approveRepChanges: { crown: 3, 'military-advisor': 1 },
      denyRepChanges: { crown: -2 },
      approveResourceEffects: { gold: -5 },
      expireTurns: 3,
    },

    // Common Folk
    {
      id: 'folk-food-shortage',
      entityId: 'common-folk',
      title: 'Food Distribution',
      description:
        'The common folk ask you to distribute food rations to ease hunger in the streets. Costs 10 Bread.',
      weight: 10,
      cooldownTurns: 4,
      condition: (ctx) => ctx.getResource('bread') >= 10,
      approveRepChanges: { 'common-folk': 5 },
      denyRepChanges: { 'common-folk': -3 },
      approveResourceEffects: { bread: -10 },
      expireTurns: 3,
    },
    {
      id: 'folk-housing-demand',
      entityId: 'common-folk',
      title: 'Housing Demand',
      description:
        'Citizens request more housing. Spend 20 Gold to improve living conditions.',
      weight: 8,
      cooldownTurns: 5,
      condition: (ctx) => ctx.getResource('gold') >= 20,
      approveRepChanges: { 'common-folk': 4 },
      denyRepChanges: { 'common-folk': -2 },
      approveResourceEffects: { gold: -20 },
      expireTurns: 3,
    },
    {
      id: 'folk-festival',
      entityId: 'common-folk',
      title: 'Public Festival',
      description:
        'The people wish to hold a festival. Costs 10 Gold, 5 Bread and 5 Meat but greatly improves morale.',
      weight: 6,
      cooldownTurns: 8,
      condition: (ctx) =>
        ctx.getResource('gold') >= 10 &&
        ctx.getResource('bread') >= 5 &&
        ctx.getResource('meat') >= 5,
      approveRepChanges: { 'common-folk': 8, 'politics-advisor': 2, crown: 1 },
      denyRepChanges: { 'common-folk': -4 },
      approveResourceEffects: { gold: -10, bread: -5, meat: -5 },
      expireTurns: 2,
    },

    // Economy Advisor
    {
      id: 'econ-build-lumbermill',
      entityId: 'economy-advisor',
      title: 'Build a Lumbermill',
      description:
        'The economy advisor recommends constructing a Lumbermill to improve material output.',
      weight: 10,
      cooldownTurns: 6,
      condition: (ctx) =>
        ctx.isTechUnlocked('pol-clan-council') &&
        ctx.getBuildingCount('lumbermill') < 3,
      approveRepChanges: { 'economy-advisor': 4 },
      denyRepChanges: { 'economy-advisor': -2 },
      expireTurns: 4,
    },
    {
      id: 'econ-trade-investment',
      entityId: 'economy-advisor',
      title: 'Trade Investment',
      description:
        'Invest 25 Gold into trade routes for long-term economic growth.',
      weight: 8,
      cooldownTurns: 5,
      condition: (ctx) =>
        ctx.isTechUnlocked('pol-clan-council') && ctx.getResource('gold') >= 25,
      approveRepChanges: { 'economy-advisor': 5 },
      denyRepChanges: { 'economy-advisor': -2, 'common-folk': 1 },
      approveResourceEffects: { gold: -25 },
      expireTurns: 3,
    },
    {
      id: 'econ-tax-relief',
      entityId: 'economy-advisor',
      title: 'Tax Relief',
      description:
        'The advisor suggests temporary tax relief to stimulate growth. Costs 15 Gold.',
      weight: 7,
      cooldownTurns: 6,
      condition: (ctx) =>
        ctx.isTechUnlocked('pol-clan-council') && ctx.getResource('gold') >= 15,
      approveRepChanges: { 'economy-advisor': 3, 'common-folk': 3 },
      denyRepChanges: { 'economy-advisor': -1 },
      approveResourceEffects: { gold: -15 },
      expireTurns: 3,
    },

    // Military Advisor
    {
      id: 'mil-border-patrol',
      entityId: 'military-advisor',
      title: 'Increase Border Patrols',
      description:
        'The military advisor urges increased border patrols. Costs 10 Gold and 3 Meat.',
      weight: 9,
      cooldownTurns: 5,
      condition: (ctx) =>
        ctx.isTechUnlocked('pol-clan-council') &&
        ctx.getResource('gold') >= 10 &&
        ctx.getResource('meat') >= 3,
      approveRepChanges: { 'military-advisor': 5 },
      denyRepChanges: { 'military-advisor': -3 },
      approveResourceEffects: { gold: -10, meat: -3 },
      expireTurns: 3,
    },
    {
      id: 'mil-weapon-stockpile',
      entityId: 'military-advisor',
      title: 'Weapon Stockpile',
      description: 'Stockpile weapons for future conflicts. Costs 10 Stone.',
      weight: 7,
      cooldownTurns: 6,
      condition: (ctx) =>
        ctx.isTechUnlocked('pol-clan-council') &&
        ctx.getResource('stone') >= 10,
      approveRepChanges: { 'military-advisor': 4 },
      denyRepChanges: { 'military-advisor': -2, 'common-folk': 1 },
      approveResourceEffects: { stone: -10 },
      expireTurns: 4,
    },

    // Politics Advisor
    {
      id: 'pol-diplomatic-envoy',
      entityId: 'politics-advisor',
      title: 'Diplomatic Envoy',
      description:
        'Send a diplomatic envoy to improve foreign relations. Costs 20 Gold.',
      weight: 8,
      cooldownTurns: 6,
      condition: (ctx) =>
        ctx.isTechUnlocked('pol-clan-council') && ctx.getResource('gold') >= 20,
      approveRepChanges: { 'politics-advisor': 5, crown: 1 },
      denyRepChanges: { 'politics-advisor': -2, crown: -1 },
      approveResourceEffects: { gold: -20 },
      expireTurns: 3,
    },
    {
      id: 'pol-legal-reform',
      entityId: 'politics-advisor',
      title: 'Legal Reform',
      description:
        'The advisor proposes legal reforms to modernize governance. Costs 10 Gold.',
      weight: 7,
      cooldownTurns: 7,
      condition: (ctx) =>
        ctx.isTechUnlocked('pol-clan-council') && ctx.getResource('gold') >= 10,
      approveRepChanges: { 'politics-advisor': 4, 'common-folk': 2 },
      denyRepChanges: { 'politics-advisor': -3, 'common-folk': -1 },
      approveResourceEffects: { gold: -10 },
      expireTurns: 3,
    },
    {
      id: 'pol-census-update',
      entityId: 'politics-advisor',
      title: 'Census Update',
      description:
        'Conduct a comprehensive census to better understand the population. Costs 5 Gold.',
      weight: 6,
      cooldownTurns: 8,
      condition: (ctx) =>
        ctx.isTechUnlocked('pol-clan-council') && ctx.getResource('gold') >= 5,
      approveRepChanges: { 'politics-advisor': 3, 'economy-advisor': 2 },
      denyRepChanges: { 'politics-advisor': -1 },
      approveResourceEffects: { gold: -5 },
      expireTurns: 4,
    },
  ];
