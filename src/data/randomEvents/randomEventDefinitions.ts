import type { RandomEventDefinition } from '../../_common/models/random-events.models';

export const randomEventDefinitions = {
  'traveling-merchants': {
    id: 'traveling-merchants',
    title: 'Traveling Merchants',
    description:
      'A caravan from distant roads requests permission to trade in your market square. Their wagons carry fine tools, trinkets, and gossip from beyond your borders.',
    rarity: 'common',
    weight: 10,
    cooldownTurns: 14,
    conditions: {
      requiredTechnologies: ['eco-market-charters'],
      minBuildingCounts: { market: 1 },
    },
    options: [
      {
        id: 'license-the-fair',
        title: 'License the Fair',
        outcomeDescription:
          'Grant stall permits and market rights for the fair. Gain 20 Gold.',
        outcome: {
          resourceEffects: { gold: 20 },
          resultText:
            'The visiting merchants pay for stall space, clerks, and market rights. Trade flows smoothly and the treasury takes its share.',
          logSeverity: 'neutral',
        },
      },
      {
        id: 'host-the-market',
        title: 'Host the Market',
        outcomeDescription:
          'Spend 5 Gold to support the fair. Gain 1 Jewelry and improve public mood.',
        requirements: {
          minResources: { gold: 5 },
        },
        outcome: {
          resourceEffects: { gold: -5, jewelry: 1 },
          reputationEffects: { 'common-folk': 3 },
          resultText:
            'The square fills with buyers, songs, and coin. The merchants leave pleased, and the people remember your generosity.',
          logSeverity: 'good',
        },
      },
      {
        id: 'hire-guards',
        title: 'Hire Guards',
        outcomeDescription:
          'Spend 15 Gold to recruit armed escorts from the merchant roads. Gain 3 Militia.',
        requirements: {
          minResources: { gold: 15 },
        },
        outcome: {
          resourceEffects: { gold: -15 },
          unitRewards: [{ unitId: 'militia', count: 3 }],
          resultText:
            'Several hard-bitten road guards accept your coin and swear temporary service under your banner.',
          logSeverity: 'good',
        },
      },
    ],
  },
  'old-ruins-discovered': {
    id: 'old-ruins-discovered',
    title: 'Old Ruins Discovered',
    description:
      'Workers uncover weathered stone foundations outside the settled fields. The place may hold salvage, secrets, or dangers best left buried.',
    rarity: 'uncommon',
    weight: 7,
    cooldownTurns: 21,
    options: [
      {
        id: 'salvage-stone',
        title: 'Salvage the Stone',
        outcomeDescription:
          'Strip the ruins for useful masonry. Gain 20 Stone.',
        outcome: {
          resourceEffects: { stone: 20 },
          resultText:
            'Masons reclaim dressed blocks and sound foundation stone from the ruins.',
          logSeverity: 'good',
        },
      },
      {
        id: 'fund-a-search',
        title: 'Fund a Search',
        outcomeDescription:
          'Spend 15 Gold on a careful excavation. Gain 1 Jewelry and 10 Gold worth of relics.',
        requirements: {
          minResources: { gold: 15 },
        },
        outcome: {
          resourceEffects: { gold: -5, jewelry: 1 },
          resultText:
            'The excavation is slow but rewarding. A handful of relics and ornaments are carried back to the treasury.',
          logSeverity: 'good',
        },
      },
      {
        id: 'seal-the-site',
        title: 'Seal the Site',
        outcomeDescription:
          'Spend nothing and leave the place undisturbed. Lose the opportunity, but avoid risk.',
        outcome: {
          resultText:
            'You order the site marked and left alone. The workers grumble, but the matter ends there.',
          logSeverity: 'neutral',
        },
      },
    ],
  },
  'mine-shaft-collapse': {
    id: 'mine-shaft-collapse',
    title: 'Mine Shaft Collapse',
    description:
      'A timber support gives way in one of your mines. Dust, splintered beams, and frightened workers choke the shaft while foremen await orders.',
    rarity: 'uncommon',
    weight: 8,
    cooldownTurns: 21,
    conditions: {
      minBuildingCounts: { mine: 1 },
    },
    options: [
      {
        id: 'fund-repairs',
        title: 'Fund Repairs',
        outcomeDescription:
          'Spend 15 Wood and 10 Gold to shore up the mine and calm the workers.',
        requirements: {
          minResources: { wood: 15, gold: 10 },
        },
        outcome: {
          resourceEffects: { wood: -15, gold: -10 },
          reputationEffects: { 'common-folk': 2 },
          resultText:
            'Fresh supports are hauled in before dusk. The shaft is made safe, and the miners return to work grateful for the swift response.',
          logSeverity: 'good',
        },
      },
      {
        id: 'press-on-cheaply',
        title: 'Patch It Cheaply',
        outcomeDescription:
          'Spend 5 Wood only. Save coin now, but morale suffers.',
        requirements: {
          minResources: { wood: 5 },
        },
        outcome: {
          resourceEffects: { wood: -5 },
          reputationEffects: { 'common-folk': -2 },
          resultText:
            'The foremen prop the shaft with whatever timber they can find. Production resumes, but confidence does not.',
          logSeverity: 'bad',
        },
      },
      {
        id: 'close-the-shaft',
        title: 'Close the Shaft',
        outcomeDescription:
          'Abandon the damaged section. Lose 15 Gold in disrupted output.',
        outcome: {
          resourceEffects: { gold: -15 },
          resultText:
            'The damaged section is sealed and the miners dispersed. The loss is manageable, but it stings.',
          logSeverity: 'neutral',
        },
      },
    ],
  },
  'wandering-veterans': {
    id: 'wandering-veterans',
    title: 'Wandering Veterans',
    description:
      'A company of seasoned fighters, worn by old campaigns, offers its service. They ask for good coin, but their discipline is obvious at a glance.',
    rarity: 'rare',
    weight: 5,
    cooldownTurns: 28,
    conditions: {
      requiredTechnologies: ['mil-drill-doctrine'],
    },
    options: [
      {
        id: 'hire-footmen',
        title: 'Hire the Veterans',
        outcomeDescription:
          'Spend 35 Gold to enlist 2 Footmen and 1 Archer immediately.',
        requirements: {
          minResources: { gold: 35 },
        },
        outcome: {
          resourceEffects: { gold: -35 },
          unitRewards: [
            { unitId: 'footman', count: 2 },
            { unitId: 'archer', count: 1 },
          ],
          resultText:
            'The veterans swear service and drill your men before sunset. Their presence stiffens the whole garrison.',
          logSeverity: 'good',
        },
      },
      {
        id: 'pay-them-to-move-on',
        title: 'Pay Them to Move On',
        outcomeDescription:
          'Spend 10 Gold to avoid trouble and send them elsewhere.',
        requirements: {
          minResources: { gold: 10 },
        },
        outcome: {
          resourceEffects: { gold: -10 },
          resultText:
            'They take your coin with a shrug and continue down the road.',
          logSeverity: 'neutral',
        },
      },
      {
        id: 'refuse-them',
        title: 'Refuse Them',
        outcomeDescription:
          'Keep your coin. The men leave insulted, and your military advisor disapproves.',
        outcome: {
          reputationEffects: { 'military-advisor': -3 },
          resultText:
            'The company departs in bad temper. Word spreads that seasoned steel was turned away.',
          logSeverity: 'bad',
        },
      },
    ],
  },
  'forest-raiders': {
    id: 'forest-raiders',
    title: 'Forest Raiders',
    description:
      'Messengers report armed raiders emerging from the woodline, enraged by relentless logging and ready to strike outlying holdings unless answered at once.',
    rarity: 'rare',
    weight: 4,
    cooldownTurns: 28,
    conditions: {
      minSignals: { 'forest-chopped': 6 },
      minTurn: 8,
    },
    options: [
      {
        id: 'appease-the-raiders',
        title: 'Appease Them',
        outcomeDescription:
          'Send gifts of timber and silver. Spend 20 Wood and 15 Gold to avert violence.',
        requirements: {
          minResources: { wood: 20, gold: 15 },
        },
        outcome: {
          resourceEffects: { wood: -20, gold: -15 },
          signalEffects: { 'forest-chopped': -4 },
          resultText:
            'The raiders accept the wagons and melt back into the trees. Tension eases, though the lesson is expensive.',
          logSeverity: 'neutral',
        },
      },
      {
        id: 'meet-them-in-battle',
        title: 'Meet Them in Battle',
        outcomeDescription:
          'Gather your troops and drive the raiders off in open combat.',
        requirements: {
          minAvailableUnits: 4,
        },
        outcome: {
          signalEffects: { 'forest-chopped': -3 },
          startBattle: {
            name: 'Forest Raiders',
            player: {
              label: 'Player',
              morale: 64,
            },
            enemy: {
              label: 'Raiders',
              morale: 56,
              units: { militia: 8, archer: 4 },
            },
            rewardMultiplier: 0.9,
          },
          resultText:
            'Your banners are raised and the raiders challenged in the open. The matter will now be settled by force.',
          logSeverity: 'bad',
        },
      },
      {
        id: 'do-nothing',
        title: 'Do Nothing',
        outcomeDescription:
          'Ignore the warning. Lose 30 Wood and 10 Gold to raids on the frontier.',
        outcome: {
          resourceEffects: { wood: -30, gold: -10 },
          reputationEffects: { 'common-folk': -3, 'military-advisor': -2 },
          signalEffects: { 'forest-chopped': -2 },
          resultText:
            'Smoke rises from the frontier camps by morning. Storehouses are looted before your patrols can react.',
          logSeverity: 'bad',
        },
      },
    ],
  },
  'barbarian-invasion': {
    id: 'barbarian-invasion',
    title: 'Barbarian Invasion',
    description:
      'Scouts race in from the frontier with grim news: the clans beaten back during your conquest have gathered again and now descend upon the province in force.',
    rarity: 'rare',
    weight: 6,
    cooldownTurns: 24,
    conditions: {
      requiredPrehistory: 'military-campaign',
      minTurn: 10,
    },
    options: [
      {
        id: 'muster-the-host',
        title: 'Muster the Host',
        outcomeDescription:
          'Call your troops to arms and meet the invasion in battle.',
        requirements: {
          minAvailableUnits: 4,
        },
        outcome: {
          startBattle: {
            name: 'Barbarian Invasion',
            player: {
              label: 'Defenders',
              morale: 68,
            },
            enemy: {
              label: 'Barbarians',
              morale: 61,
              units: { militia: 10, footman: 4, archer: 2 },
            },
            rewardMultiplier: 1.1,
          },
          resultText:
            'The levy horns sound across the province and your banners gather to meet the invaders head-on.',
          logSeverity: 'bad',
        },
      },
      {
        id: 'fortify-the-settlements',
        title: 'Fortify the Settlements',
        outcomeDescription:
          'Spend 25 Wood and 15 Stone to harden roads, watchposts, and storehouses against the assault.',
        requirements: {
          minResources: { wood: 25, stone: 15 },
        },
        outcome: {
          resourceEffects: { wood: -25, stone: -15 },
          reputationEffects: { 'military-advisor': 2, 'common-folk': 1 },
          resultText:
            'Timber palisades rise in haste and the settlers brace behind fresh earthworks. The invasion breaks against prepared defenses.',
          logSeverity: 'good',
        },
      },
      {
        id: 'yield-the-frontier',
        title: 'Yield the Frontier',
        outcomeDescription:
          'Abandon exposed holdings and preserve the heartland. Lose 25 Gold and 20 Meat.',
        outcome: {
          resourceEffects: { gold: -25, meat: -20 },
          reputationEffects: { 'common-folk': -2, 'military-advisor': -3 },
          resultText:
            'Outlying hamlets are stripped and evacuated. The core of the province survives, but the retreat carries a bitter political cost.',
          logSeverity: 'bad',
        },
      },
    ],
  },
} as const satisfies Record<string, RandomEventDefinition>;
