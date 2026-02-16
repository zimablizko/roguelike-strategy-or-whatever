import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  Rectangle,
  type Scene,
  ScreenElement,
  Sprite,
  Text,
  vec,
} from 'excalibur';
import type { ResourceStock } from '../../_common/models/resource.models';
import type {
  ResourceConfig,
  ResourceDisplayOptions,
} from '../../_common/models/ui.models';
import { Resources } from '../../_common/resources';
import { BuildingManager } from '../../managers/BuildingManager';
import { ResourceManager } from '../../managers/ResourceManager';
import { TooltipProvider } from '../tooltip/TooltipProvider';

/**
 * UI component that displays current player resources with icons
 */
export class ResourceDisplay extends ScreenElement {
  private resourceManager: ResourceManager;
  private buildingManager: BuildingManager;
  private anchorX: number;
  private anchorY: number;
  private panelAnchor: 'top-left' | 'top-right';
  private iconSize: number;
  private spacing: number;
  private bgColor: Color;
  private textColor: Color;
  private tooltipProvider?: TooltipProvider;
  private resourceConfigs: ResourceConfig[];
  private resourceItemRects: Partial<
    Record<
      ResourceConfig['key'],
      { x: number; y: number; width: number; height: number }
    >
  > = {};
  private hoveredResource: ResourceConfig['key'] | undefined;
  private readonly resourceTooltipText: Record<ResourceConfig['key'], string> =
    {
      gold: 'Gold: universal currency for trade, upkeep, and events.',
      materials:
        'Materials: wood and stone used for construction and crafting.',
      food: 'Food: consumed each turn to sustain your population.',
      population:
        'Population: occupied / total workforce. Build Houses to grow.',
    };
  private iconSprites: Partial<Record<ResourceConfig['key'], Sprite>> = {};

  private lastRendered:
    | Pick<ResourceStock, 'gold' | 'materials' | 'food' | 'population'>
    | undefined;
  private lastBuildingsVersion = -1;

  constructor(options: ResourceDisplayOptions) {
    super({ x: options.x, y: options.y });
    this.resourceManager = options.resourceManager;
    this.buildingManager = options.buildingManager;
    this.tooltipProvider = options.tooltipProvider;
    this.anchorX = options.x;
    this.anchorY = options.y;
    this.panelAnchor = options.anchor ?? 'top-left';
    this.iconSize = options.iconSize ?? 24;
    this.spacing = options.spacing ?? 16;
    this.bgColor = options.bgColor ?? Color.fromHex('#1a252f');
    this.textColor = options.textColor ?? Color.White;

    // Map resource types to their icons
    this.resourceConfigs = [
      { key: 'gold', icon: Resources.MoneyIcon, label: 'Gold' },
      { key: 'materials', icon: Resources.ResourcesIcon, label: 'Materials' },
      { key: 'food', icon: Resources.FoodIcon, label: 'Food' },
      {
        key: 'population',
        icon: Resources.PopulationIcon,
        label: 'Population',
      },
    ];
  }

  onInitialize(): void {
    this.on('pointerenter', (evt) => {
      this.updateHoveredResource(evt.screenPos.x, evt.screenPos.y);
    });
    this.on('pointermove', (evt) => {
      this.updateHoveredResource(evt.screenPos.x, evt.screenPos.y);
    });
    this.on('pointerleave', () => {
      this.clearHoveredResource();
    });
    this.on('prekill', () => {
      this.clearHoveredResource();
    });

    this.updateDisplay(true);
  }

  onPreUpdate(): void {
    this.updateDisplay(false);
  }

  private sameResources(a: ResourceStock, b: ResourceStock): boolean {
    return (
      a.gold === b.gold &&
      a.materials === b.materials &&
      a.food === b.food &&
      a.population === b.population
    );
  }

