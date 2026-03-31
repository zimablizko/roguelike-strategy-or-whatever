import type { ResourceType } from '../_common/models/resource.models';

export const MARKET_CARAVAN_INTERVAL_TURNS = 15;
export const MARKET_CARAVAN_DURATION_TURNS = 5;

export interface MarketTradeOffer {
  id: string;
  label: string;
  resourceType: ResourceType;
  amount: number;
  goldPrice: number;
}

export const MARKET_TRADE_OFFERS: readonly MarketTradeOffer[] = [
  {
    id: 'wood',
    label: 'Lumber',
    resourceType: 'wood',
    amount: 10,
    goldPrice: 10,
  },
  {
    id: 'stone',
    label: 'Stone',
    resourceType: 'stone',
    amount: 10,
    goldPrice: 15,
  },
  {
    id: 'meat',
    label: 'Meat',
    resourceType: 'meat',
    amount: 10,
    goldPrice: 5,
  },
] as const;

export function isMarketCaravanActive(turnNumber: number): boolean {
  return (
    ((Math.max(1, Math.floor(turnNumber)) - 1) % MARKET_CARAVAN_INTERVAL_TURNS) <
    MARKET_CARAVAN_DURATION_TURNS
  );
}

export function isMarketCaravanArrivalTurn(turnNumber: number): boolean {
  return (
    (Math.max(1, Math.floor(turnNumber)) - 1) % MARKET_CARAVAN_INTERVAL_TURNS ===
    0
  );
}

export function getTurnsUntilNextMarketCaravan(turnNumber: number): number {
  const normalizedTurn = Math.max(1, Math.floor(turnNumber));
  if (isMarketCaravanActive(normalizedTurn)) {
    return 0;
  }

  const cycleOffset = (normalizedTurn - 1) % MARKET_CARAVAN_INTERVAL_TURNS;
  return MARKET_CARAVAN_INTERVAL_TURNS - cycleOffset;
}
