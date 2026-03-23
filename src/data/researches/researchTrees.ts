import type { ResearchTreeId } from '../../_common/models/researches.models';

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
