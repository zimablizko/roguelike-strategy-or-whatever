import type { StateBuildingId } from '../../_common/models/buildings.models';
import { stateBuildingDefinitions } from './buildingDefinitions';

/** Helper to create an empty building count record. */
export function createEmptyBuildingRecord(): Record<StateBuildingId, number> {
  const record = {} as Record<StateBuildingId, number>;
  for (const key of Object.keys(
    stateBuildingDefinitions
  ) as StateBuildingId[]) {
    record[key] = 0;
  }
  return record;
}
