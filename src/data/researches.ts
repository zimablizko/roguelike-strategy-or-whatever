import type {
  ResearchDefinition,
  ResearchId,
  ResearchTreeId,
  TypedResearchDefinition,
} from '../_common/models/researches.models';

export const researchTreeInfo: Record<
  ResearchTreeId,
  {
    name: string;
    colorHex: string;
  }
> = {
  economics: {
    name: 'Economics',
    colorHex: '#52b66f',
  },
  politics: {
    name: 'Politics',
    colorHex: '#4f86dc',
  },
  military: {
    name: 'Military',
    colorHex: '#cf5d5d',
  },
};

export const researchTreeOrder: ResearchTreeId[] = [
  'economics',
  'politics',
  'military',
];

export const researchDefinitions = {
  'eco-agriculture': {
    id: 'eco-agriculture',
    tree: 'economics',
    name: 'Agriculture',
    description: 'Unlocks Farm construction through organized crop rotation and field management.',
    turns: 2,
    requiredResearches: [],
  },
  'eco-tax-collection': {
    id: 'eco-tax-collection',
    tree: 'economics',
    name: 'Tax Collection',
    description: 'Establishes regular tax registers. Houses passively generate +2 Gold per turn.',
    turns: 2,
    requiredResearches: [],
  },
  'eco-forestry': {
    id: 'eco-forestry',
    tree: 'economics',
    name: 'Forestry',
    description: 'Systematic woodland management techniques. Unlocks Plant Trees action for Lumbermills.',
    turns: 3,
    requiredResearches: ['eco-agriculture'],
  },
  'eco-mining': {
    id: 'eco-mining',
    tree: 'economics',
    name: 'Mining',
    description: 'Unlocks Mine construction with systematic ore extraction and quarry methods.',
    turns: 3,
    requiredResearches: ['eco-agriculture'],
  },
  'eco-coin-minting': {
    id: 'eco-coin-minting',
    tree: 'economics',
    name: 'Coin Minting',
    description: 'Unified coinage system for predictable exchange rates.',
    turns: 4,
    requiredResearches: ['eco-forestry'],
  },
  'eco-trade-caravans': {
    id: 'eco-trade-caravans',
    tree: 'economics',
    name: 'Trade Caravans',
    description: 'Organized caravan networks connecting distant settlements.',
    turns: 4,
    requiredResearches: ['eco-coin-minting', 'eco-mining'],
  },
  'pol-clan-council': {
    id: 'pol-clan-council',
    tree: 'politics',
    name: 'Clan Council',
    description: 'Formal council to resolve disputes between major families.',
    turns: 2,
    requiredResearches: [],
  },
  'pol-civil-code': {
    id: 'pol-civil-code',
    tree: 'politics',
    name: 'Civil Code',
    description: 'Unified legal code for courts, contracts, and property.',
    turns: 3,
    requiredResearches: ['pol-clan-council'],
  },
  'pol-tax-census': {
    id: 'pol-tax-census',
    tree: 'politics',
    name: 'Tax Census',
    description: 'Regular census and tax rolls to increase state control.',
    turns: 3,
    requiredResearches: ['pol-civil-code'],
  },
  'pol-provincial-governors': {
    id: 'pol-provincial-governors',
    tree: 'politics',
    name: 'Provincial Governors',
    description: 'Delegated administration in outer districts.',
    turns: 4,
    requiredResearches: ['pol-civil-code'],
  },
  'pol-state-bureaucracy': {
    id: 'pol-state-bureaucracy',
    tree: 'politics',
    name: 'State Bureaucracy',
    description: 'Professionalized offices for durable governance.',
    turns: 5,
    requiredResearches: ['pol-tax-census', 'pol-provincial-governors'],
  },
  'mil-drill-doctrine': {
    id: 'mil-drill-doctrine',
    tree: 'military',
    name: 'Drill Doctrine',
    description: 'Standardized battlefield drills for regular troops.',
    turns: 2,
    requiredResearches: [],
  },
  'mil-iron-weapons': {
    id: 'mil-iron-weapons',
    tree: 'military',
    name: 'Iron Weapons',
    description: 'Improved forging methods for durable iron arms.',
    turns: 3,
    requiredResearches: ['mil-drill-doctrine'],
  },
  'mil-fortification-engineering': {
    id: 'mil-fortification-engineering',
    tree: 'military',
    name: 'Fortification Engineering',
    description: 'Advanced wall and tower construction techniques.',
    turns: 3,
    requiredResearches: ['mil-drill-doctrine'],
  },
  'mil-siege-tactics': {
    id: 'mil-siege-tactics',
    tree: 'military',
    name: 'Siege Tactics',
    description: 'Coordinated assault planning against defended positions.',
    turns: 4,
    requiredResearches: ['mil-iron-weapons'],
  },
  'mil-standing-army': {
    id: 'mil-standing-army',
    tree: 'military',
    name: 'Standing Army',
    description: 'Permanent trained army with strict command hierarchy.',
    turns: 5,
    requiredResearches: ['mil-fortification-engineering', 'mil-siege-tactics'],
  },
} as const satisfies Record<string, ResearchDefinition>;

export function isResearchId(id: string): id is ResearchId {
  return Object.prototype.hasOwnProperty.call(researchDefinitions, id);
}

export function getResearchDefinition(
  id: ResearchId
): TypedResearchDefinition | undefined {
  return researchDefinitions[id] as TypedResearchDefinition | undefined;
}

export function getAllResearchDefinitions(): TypedResearchDefinition[] {
  return Object.values(researchDefinitions) as TypedResearchDefinition[];
}
