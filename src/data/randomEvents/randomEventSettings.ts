import type {
  RandomEventRarity,
  RandomEventSignalId,
} from '../../_common/models/random-events.models';

/** Random-event cadence: one roll every 7 turns. */
export const RANDOM_EVENT_INTERVAL_TURNS = 7;

/** Weekly chance that an eligible event actually occurs. */
export const RANDOM_EVENT_WEEKLY_TRIGGER_CHANCE = 0.85;

/** Selection multiplier applied on top of each event definition weight. */
export const RANDOM_EVENT_RARITY_WEIGHTS: Record<RandomEventRarity, number> = {
  common: 1,
  uncommon: 0.6,
  rare: 0.3,
};

/** Human-readable labels for tracked event signals. */
export const RANDOM_EVENT_SIGNAL_LABELS: Record<RandomEventSignalId, string> = {
  'forest-chopped': 'Forest tiles chopped',
  'forest-restored': 'Forest tiles restored',
};
