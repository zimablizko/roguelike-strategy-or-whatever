import { Color } from 'excalibur';
import { getIconSprite, getResourceIcon } from '../../_common/icons';
import type { ResourceCost, ResourceType } from '../../_common/models/resource.models';
import type { TooltipOutcome } from '../../_common/models/tooltip.models';
import type { ResourceManager } from '../../managers/ResourceManager';

export type TooltipResourceKey = ResourceType | 'focus' | 'food';
export type TooltipResourceSectionLabel =
  | 'Costs'
  | 'Gains'
  | 'Each turn'
  | 'Permanent'
  | 'Upkeep';

export interface TooltipResourceEntry {
  resourceType: TooltipResourceKey;
  amount: number | string;
  available?: number;
}

export interface TooltipEffectSectionOptions {
  resourceEffects?: Partial<Record<ResourceType, number>>;
  focusDelta?: number;
  resourceManager?: ResourceManager;
  focusAvailable?: number;
}

const COST_OK_COLOR = Color.fromHex('#ecf3fa');
const COST_BAD_COLOR = Color.fromHex('#e05252');
const GAIN_COLOR = Color.fromHex('#52b66f');

export function buildTooltipCostEntries(
  cost: ResourceCost,
  resourceManager?: ResourceManager
): TooltipResourceEntry[] {
  return Object.entries(cost)
    .filter(([, amount]) => typeof amount === 'number' && amount > 0)
    .map(([resourceType, amount]) => ({
      resourceType: resourceType as ResourceType,
      amount,
      available: resourceManager?.getResource(resourceType as ResourceType),
    }));
}

export function buildTooltipEffectResourceSections(
  options: TooltipEffectSectionOptions
): TooltipOutcome[] {
  const costEntries: TooltipResourceEntry[] = [];
  const gainEntries: TooltipResourceEntry[] = [];

  if (options.focusDelta !== undefined && options.focusDelta !== 0) {
    if (options.focusDelta < 0) {
      costEntries.push({
        resourceType: 'focus',
        amount: Math.abs(options.focusDelta),
        available: options.focusAvailable,
      });
    } else {
      gainEntries.push({
        resourceType: 'focus',
        amount: options.focusDelta,
      });
    }
  }

  if (options.resourceEffects) {
    for (const [resourceType, amount] of Object.entries(options.resourceEffects)) {
      if (!amount) {
        continue;
      }

      if (amount < 0) {
        costEntries.push({
          resourceType: resourceType as ResourceType,
          amount: Math.abs(amount),
          available: options.resourceManager?.getResource(resourceType as ResourceType),
        });
      } else {
        gainEntries.push({
          resourceType: resourceType as ResourceType,
          amount,
        });
      }
    }
  }

  return [
    ...buildTooltipResourceSection('Costs', costEntries),
    ...buildTooltipResourceSection('Gains', gainEntries),
  ];
}

export function buildTooltipResourceSection(
  label: TooltipResourceSectionLabel,
  entries: TooltipResourceEntry[]
): TooltipOutcome[] {
  if (entries.length === 0) {
    return [];
  }

  const isCostSection = label === 'Costs' || label === 'Upkeep';

  return entries.map((entry, index) => {
    const missing = getMissingAmount(entry);
    const displayValue = isCostSection
      ? formatCostAmount(entry.amount, missing)
      : formatGainAmount(entry.amount);

    return {
      label: index === 0 ? label : '',
      icon: getTooltipResourceIcon(entry.resourceType),
      value: displayValue,
      color: isCostSection
        ? missing > 0
          ? COST_BAD_COLOR
          : COST_OK_COLOR
        : GAIN_COLOR,
      inline: true,
    };
  });
}

function getMissingAmount(entry: TooltipResourceEntry): number {
  if (typeof entry.amount !== 'number' || entry.available === undefined) {
    return 0;
  }
  return Math.max(0, entry.amount - entry.available);
}

function formatCostAmount(amount: number | string, missing: number): string {
  const text = typeof amount === 'number' ? `${amount}` : amount;
  return missing > 0 ? `${text} (-${missing})` : text;
}

function formatGainAmount(amount: number | string): string {
  if (typeof amount === 'number') {
    return `+${amount}`;
  }
  if (amount.startsWith('+')) {
    return amount;
  }
  return `+${amount}`;
}

function getTooltipResourceIcon(resourceType: TooltipResourceKey) {
  if (resourceType === 'focus') {
    return getIconSprite('focus');
  }
  if (resourceType === 'food') {
    return getResourceIcon('food');
  }
  return getResourceIcon(resourceType);
}
