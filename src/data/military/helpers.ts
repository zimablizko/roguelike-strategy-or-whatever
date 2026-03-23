import type {
  BattleCommandDefinition,
  BattleCommandId,
  BattleStatusDefinition,
  BattleStatusId,
  UnitDefinition,
  UnitRole,
} from '../../_common/models/military.models';
import { battleCommandDefinitions } from './unitCommands';
import { battleStatusDefinitions } from './unitStatuses';
import { unitDefinitions, type MilitaryUnitId } from './unitDefinitions';

/**
 * Get unit definition by role id. Returns undefined if not found.
 */
export function getUnitDefinition(id: UnitRole): UnitDefinition | undefined {
  return unitDefinitions[id as MilitaryUnitId] as UnitDefinition | undefined;
}

/**
 * Get all unit definitions as an array.
 */
export function getAllUnitDefinitions(): UnitDefinition[] {
  return Object.values(unitDefinitions) as UnitDefinition[];
}

export function getBattleCommandDefinition(
  id: BattleCommandId
): BattleCommandDefinition | undefined {
  return battleCommandDefinitions[id];
}

export function getBattleStatusDefinition(
  id: BattleStatusId
): BattleStatusDefinition | undefined {
  return battleStatusDefinitions[id];
}

export function getUnitBattleCommands(
  unitId: UnitRole
): BattleCommandDefinition[] {
  const def = getUnitDefinition(unitId);
  if (!def) return [];
  return def.commandIds
    .map((commandId) => getBattleCommandDefinition(commandId))
    .filter(
      (command): command is BattleCommandDefinition => command !== undefined
    );
}

/**
 * Check if a string is a valid unit role id.
 */
export function isUnitRole(id: string): id is UnitRole {
  return Object.prototype.hasOwnProperty.call(unitDefinitions, id);
}
