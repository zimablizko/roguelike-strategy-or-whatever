import type { Color, ImageSource } from 'excalibur';

export interface TooltipAnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TooltipPlacement = 'right' | 'bottom' | 'left' | 'top';

export interface TooltipOutcome {
  label: string;
  value: string | number;
  icon?: ImageSource;
  color?: Color;
  inline?: boolean;
  /** When true, renders value then icon (e.g. "+10 🍖"). Default is icon then value. */
  iconAfter?: boolean;
}

export interface TooltipRequest {
  owner: unknown;
  getAnchorRect: () => TooltipAnchorRect;
  header?: string;
  description: string;
  outcomes?: TooltipOutcome[];
  placement?: TooltipPlacement;
  width?: number;
  bgColor?: Color;
  textColor?: Color;
}
