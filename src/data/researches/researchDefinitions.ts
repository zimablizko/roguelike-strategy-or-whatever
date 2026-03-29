import type { ResearchDefinition } from '../../_common/models/researches.models';

export const researchDefinitions = {
  'eco-agriculture': {
    id: 'eco-agriculture',
    tree: 'economics',
    name: 'Agriculture',
    description:
      'Unlocks Farm construction through organized crop rotation and field management.',
    turns: 2,
    requiredResearches: [],
  },
  'eco-tax-collection': {
    id: 'eco-tax-collection',
    tree: 'economics',
    name: 'Tax Collection',
    description:
      'Establishes regular tax registers. Houses passively generate +2 Gold per turn.',
    turns: 2,
    requiredResearches: [],
  },
  'eco-forestry': {
    id: 'eco-forestry',
    tree: 'economics',
    name: 'Forestry',
    description:
      'Systematic woodland management techniques. Unlocks Plant Trees action for Lumbermills.',
    turns: 3,
    requiredResearches: ['eco-agriculture'],
  },
  'eco-mining': {
    id: 'eco-mining',
    tree: 'economics',
    name: 'Mining',
    description:
      'Unlocks Mine construction with systematic ore extraction and quarry methods.',
    turns: 3,
    requiredResearches: ['eco-agriculture'],
  },
  'eco-crop-rotation': {
    id: 'eco-crop-rotation',
    tree: 'economics',
    name: 'Crop Rotation',
    description:
      'Advanced field management techniques. Farms in Harvest mode gather 2 fields at once. Field regrow period reduced from 12 to 6 turns.',
    turns: 4,
    requiredResearches: ['eco-forestry'],
  },
  'eco-trade-caravans': {
    id: 'eco-trade-caravans',
    tree: 'economics',
    name: 'Trade Caravans',
    description: 'Organized caravan networks connecting distant settlements.',
    turns: 4,
    requiredResearches: ['eco-crop-rotation', 'eco-mining'],
  },
  'pol-clan-council': {
    id: 'pol-clan-council',
    tree: 'politics',
    name: 'Administration',
    description:
      'Establishes a formal administration. Appoints Advisors of Economy, Politics, and Military to the Town Hall.',
    turns: 2,
    requiredResearches: [],
  },
  'pol-public-hearings': {
    id: 'pol-public-hearings',
    tree: 'politics',
    name: 'Public Hearings',
    description:
      'Formalizes the Common Folk voice. Approving Folk requests grants +2 additional reputation.',
    turns: 3,
    requiredResearches: ['pol-clan-council'],
  },
  'pol-civil-code': {
    id: 'pol-civil-code',
    tree: 'politics',
    name: 'Civil Code',
    description:
      'Codifies laws and governance. Deny reputation penalty reduced from −3 to −1.',
    turns: 3,
    requiredResearches: ['pol-clan-council'],
  },
  'pol-tax-census': {
    id: 'pol-tax-census',
    tree: 'politics',
    name: 'Tax Census',
    description: 'Economy Advisor delegation unlocked at Favorable reputation.',
    turns: 3,
    requiredResearches: ['pol-civil-code'],
  },
  'pol-provincial-governors': {
    id: 'pol-provincial-governors',
    tree: 'politics',
    name: 'Provincial Governors',
    description:
      'Politics Advisor delegation unlocked at Favorable reputation.',
    turns: 4,
    requiredResearches: ['pol-civil-code'],
  },
  'pol-military-liaison': {
    id: 'pol-military-liaison',
    tree: 'politics',
    name: 'Military Liaison',
    description:
      'Military Advisor delegation unlocked at Favorable reputation.',
    turns: 4,
    requiredResearches: ['pol-civil-code', 'mil-drill-doctrine'],
  },
  'pol-state-bureaucracy': {
    id: 'pol-state-bureaucracy',
    tree: 'politics',
    name: 'State Bureaucracy',
    description:
      'All delegation thresholds lowered to Neutral. Entities generate requests more frequently.',
    turns: 5,
    requiredResearches: ['pol-tax-census', 'pol-provincial-governors'],
  },
  'mil-drill-doctrine': {
    id: 'mil-drill-doctrine',
    tree: 'military',
    name: 'Standing Army',
    description:
      'Establishes permanent troop levies and a formal barracks system. Unlocks Barracks construction and Footmen training.',
    turns: 2,
    requiredResearches: [],
  },
  'mil-fletching': {
    id: 'mil-fletching',
    tree: 'military',
    name: 'Fletching',
    description:
      'Standardized bowcraft and arrow-making. Unlocks Archer training at Barracks.',
    turns: 3,
    requiredResearches: ['mil-drill-doctrine'],
  },
  'mil-iron-weapons': {
    id: 'mil-iron-weapons',
    tree: 'military',
    name: 'Iron Weapons',
    description:
      'Improved forging methods for durable iron arms. All Footmen gain +1 power.',
    turns: 3,
    requiredResearches: ['mil-drill-doctrine'],
  },
  'mil-fortification-engineering': {
    id: 'mil-fortification-engineering',
    tree: 'military',
    name: 'Fortification Engineering',
    description:
      'Advanced wall and tower construction techniques for hardened military infrastructure.',
    turns: 3,
    requiredResearches: ['mil-drill-doctrine'],
  },
  'mil-siege-tactics': {
    id: 'mil-siege-tactics',
    tree: 'military',
    name: 'Siege Tactics',
    description:
      'Coordinated assault planning against defended positions and long sieges.',
    turns: 4,
    requiredResearches: ['mil-iron-weapons'],
  },
  'mil-standing-army': {
    id: 'mil-standing-army',
    tree: 'military',
    name: 'Army Logistics',
    description:
      'Permanent supply chains and depot planning. Doubles garrison capacity per Barracks and reduces all unit upkeep by 1 meat.',
    turns: 5,
    requiredResearches: ['mil-fortification-engineering', 'mil-siege-tactics'],
  },
} as const satisfies Record<string, ResearchDefinition>;
