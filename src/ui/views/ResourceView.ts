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
import { getIconSprite } from '../../_common/icons';
import type { ResourceStock } from '../../_common/models/resource.models';
import { FOOD_RESOURCE_TYPES } from '../../_common/models/resource.models';
import type {
  ResourceConfig,
  ResourceDisplayKey,
  ResourceDisplayOptions,
} from '../../_common/models/ui.models';
import { FONT_FAMILY } from '../../_common/text';
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
  private readonly resourceTooltipText: Record<ResourceDisplayKey, string> = {
    gold: 'Gold: universal currency for trade, upkeep, and events.',
    wood: 'Wood: harvested from forests, used for construction.',
    stone: 'Stone: quarried from rocks, used for advanced construction.',
    jewelry: 'Jewelry: luxury goods mined from rare deposits.',
    ironOre: 'Iron Ore: refined metal stock mined from rich deposits.',
    wheat: 'Wheat: grown on fields, used by Bakeries to produce Bread.',
    meat: 'Meat: hunted from wildlife, consumed as food.',
    bread: 'Bread: baked from Wheat, consumed as food.',
    food: 'Food: total edible supplies (Meat + Bread). Consumed each turn.',
    population: 'Population: occupied / total workforce. Build Houses to grow.',
    politicalPower:
      'Political Power: influence reserved for major political decisions.',
  };
  private lastRendered: ResourceStock | undefined;
  private lastBuildingsVersion = -1;
  private lastOccupiedPopulation = -1;
  private lastTotalPopulation = -1;

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

    // Map resource types to their icons (sprites cloned from the shared spritesheet).
    this.resourceConfigs = [
      {
        key: 'gold',
        icon: getIconSprite('money', this.iconSize),
        label: 'Gold',
      },
      {
        key: 'wood',
        icon: getIconSprite('lumber', this.iconSize),
        label: 'Wood',
      },
      {
        key: 'stone',
        icon: getIconSprite('stone', this.iconSize),
        label: 'Stone',
      },
      {
        key: 'food',
        icon: getIconSprite('food', this.iconSize),
        label: 'Food',
      },
      {
        key: 'population',
        icon: getIconSprite('population', this.iconSize),
        label: 'Population',
      },
      {
        key: 'politicalPower',
        icon: getIconSprite('politicalPower', this.iconSize),
        label: 'Political Power',
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
      a.wood === b.wood &&
      a.stone === b.stone &&
      a.jewelry === b.jewelry &&
      a.ironOre === b.ironOre &&
      a.wheat === b.wheat &&
      a.meat === b.meat &&
      a.bread === b.bread &&
      a.population === b.population &&
      a.politicalPower === b.politicalPower
    );
  }

  /**
   * Update the graphics to reflect current resource values
   */
  private updateDisplay(force: boolean): void {
    const resources = this.resourceManager.getAllResourcesRef();
    const buildingsVersion = this.buildingManager.getBuildingsVersion();
    const occupiedPopulation = this.buildingManager.getOccupiedPopulation();
    const totalPopulation = this.buildingManager.getTotalPopulation();

    if (
      !force &&
      this.lastRendered &&
      this.lastBuildingsVersion === buildingsVersion &&
      this.lastOccupiedPopulation === occupiedPopulation &&
      this.lastTotalPopulation === totalPopulation &&
      this.sameResources(this.lastRendered, resources)
    ) {
      return;
    }
    this.lastRendered = { ...resources };
    this.lastBuildingsVersion = buildingsVersion;
    this.lastOccupiedPopulation = occupiedPopulation;
    this.lastTotalPopulation = totalPopulation;

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
        displayText = `${occupiedPopulation}/${totalPopulation}`;
      } else if (config.key === 'food') {
        // Virtual aggregate: sum of all food-type resources
        let foodTotal = 0;
        for (const ft of FOOD_RESOURCE_TYPES) {
          foodTotal += resources[ft];
        }
        displayText = this.formatValue(foodTotal);
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
      const resourceTextColors: Partial<Record<ResourceDisplayKey, string>> = {
        gold: '#d8b24a',
        wood: '#8c5a32',
        stone: '#7d8b96',
        food: '#c67f2f',
        population: '#a7bacb',
        politicalPower: '#d69cf0',
      };
      const textColorKey = resourceTextColors[config.key];
      const valueColor = textColorKey
        ? Color.fromHex(textColorKey)
        : this.textColor;
      const valueText = new Text({
        text: displayText,
        font: new Font({
          size: 16,
          unit: FontUnit.Px,
          color: valueColor,
          family: FONT_FAMILY,
        }),
      });

      const textY = padding + (innerHeight - 16) / 2;
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
    return config.icon;
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
