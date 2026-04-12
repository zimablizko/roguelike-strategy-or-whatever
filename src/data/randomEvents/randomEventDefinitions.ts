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
          'Grant stall permits and market rights for the fair.',
        outcome: {
          resourceEffects: { gold: 20 },
          resultText:
            'The visiting merchants pay for stall space, clerks, and market rights. Trade flows smoothly and the treasury takes its share.',
          logSeverity: 'neutral',
        },
      },
      {
        id: 'host-the-market',
        title: 'Charm the Caravan Master',
        outcomeDescription:
          'Offer a gracious welcome and try to win richer gifts with personal charm.',
        requirements: {
          minResources: { gold: 5 },
        },
        skillCheck: {
          skill: 'charisma',
          difficulty: 'normal',
          successOutcome: {
            resourceEffects: { gold: -5, jewelry: 1 },
            reputationEffects: { 'common-folk': 3 },
            resultText:
              'The square fills with buyers, songs, and coin. The merchants leave pleased, and the people remember your generosity.',
            logSeverity: 'good',
          },
          failureOutcome: {
            resourceEffects: { gold: -5 },
            reputationEffects: { 'common-folk': 1 },
            resultText:
              'Your welcome is courteous, but the caravan keeps its best wares close and departs after only modest trade.',
            logSeverity: 'neutral',
          },
        },
      },
      {
        id: 'hire-guards',
        title: 'Hire Guards',
        outcomeDescription:
          'Recruit armed escorts from the merchant roads.',
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
          'Strip the ruins for useful masonry.',
        outcome: {
          resourceEffects: { stone: 20 },
          resultText:
            'Masons reclaim dressed blocks and sound foundation stone from the ruins.',
          logSeverity: 'good',
        },
      },
      {
        id: 'fund-a-search',
        title: 'Question the Antiquarians',
        outcomeDescription:
          'Bring in scholars and press them for a promising lead before the dig begins.',
        requirements: {
          minResources: { gold: 10 },
        },
        skillCheck: {
          skill: 'charisma',
          difficulty: 'hard',
          successOutcome: {
            resourceEffects: { gold: -10, jewelry: 1, stone: 10 },
            resultText:
              'The antiquarians respond to your interest with uncommon enthusiasm. Their guidance uncovers decorated stonework and a cache of ornaments worth the expense.',
            logSeverity: 'good',
          },
          failureOutcome: {
            resourceEffects: { gold: -10 },
            resultText:
              'The scholars disagree, the dig spreads in the wrong direction, and the funded search yields little beyond dust and notes.',
            logSeverity: 'bad',
          },
        },
      },
      {
        id: 'seal-the-site',
        title: 'Seal the Site',
        outcomeDescription:
          'Leave the place undisturbed and avoid the risk.',
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
          'Shore up the mine and calm the workers.',
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
          'Brace the shaft cheaply and save coin, even if morale suffers.',
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
          'Abandon the damaged section and accept the disrupted output.',
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
          'Enlist the veterans into immediate service.',
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
        title: 'Bargain for Service',
        outcomeDescription:
          'Try to talk the veterans into a cheaper oath of service.',
        requirements: {
          minResources: { gold: 20 },
        },
        skillCheck: {
          skill: 'charisma',
          difficulty: 'hard',
          successOutcome: {
            resourceEffects: { gold: -20 },
            unitRewards: [
              { unitId: 'footman', count: 2 },
              { unitId: 'archer', count: 1 },
            ],
            reputationEffects: { 'military-advisor': 2 },
            resultText:
              'Your offer lands well. The veterans accept leaner pay for honorable terms and enter your service before nightfall.',
            logSeverity: 'good',
          },
          failureOutcome: {
            resourceEffects: { gold: -10 },
            resultText:
              'The company scoffs at the bargain, pockets a token payment for wasted time, and marches on.',
            logSeverity: 'neutral',
          },
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
        title: 'Parley at the Woodline',
        outcomeDescription:
          'Ride out with gifts and attempt to calm the raiders before blood is spilled.',
        requirements: {
          minResources: { wood: 10, gold: 5 },
        },
        skillCheck: {
          skill: 'charisma',
          difficulty: 'very-hard',
          successOutcome: {
            resourceEffects: { wood: -10, gold: -5 },
            signalEffects: { 'forest-chopped': -4 },
            reputationEffects: { 'common-folk': 1 },
            resultText:
              'You meet the raiders beneath the trees and speak plainly enough to cool their fury. They accept a smaller tribute and disperse.',
            logSeverity: 'good',
          },
          failureOutcome: {
            resourceEffects: { wood: -20, gold: -10 },
            signalEffects: { 'forest-chopped': -2 },
            reputationEffects: { 'common-folk': -1 },
            resultText:
              'The parley turns sour. You salvage peace only by sending heavier tribute after tempers flare at the woodline.',
            logSeverity: 'bad',
          },
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
          'Ignore the warning and accept whatever the raiders take from the frontier.',
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
          'Harden roads, watchposts, and storehouses against the assault.',
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
          'Abandon exposed holdings and preserve the heartland.',
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
  'bumper-harvest': {
    id: 'bumper-harvest',
    title: 'Bumper Harvest',
    description:
      'The fields ripen thick and early this season. Granaries strain, ovens smoke from dawn, and village elders ask how the surplus should be used before it spoils or is squandered.',
    rarity: 'common',
    weight: 9,
    cooldownTurns: 18,
    conditions: {
      requiredTechnologies: ['eco-agriculture'],
      minBuildingCounts: { farm: 1 },
      minTurn: 4,
    },
    options: [
      {
        id: 'store-the-grain',
        title: 'Store the Surplus',
        outcomeDescription:
          'Pack the granaries and bake what can be preserved for later.',
        outcome: {
          resourceEffects: { wheat: 18, bread: 10 },
          resultText:
            'Granaries are filled to the rafters and the village ovens work without pause. The realm enters the next stretch of seasons better provisioned than expected.',
          logSeverity: 'good',
        },
      },
      {
        id: 'hold-a-harvest-fair',
        title: 'Hold a Harvest Fair',
        outcomeDescription:
          'Turn the surplus into a public celebration and trading day.',
        requirements: {
          minResources: { gold: 5 },
        },
        skillCheck: {
          skill: 'charisma',
          difficulty: 'normal',
          successOutcome: {
            resourceEffects: { gold: 15 },
            reputationEffects: { 'common-folk': 3, 'economy-advisor': 1 },
            resultText:
              'Your presence turns the gathering into a proper fair. Traders linger, villagers spend freely, and the treasury benefits along with your standing.',
            logSeverity: 'good',
          },
          failureOutcome: {
            resourceEffects: { gold: 5 },
            reputationEffects: { 'common-folk': 1 },
            resultText:
              'The celebration is pleasant enough, but trade remains modest and most of the benefit ends in full bellies rather than fuller coffers.',
            logSeverity: 'neutral',
          },
        },
      },
      {
        id: 'feed-the-herds',
        title: 'Feed the Herds',
        outcomeDescription:
          'Divert part of the grain to drovers and breeders to strengthen livestock stocks.',
        requirements: {
          minResources: { wheat: 8 },
        },
        outcome: {
          resourceEffects: { wheat: -8, meat: 14 },
          resultText:
            'The grain goes to feed pens and drovers instead of storehouses. Herds fatten quickly, and butchers report a stronger supply than usual.',
          logSeverity: 'good',
        },
      },
    ],
  },
  'tax-dispute': {
    id: 'tax-dispute',
    title: 'Tax Dispute',
    description:
      'A district collector and several village elders arrive together, each accusing the other of lies. Records, levies, and bruised pride have become one tangled matter, and all demand judgment from the throne.',
    rarity: 'uncommon',
    weight: 7,
    cooldownTurns: 20,
    conditions: {
      requiredTechnologies: ['pol-tax-census'],
      minTurn: 6,
    },
    options: [
      {
        id: 'hear-the-petitioners',
        title: 'Hear Both Sides',
        outcomeDescription:
          'Take the matter personally and try to untangle anger, recordkeeping, and half-truths in open hearing.',
        skillCheck: {
          skill: 'charisma',
          difficulty: 'hard',
          successOutcome: {
            resourceEffects: { gold: -5 },
            reputationEffects: { 'common-folk': 4, 'politics-advisor': 2 },
            resultText:
              'You calm the room, expose the worst exaggerations, and force a settlement that feels stern but fair. The dispute ends with more respect than resentment.',
            logSeverity: 'good',
          },
          failureOutcome: {
            reputationEffects: { 'common-folk': -2, 'politics-advisor': -1 },
            resultText:
              'The hearing drags into accusation and posturing. No side leaves satisfied, and your intervention only deepens the sense of disorder.',
            logSeverity: 'bad',
          },
        },
      },
      {
        id: 'back-the-collector',
        title: 'Back the Collector',
        outcomeDescription:
          'Rule in favor of revenue and make an example of resistance.',
        outcome: {
          resourceEffects: { gold: 20 },
          reputationEffects: { 'common-folk': -3, 'economy-advisor': 1 },
          resultText:
            'The collector leaves vindicated and the levies are gathered in full. The treasury gains immediately, though the villages mutter long after the case is closed.',
          logSeverity: 'bad',
        },
      },
      {
        id: 'order-an-audit',
        title: 'Order an Audit',
        outcomeDescription:
          'Order a slower but more reliable investigation with scribes and witnesses.',
        requirements: {
          minFocus: 1,
          minResources: { gold: 10 },
        },
        outcome: {
          resourceEffects: { gold: -10 },
          focusDelta: -1,
          reputationEffects: { 'politics-advisor': 2, 'economy-advisor': 1 },
          resultText:
            'Scribes are dispatched, ledgers are copied, and the district is examined line by line. The process is costly, but your court earns a reputation for discipline.',
          logSeverity: 'good',
        },
      },
    ],
  },
  'rich-ore-vein': {
    id: 'rich-ore-vein',
    title: 'Rich Ore Vein',
    description:
      'Miners break into a dense new seam below the old galleries. Foremen claim it could enrich the province for years if handled carefully, or yield a windfall quickly if worked with less patience.',
    rarity: 'uncommon',
    weight: 6,
    cooldownTurns: 21,
    conditions: {
      requiredTechnologies: ['eco-mining'],
      minBuildingCounts: { mine: 1 },
    },
    options: [
      {
        id: 'extract-carefully',
        title: 'Extract Carefully',
        outcomeDescription:
          'Use measured shifts and proper shoring to secure a steady haul.',
        outcome: {
          resourceEffects: { ironOre: 16, stone: 8 },
          resultText:
            'Surveyors mark the seam and the crews work it methodically. The yield is strong, and the mine remains stable for future work.',
          logSeverity: 'good',
        },
      },
      {
        id: 'rally-the-miners',
        title: 'Rally the Miners',
        outcomeDescription:
          'Go below in person and push the crews toward an extraordinary output.',
        skillCheck: {
          skill: 'charisma',
          difficulty: 'hard',
          successOutcome: {
            resourceEffects: { ironOre: 24 },
            reputationEffects: { 'common-folk': 1 },
            resultText:
              'Your visit stiffens backs and sharpens morale. The miners answer with a remarkable haul and talk proudly of the day the ruler came below.',
            logSeverity: 'good',
          },
          failureOutcome: {
            resourceEffects: { ironOre: 10 },
            reputationEffects: { 'common-folk': -2 },
            resultText:
              'The speech lands poorly in the choking dark. The crews produce some ore, but the strain and grumbling linger after the shift ends.',
            logSeverity: 'bad',
          },
        },
      },
      {
        id: 'sell-the-claim',
        title: 'Sell the Claim',
        outcomeDescription:
          'Lease the seam to local contractors for immediate money instead of direct extraction.',
        outcome: {
          resourceEffects: { gold: 18 },
          reputationEffects: { 'economy-advisor': 2 },
          resultText:
            'Bidders gather quickly and pay well for the rights. The realm gives up some long-term control, but the treasury feels the benefit at once.',
          logSeverity: 'neutral',
        },
      },
    ],
  },
  'festival-of-banners': {
    id: 'festival-of-banners',
    title: 'Festival of Banners',
    description:
      'A local holy day and civic celebration are set to coincide, drawing crowds into the square beneath newly dyed banners. Advisors press for a response that can turn the gathering into either loyalty, influence, or quiet disappointment.',
    rarity: 'common',
    weight: 8,
    cooldownTurns: 20,
    conditions: {
      requiredTechnologies: ['pol-public-hearings'],
      minTurn: 5,
    },
    options: [
      {
        id: 'give-a-public-address',
        title: 'Give a Public Address',
        outcomeDescription:
          'Step before the crowd and try to turn ceremony into authority.',
        skillCheck: {
          skill: 'charisma',
          difficulty: 'normal',
          successOutcome: {
            resourceEffects: { politicalPower: 12 },
            reputationEffects: { 'common-folk': 2, 'politics-advisor': 1 },
            resultText:
              'Your words strike the right balance of dignity and warmth. The crowd leaves with sharper loyalty, and your voice carries further in court afterward.',
            logSeverity: 'good',
          },
          failureOutcome: {
            resourceEffects: { politicalPower: 4 },
            resultText:
              'The speech is received politely rather than passionately. The day still reflects on your rule, but only faintly.',
            logSeverity: 'neutral',
          },
        },
      },
      {
        id: 'fund-games-and-bread',
        title: 'Fund Games and Bread',
        outcomeDescription:
          'Pay for contests, musicians, and free loaves so the day is remembered kindly.',
        requirements: {
          minResources: { gold: 10, bread: 6 },
        },
        outcome: {
          resourceEffects: { gold: -10, bread: -6 },
          reputationEffects: { 'common-folk': 4 },
          resultText:
            'Banners snap over wrestling grounds, musicians play until dusk, and free bread keeps tempers light. The people remember the day with gratitude.',
          logSeverity: 'good',
        },
      },
      {
        id: 'keep-it-modest',
        title: 'Keep It Modest',
        outcomeDescription:
          'Allow the celebration to proceed without court involvement or extra expense.',
        outcome: {
          reputationEffects: { 'common-folk': -1 },
          resultText:
            'The day passes without scandal, but also without much warmth from the throne. The crowd enjoys itself and notices your restraint.',
          logSeverity: 'neutral',
        },
      },
    ],
  },
  'smuggler-ring-exposed': {
    id: 'smuggler-ring-exposed',
    title: 'Smuggler Ring Exposed',
    description:
      'Custom clerks uncover a network of quiet warehouses, false manifests, and night carts slipping goods around your market tolls. The ring is profitable enough to be useful, dangerous enough to be hated, and organized enough to bargain.',
    rarity: 'rare',
    weight: 4,
    cooldownTurns: 28,
    conditions: {
      requiredTechnologies: ['eco-trade-caravans'],
      minBuildingCounts: { market: 1 },
      minTurn: 8,
    },
    options: [
      {
        id: 'offer-clemency-for-licenses',
        title: 'Offer Clemency for Licenses',
        outcomeDescription:
          'Try to turn smugglers into taxpayers instead of corpses or fugitives.',
        skillCheck: {
          skill: 'charisma',
          difficulty: 'very-hard',
          successOutcome: {
            resourceEffects: { gold: 25, jewelry: 1 },
            reputationEffects: { 'economy-advisor': 2 },
            resultText:
              'You offer pardons, charters, and a hard line against any future deceit. Enough of the ring accepts that the crown gains both revenue and useful trade contacts.',
            logSeverity: 'good',
          },
          failureOutcome: {
            resourceEffects: { gold: 8 },
            reputationEffects: { 'economy-advisor': -1, 'common-folk': -1 },
            resultText:
              'A few lesser operators submit, but the core of the ring vanishes with much of its wealth. The result is too soft for some and too clumsy for others.',
            logSeverity: 'neutral',
          },
        },
      },
      {
        id: 'seize-the-goods',
        title: 'Seize the Goods',
        outcomeDescription:
          'Raid the warehouses, confiscate contraband, and make public examples of the ringleaders.',
        outcome: {
          resourceEffects: { gold: 15, jewelry: 1 },
          reputationEffects: { 'common-folk': -2, 'economy-advisor': -1 },
          resultText:
            'Doors are broken, ledgers burned, and wagons hauled into crown custody. The haul is real, but so is the sense that trade in your realm has grown harsher.',
          logSeverity: 'bad',
        },
      },
      {
        id: 'buy-their-route-maps',
        title: 'Buy Their Route Maps',
        outcomeDescription:
          'Pay for information, routes, and names rather than immediate punishment.',
        requirements: {
          minResources: { gold: 10 },
        },
        outcome: {
          resourceEffects: { gold: -10, politicalPower: 8 },
          reputationEffects: { 'economy-advisor': 1, 'politics-advisor': 1 },
          resultText:
            'The ring sells you silence, route books, and the names of those who looked away. The treasury pays now, but the court gains leverage that may matter later.',
          logSeverity: 'good',
        },
      },
    ],
  },
  'bountiful-catch': {
    id: 'bountiful-catch',
    title: 'Bountiful Catch',
    description:
      'The rivers teem with silvery fish this season. Your fishermen report the largest haul anyone can remember — nets strain and baskets overflow.',
    rarity: 'common',
    weight: 8,
    cooldownTurns: 21,
    conditions: {
      minTurn: 10,
      requiredTechnologies: ['eco-fishing'],
      minBuildingCounts: { fishery: 1 },
    },
    options: [
      {
        id: 'store-the-surplus',
        title: 'Store the Surplus',
        outcomeDescription:
          'Salt and smoke the excess catch for the winter stores.',
        outcome: {
          resourceEffects: { fish: 15 },
          resultText:
            'Barrels of salted fish line the storerooms. The settlement will eat well for many days to come.',
          logSeverity: 'good',
        },
      },
      {
        id: 'sell-at-market',
        title: 'Sell at Market',
        outcomeDescription:
          'Trade the surplus fish to passing merchants for coin.',
        outcome: {
          resourceEffects: { gold: 12 },
          resultText:
            'Travelling merchants eagerly pay premium prices for the fresh catch. Gold fills the coffers.',
          logSeverity: 'good',
        },
      },
      {
        id: 'host-a-feast',
        title: 'Host a Feast',
        outcomeDescription:
          'Share the bounty with the people and boost goodwill.',
        requirements: {
          minResources: { fish: 5 },
        },
        outcome: {
          resourceEffects: { fish: -5 },
          reputationEffects: { 'common-folk': 4 },
          resultText:
            'The settlement gathers for a great riverside feast. Songs are sung, and the ruler is praised for their generosity.',
          logSeverity: 'good',
        },
      },
    ],
  },
  'river-flooding': {
    id: 'river-flooding',
    title: 'River Flooding',
    description:
      "Heavy rains upstream have swollen the rivers beyond their banks. Water laps at the foundations of your fishermen's huts and threatens nearby fields.",
    rarity: 'uncommon',
    weight: 7,
    cooldownTurns: 28,
    conditions: {
      minTurn: 15,
      requiredTechnologies: ['eco-fishing'],
      minBuildingCounts: { fishery: 1 },
    },
    options: [
      {
        id: 'sandbag-the-banks',
        title: 'Sandbag the Banks',
        outcomeDescription:
          'Protect your riverside buildings with sandbags and braces.',
        requirements: {
          minResources: { wood: 10, stone: 5 },
        },
        outcome: {
          resourceEffects: { wood: -10, stone: -5 },
          resultText:
            'Workers pile sandbags and timber braces through the night. The waters rise but the huts stand firm.',
          logSeverity: 'neutral',
        },
      },
      {
        id: 'evacuate-and-wait',
        title: 'Evacuate and Wait',
        outcomeDescription:
          'Pull the fishermen back and let the flood pass.',
        outcome: {
          resourceEffects: { fish: -8 },
          resultText:
            'The fishermen retreat to higher ground. When the waters recede, barrels of salted fish are found waterlogged and ruined.',
          logSeverity: 'bad',
        },
      },
      {
        id: 'channel-the-waters',
        title: 'Channel the Waters',
        outcomeDescription:
          'Attempt to dig emergency channels to divert the flood. Requires governance skill.',
        skillCheck: {
          skill: 'governance',
          difficulty: 'normal',
          successOutcome: {
            resourceEffects: { fish: 5, gold: 5 },
            resultText:
              'Your engineers carve diversion channels just in time. The flood waters irrigate the fields and trap fish in shallow pools — a lucky windfall.',
            logSeverity: 'good',
          },
          failureOutcome: {
            resourceEffects: { fish: -5, wood: -5 },
            resultText:
              'The hastily dug channels collapse under the pressure. Mud and debris damage stored supplies and timber stockpiles.',
            logSeverity: 'bad',
          },
        },
      },
    ],
  },
} as const satisfies Record<string, RandomEventDefinition>;
