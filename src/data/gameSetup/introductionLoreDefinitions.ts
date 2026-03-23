import type { StatePrehistoryId } from '../../_common/models/game-setup.models';

export interface IntroductionLoreDefinition {
  title: string;
  body: string;
}

export const introductionLoreDefinitions: Record<
  StatePrehistoryId,
  IntroductionLoreDefinition
> = {
  'distant-colony': {
    title: 'A New Reign at the Edge of the Realm',
    body:
      'Far from the royal heartland, your people build with what they can carry and what they can claim. Orders from the Crown take months to arrive, and rescue may never come at all. Here, survival will depend on discipline, judgment, and the will to carve a future from an uncertain frontier.',
  },
  'military-campaign': {
    title: 'A Banner Raised over Conquered Ground',
    body:
      'This land was won by force, not inheritance. The first camps have become roads, stockades, and watchfires, but the conquest is not yet secure. The locals remember the sword, and the frontier waits for weakness. Rule firmly, or what was taken in war may be lost before it can become a realm.',
  },
  'farmers-community': {
    title: 'A Realm Rooted in Field and Granary',
    body:
      'Your settlement began not as a fortress, but as a promise: grain for the sovereign, bread for the people, and order drawn from careful work. The land is modest, the tools are plain, and every season will test whether patience can achieve what conquest never could.',
  },
};
