import type { PoliticalEntityId } from '../../_common/models/politics.models';

/** Entity display definitions (name mapping). */
export const politicalEntityDefinitions: ReadonlyArray<{
  id: PoliticalEntityId;
  name: string;
}> = [
  { id: 'common-folk', name: 'Common Folk' },
  { id: 'economy-advisor', name: 'Economy Advisor' },
  { id: 'military-advisor', name: 'Military Advisor' },
  { id: 'politics-advisor', name: 'Politics Advisor' },
];
