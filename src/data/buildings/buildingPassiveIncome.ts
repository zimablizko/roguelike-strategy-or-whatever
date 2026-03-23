import type { BuildingPassiveIncome } from '../../_common/models/buildings.models';

export const buildingPassiveIncome: Record<string, BuildingPassiveIncome[]> = {
  castle: [
    { resourceType: 'gold', amount: 1 },
    { resourceType: 'wood', amount: 1 },
  ],
  lumbermill: [{ resourceType: 'wood', amount: 1 }],
  mine: [{ resourceType: 'stone', amount: 'random:1:3' }],
  'hunters-hut': [{ resourceType: 'meat', amount: 'random:1:2' }],
};
