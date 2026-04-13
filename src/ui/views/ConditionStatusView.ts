import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  type GraphicsGrouping,
  Rectangle,
  ScreenElement,
  Text,
  vec,
} from 'excalibur';
import type {
  ActiveCondition,
  ConditionSentiment,
} from '../../_common/models/condition.models';
import { FONT_FAMILY } from '../../_common/text';
import { getConditionDefinition } from '../../data/conditions';
import type { ConditionManager } from '../../managers/ConditionManager';
import { UI_Z } from '../constants/ZLayers';
import type { TooltipProvider } from '../tooltip/TooltipProvider';

export interface ConditionStatusViewOptions {
  conditionManager: ConditionManager;
  tooltipProvider: TooltipProvider;
  /** Right edge X coordinate (pills are right-aligned). */
  rightX: number;
  /** Top Y coordinate for the first pill. */
  topY: number;
}

const PILL_WIDTH = 190;
const PILL_HEIGHT = 24;
const PILL_GAP = 4;
const PILL_PADDING_X = 8;
const PILL_FONT_SIZE = 11;
const PILL_ALPHA = 0.85;

const SENTIMENT_COLORS: Record<ConditionSentiment, Color> = {
  positive: Color.fromHex('#2d6b3f'),
  negative: Color.fromHex('#8b2c2c'),
  neutral: Color.fromHex('#4a5568'),
};

const SENTIMENT_BORDER_COLORS: Record<ConditionSentiment, Color> = {
  positive: Color.fromHex('#3c8a52'),
  negative: Color.fromHex('#b33e3e'),
  neutral: Color.fromHex('#6b7a8d'),
};

/**
 * Displays active conditions as a vertical column of colored pills in the top-right
 * corner of the screen. Each pill shows the condition name and turns remaining.
 * Hover shows a tooltip with the full description and effects.
 */