  /**
   * Update the graphics to reflect current resource values
   */
  private updateDisplay(force: boolean): void {
    const resources = this.resourceManager.getAllResourcesRef();
    const buildingsVersion = this.buildingManager.getBuildingsVersion();

    if (
      !force &&
      this.lastRendered &&
      this.lastBuildingsVersion === buildingsVersion &&
      this.sameResources(this.lastRendered, resources)
    ) {
      return;
    }
    this.lastRendered = {
      gold: resources.gold,
      materials: resources.materials,
      food: resources.food,
      population: resources.population,
    };
    this.lastBuildingsVersion = buildingsVersion;

    const padding = 8;
    const iconTextGap = 4;
    const itemWidth = this.iconSize + iconTextGap + 40; // icon + gap + text space
    const totalWidth =
      padding * 2 +
      this.resourceConfigs.length * itemWidth +
      (this.resourceConfigs.length - 1) * this.spacing;
    const totalHeight = this.iconSize + padding * 2;

    // Treat x/y as an anchor point.
    // ScreenElements are positioned using top-left style offsets (see ScreenButton).
    this.pos =
      this.panelAnchor === 'top-right'
        ? vec(this.anchorX - totalWidth, this.anchorY)
        : vec(this.anchorX, this.anchorY);

    // Background panel
    const background = new Rectangle({
      width: totalWidth,
      height: totalHeight,
      color: this.bgColor,
    });

    const members: GraphicsGrouping[] = [
      {
        graphic: background,
        offset: vec(0, 0),
      },
    ];

    // Add each resource icon and value
    const innerHeight = totalHeight - padding * 2;
    const iconY = padding + (innerHeight - this.iconSize) / 2;
    let xOffset = padding;
    for (const config of this.resourceConfigs) {
      let displayText: string;
      if (config.key === 'population') {
        const occupied = this.buildingManager.getOccupiedPopulation();
        const total = this.buildingManager.getTotalPopulation();
        displayText = `${occupied}/${total}`;
      } else {
        displayText = this.formatValue(resources[config.key]);
      }
      this.resourceItemRects[config.key] = {
        x: xOffset,
        y: 0,
        width: itemWidth,
        height: totalHeight,
      };

      // Icon sprite
      const sprite = this.getIconSprite(config);
      if (sprite) {
        members.push({
          graphic: sprite,
          offset: vec(xOffset, iconY),
        });
      }

      // Value text with space after icon and vertically centered
      const valueText = new Text({
        text: displayText,
        font: new Font({
          size: 14,
          unit: FontUnit.Px,
          color: this.textColor,
        }),
      });

      const textY = padding + (innerHeight - valueText.height) / 2;
      members.push({
        graphic: valueText,
        offset: vec(xOffset + this.iconSize + iconTextGap, textY),
      });

      xOffset += itemWidth + this.spacing;
    }

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );
  }

  private getIconSprite(config: ResourceConfig): Sprite | undefined {
    const cached = this.iconSprites[config.key];
    if (cached) {
      return cached;
    }

    if (!config.icon.isLoaded()) {
      return undefined;
    }

    const sprite = config.icon.toSprite();
    sprite.width = this.iconSize;
    sprite.height = this.iconSize;
    this.iconSprites[config.key] = sprite;
    return sprite;
  }

  /**
   * Format large numbers for display (e.g., 1000 -> 1K)
   */
  private formatValue(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  private updateHoveredResource(screenX: number, screenY: number): void {
    const hovered = this.hitTestResource(screenX, screenY);
    if (hovered === this.hoveredResource) {
      return;
    }

    this.clearHoveredResource();
    if (!hovered || !this.tooltipProvider) {
      return;
    }

    this.hoveredResource = hovered;
    this.tooltipProvider.show({
      owner: this,
      getAnchorRect: () => this.getResourceAnchorRect(hovered),
      description: this.resourceTooltipText[hovered],
      placement: 'bottom',
      width: 220,
    });
  }

  private clearHoveredResource(): void {
    this.hoveredResource = undefined;
    this.tooltipProvider?.hide(this);
  }

  private hitTestResource(
    screenX: number,
    screenY: number
  ): ResourceConfig['key'] | undefined {
    const localX = screenX - this.globalPos.x;
    const localY = screenY - this.globalPos.y;

    for (const config of this.resourceConfigs) {
      const rect = this.resourceItemRects[config.key];
      if (!rect) {
        continue;
      }

      const insideX = localX >= rect.x && localX <= rect.x + rect.width;
      const insideY = localY >= rect.y && localY <= rect.y + rect.height;
      if (insideX && insideY) {
        return config.key;
      }
    }

    return undefined;
  }

  private getResourceAnchorRect(key: ResourceConfig['key']): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const rect = this.resourceItemRects[key];
    if (!rect) {
      return {
        x: this.globalPos.x,
        y: this.globalPos.y,
        width: this.width,
        height: this.height,
      };
    }

    return {
      x: this.globalPos.x + rect.x,
      y: this.globalPos.y + rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  override onPreKill(_scene: Scene): void {
    this.clearHoveredResource();
  }
}
