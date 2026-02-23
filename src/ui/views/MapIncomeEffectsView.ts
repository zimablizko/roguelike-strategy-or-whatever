import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  type GraphicsGrouping,
  ScreenElement,
  Sprite,
  Text,
  vec,
} from 'excalibur';
import type { ResourceType } from '../../_common/models/resource.models';
import type { EndTurnIncomePulse } from '../../_common/models/turn.models';
import type {
  IncomeVisualPulse,
  MapIncomeEffectsViewOptions,
} from '../../_common/models/ui.models';
import { Resources } from '../../_common/resources';
import { UI_Z } from '../constants/ZLayers';
import { MapView } from './MapView';

export class MapIncomeEffectsView extends ScreenElement {
  private readonly mapView: MapView;
  private pulses: IncomeVisualPulse[] = [];
  private readonly emptyGraphics = new GraphicsGroup({ members: [] });
  private graphicsCleared = true;

  constructor(options: MapIncomeEffectsViewOptions) {
    super({ x: 0, y: 0 });
    this.mapView = options.mapView;
    this.z = UI_Z.hud - 1;
    this.pointer.useGraphicsBounds = false;
    this.pointer.useColliderShape = false;
  }

  addIncomePulses(pulses: EndTurnIncomePulse[]): void {
    if (pulses.length === 0) {
      return;
    }

    const tileCounts = new Map<string, number>();
    for (const pulse of pulses) {
      const key = `${pulse.tileX}:${pulse.tileY}`;
      tileCounts.set(key, (tileCounts.get(key) ?? 0) + 1);
    }

    const tileSeen = new Map<string, number>();
    for (let i = 0; i < pulses.length; i++) {
      const pulse = pulses[i];
      const key = `${pulse.tileX}:${pulse.tileY}`;
      const totalInTile = tileCounts.get(key) ?? 1;
      const slotIndex = tileSeen.get(key) ?? 0;
      tileSeen.set(key, slotIndex + 1);
      const laneOffsetX = 0;
      const laneOffsetY = -slotIndex * 28 - (totalInTile > 1 ? 8 : 0);
      const rawAmount = pulse.amount;
      const absAmount = Math.abs(rawAmount);
      const sign = rawAmount < 0 ? '-' : '+';
      const textColor =
        rawAmount < 0
          ? Color.fromRGB(220, 80, 80)
          : this.getResourceColor(pulse.resourceType);
      const amountText = new Text({
        text: `${sign}${absAmount}`,
        font: new Font({
          size: 24,
          unit: FontUnit.Px,
          color: textColor,
        }),
      });
      const amountShadow = new Text({
        text: `${sign}${absAmount}`,
        font: new Font({
          size: 24,
          unit: FontUnit.Px,
          color: Color.fromRGB(8, 12, 16),
        }),
      });

      this.pulses.push({
        ...pulse,
        ageMs: 0,
        delayMs: i * 70 + slotIndex * 120,
        durationMs: 2100,
        liftPx: 36,
        jitterX: 0,
        laneOffsetX,
        laneOffsetY,
        icon: this.createResourceIcon(pulse.resourceType),
        amountText,
        amountShadow,
        amountTextWidth: amountText.width,
        amountTextHeight: amountText.height,
      });
    }

    this.graphicsCleared = false;
  }

  onPreUpdate(_engine: unknown, elapsedMs: number): void {
    if (this.pulses.length > 0) {
      let write = 0;
      for (let read = 0; read < this.pulses.length; read++) {
        const pulse = this.pulses[read];
        pulse.ageMs += elapsedMs;
        const localAge = pulse.ageMs - pulse.delayMs;
        if (localAge <= pulse.durationMs) {
          this.pulses[write++] = pulse;
        }
      }
      this.pulses.length = write;
    }

    const members: GraphicsGrouping[] = [];
    for (const pulse of this.pulses) {
      const localAge = pulse.ageMs - pulse.delayMs;
      if (localAge < 0) {
        continue;
      }

      const progress = Math.min(1, Math.max(0, localAge / pulse.durationMs));
      const alpha = 1 - progress;
      const anchor = this.mapView.getMapPositionScreen(
        pulse.tileX,
        pulse.tileY
      );
      const riseY = -pulse.liftPx * progress;
      const x = anchor.x + pulse.laneOffsetX + pulse.jitterX;
      const y = anchor.y + pulse.laneOffsetY + riseY;

      let textX = x - pulse.amountTextWidth / 2;
      if (pulse.icon) {
        pulse.icon.opacity = alpha;
      }
      pulse.amountShadow.opacity = alpha * 0.9;
      pulse.amountText.opacity = alpha;

      if (pulse.icon) {
        textX += 10;
        members.push({
          graphic: pulse.icon,
          offset: vec(textX - 20, y - pulse.icon.height / 2),
        });
      }

      members.push({
        graphic: pulse.amountShadow,
        offset: vec(textX + 1.5, y - pulse.amountTextHeight / 2 + 1.5),
      });
      members.push({
        graphic: pulse.amountText,
        offset: vec(textX, y - pulse.amountTextHeight / 2),
      });
    }

    if (members.length === 0) {
      if (!this.graphicsCleared) {
        this.graphics.use(this.emptyGraphics);
        this.graphicsCleared = true;
      }
      return;
    }

    this.graphics.use(new GraphicsGroup({ members }));
    this.graphicsCleared = false;
  }

  override onPreKill(): void {
    this.pulses = [];
    if (!this.graphicsCleared) {
      this.graphics.use(this.emptyGraphics);
      this.graphicsCleared = true;
    }
  }

  private createResourceIcon(resourceType: ResourceType): Sprite | undefined {
    const source = this.getResourceIcon(resourceType);
    if (!source.isLoaded()) {
      return undefined;
    }

    const sprite = source.toSprite();
    sprite.width = 18;
    sprite.height = 18;
    return sprite;
  }

  private getResourceIcon(resourceType: ResourceType) {
    if (resourceType === 'gold') {
      return Resources.MoneyIcon;
    }
    if (resourceType === 'food') {
      return Resources.FoodIcon;
    }
    if (resourceType === 'materials') {
      return Resources.ResourcesIcon;
    }
    return Resources.PopulationIcon;
  }

  private getResourceColor(_resourceType: ResourceType): Color {
    return Color.fromRGB(255, 173, 84);
  }
}