export class ConditionStatusView extends ScreenElement {
  private readonly conditionManager: ConditionManager;
  private readonly tooltipProvider: TooltipProvider;
  private readonly rightX: number;
  private readonly topY: number;
  private lastVersion = -1;
  /** Per-pill hit zones for tooltip hover detection. */
  private pillZones: Array<{
    condition: ActiveCondition;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  private hoveredConditionId?: string;

  constructor(options: ConditionStatusViewOptions) {
    super({
      x: options.rightX - PILL_WIDTH,
      y: options.topY,
      width: PILL_WIDTH,
      height: 1, // will grow dynamically
      anchor: vec(0, 0),
      z: UI_Z.hud,
    });
    this.conditionManager = options.conditionManager;
    this.tooltipProvider = options.tooltipProvider;
    this.rightX = options.rightX;
    this.topY = options.topY;

    this.on('pointerenter', () => this.updateHover());
    this.on('pointermove', () => this.updateHover());
    this.on('pointerleave', () => {
      this.hoveredConditionId = undefined;
      this.tooltipProvider.hide(this);
    });
    this.on('prekill', () => {
      this.tooltipProvider.hide(this);
    });
  }

  onPreUpdate(): void {
    const version = this.conditionManager.getVersion();
    if (version === this.lastVersion) return;
    this.lastVersion = version;
    this.redraw();
  }

  private redraw(): void {
    const conditions = this.conditionManager.getActiveConditionsRef();
    if (conditions.length === 0) {
      this.graphics.visible = false;
      this.pillZones = [];
      return;
    }

    this.graphics.visible = true;
    const members: GraphicsGrouping[] = [];
    const zones: typeof this.pillZones = [];

    let yOffset = 0;
    for (const condition of conditions) {
      const definition = getConditionDefinition(condition.conditionId);
      if (!definition) continue;

      const sentiment = definition.sentiment;
      const bgColor = SENTIMENT_COLORS[sentiment].clone();
      bgColor.a = PILL_ALPHA;
      const borderColor = SENTIMENT_BORDER_COLORS[sentiment];

      // Border rectangle
      members.push({
        graphic: new Rectangle({
          width: PILL_WIDTH,
          height: PILL_HEIGHT,
          color: borderColor,
        }),
        offset: vec(0, yOffset),
      });

      // Inner background
      members.push({
        graphic: new Rectangle({
          width: PILL_WIDTH - 2,
          height: PILL_HEIGHT - 2,
          color: bgColor,
        }),
        offset: vec(1, yOffset + 1),
      });

      // Condition name (left)
      const nameText = definition.name;
      members.push({
        graphic: new Text({
          text: nameText,
          font: new Font({
            size: PILL_FONT_SIZE,
            unit: FontUnit.Px,
            color: Color.fromHex('#ecf3fa'),
            family: FONT_FAMILY,
          }),
        }),
        offset: vec(
          PILL_PADDING_X,
          yOffset + (PILL_HEIGHT - PILL_FONT_SIZE) / 2
        ),
      });

      // Turns remaining (right)
      const turnsText = `${condition.turnsRemaining}⏳`;
      members.push({
        graphic: new Text({
          text: turnsText,
          font: new Font({
            size: PILL_FONT_SIZE,
            unit: FontUnit.Px,
            color: Color.fromHex('#c8d6e0'),
            family: FONT_FAMILY,
          }),
        }),
        offset: vec(
          PILL_WIDTH -
            PILL_PADDING_X -
            turnsText.length * (PILL_FONT_SIZE * 0.6),
          yOffset + (PILL_HEIGHT - PILL_FONT_SIZE) / 2
        ),
      });

      zones.push({
        condition,
        x: 0,
        y: yOffset,
        width: PILL_WIDTH,
        height: PILL_HEIGHT,
      });

      yOffset += PILL_HEIGHT + PILL_GAP;
    }

    this.pillZones = zones;
    this.graphics.use(new GraphicsGroup({ members }));
    this.pos = vec(this.rightX - PILL_WIDTH, this.topY);
  }

  private updateHover(): void {
    // Determine which pill (if any) the pointer is over.
    const pointer = this.scene?.engine?.input.pointers.primary;
    if (!pointer) return;

    const screenPos = pointer.lastScreenPos;
    const localX = screenPos.x - this.pos.x;
    const localY = screenPos.y - this.pos.y;

    let found: (typeof this.pillZones)[number] | undefined;
    for (const zone of this.pillZones) {
      if (
        localX >= zone.x &&
        localX <= zone.x + zone.width &&
        localY >= zone.y &&
        localY <= zone.y + zone.height
      ) {
        found = zone;
        break;
      }
    }

    if (!found) {
      if (this.hoveredConditionId) {
        this.hoveredConditionId = undefined;
        this.tooltipProvider.hide(this);
      }
      return;
    }

    const condition = found.condition;
    if (this.hoveredConditionId === condition.conditionId) return;
    this.hoveredConditionId = condition.conditionId;

    const definition = getConditionDefinition(condition.conditionId);
    if (!definition) return;

    const effectLines = this.buildEffectDescription(definition.effects);
    const description =
      definition.description +
      (effectLines.length > 0 ? '\n\n' + effectLines.join('\n') : '') +
      `\n\nTurns remaining: ${condition.turnsRemaining}`;

    this.tooltipProvider.show({
      owner: this,
      getAnchorRect: () => ({
        x: this.pos.x + found!.x,
        y: this.pos.y + found!.y,
        width: found!.width,
        height: found!.height,
      }),
      header: definition.name,
      description,
      placement: 'left',
      width: 280,
    });
  }

  private buildEffectDescription(
    effects: import('../../_common/models/condition.models').ConditionEffects
  ): string[] {
    const lines: string[] = [];
    const fx = effects;

    if (fx.resourceModifiers) {
      for (const [key, value] of Object.entries(fx.resourceModifiers)) {
        if (value === undefined || value === 0) continue;
        const sign = value > 0 ? '+' : '';
        lines.push(`${capitalize(key)}: ${sign}${value}/turn`);
      }
    }

    if (fx.resourceMultipliers) {
      for (const [key, value] of Object.entries(fx.resourceMultipliers)) {
        if (value === undefined || value === 1) continue;
        const pct = Math.round((value - 1) * 100);
        const sign = pct > 0 ? '+' : '';
        lines.push(`${capitalize(key)} income: ${sign}${pct}%`);
      }
    }

    if (fx.combatModifiers) {
      if (fx.combatModifiers.attackBonus) {
        const sign = fx.combatModifiers.attackBonus > 0 ? '+' : '';
        lines.push(`Attack: ${sign}${fx.combatModifiers.attackBonus}`);
      }
      if (fx.combatModifiers.defenseBonus) {
        const sign = fx.combatModifiers.defenseBonus > 0 ? '+' : '';
        lines.push(`Defense: ${sign}${fx.combatModifiers.defenseBonus}`);
      }
    }

    if (fx.buildSpeedModifier !== undefined && fx.buildSpeedModifier !== 1) {
      const pct = Math.round((fx.buildSpeedModifier - 1) * 100);
      const sign = pct > 0 ? '+' : '';
      lines.push(`Build speed: ${sign}${pct}%`);
    }

    if (
      fx.researchSpeedModifier !== undefined &&
      fx.researchSpeedModifier !== 1
    ) {
      const pct = Math.round((fx.researchSpeedModifier - 1) * 100);
      const sign = pct > 0 ? '+' : '';
      lines.push(`Research speed: ${sign}${pct}%`);
    }

    if (fx.focusModifier !== undefined && fx.focusModifier !== 0) {
      const sign = fx.focusModifier > 0 ? '+' : '';
      lines.push(`Focus: ${sign}${fx.focusModifier}/turn`);
    }

    if (fx.upkeepMultiplier !== undefined && fx.upkeepMultiplier !== 1) {
      const pct = Math.round((fx.upkeepMultiplier - 1) * 100);
      const sign = pct > 0 ? '+' : '';
      lines.push(`Upkeep: ${sign}${pct}%`);
    }

    return lines;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
