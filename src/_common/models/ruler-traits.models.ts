import type { RulerHealth } from './ruler.models';

export type RulerTraitId = string;

export type RulerTraitPolarity = 'positive' | 'negative';

export interface RulerTraitEffect {
  age?: number;
  focus?: number;
  charisma?: number;
  governance?: number;
  intrigue?: number;
  warfare?: number;
  healthStep?: number;
}

export interface RulerTraitDefinition {
  id: RulerTraitId;
  name: string;
  polarity: RulerTraitPolarity;
  description: string;
  effectSummary: string;
  effect?: RulerTraitEffect;
}

export interface RulerTraitApplicationInput {
  age: number;
  focus: number;
  charisma: number;
  governance: number;
  intrigue: number;
  warfare: number;
  health: RulerHealth;
}
