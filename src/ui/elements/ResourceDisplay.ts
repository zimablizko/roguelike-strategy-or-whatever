import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  ImageSource,
  Rectangle,
  ScreenElement,
  Text,
  vec,
} from 'excalibur';
import { GameManager, PlayerData } from '../../_common/GameManager';
import { Resources } from '../../_common/resources';

export interface ResourceDisplayOptions {
  x: number;
  y: number;
  gameManager: GameManager;
  anchor?: 'top-left' | 'top-right';
  iconSize?: number;
  spacing?: number;
  bgColor?: Color;
  textColor?: Color;
}

interface ResourceConfig {
  key: keyof PlayerData['resources'];
  icon: ImageSource;
  label: string;
}

/**
 * UI component that displays current player resources with icons
 */
export class ResourceDisplay extends ScreenElement {
  private gameManager: GameManager;
  private anchorX: number;
  private anchorY: number;
  private panelAnchor: 'top-left' | 'top-right';
  private iconSize: number;
  private spacing: number;
  private bgColor: Color;
  private textColor: Color;
  private resourceConfigs: ResourceConfig[];

  constructor(options: ResourceDisplayOptions) {
    super({ x: options.x, y: options.y });
    this.gameManager = options.gameManager;
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
    this.updateDisplay();
  }

  onPreUpdate(): void {
    // Update every frame to reflect resource changes
    this.updateDisplay();
  }

  /**
   * Update the graphics to reflect current resource values
   */
  private updateDisplay(): void {
    const resources = this.gameManager.getAllResources();
    const padding = 8;
    const iconTextGap = 4;
    const itemWidth = this.iconSize + iconTextGap + 32; // icon + gap + text space
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
      const value = resources[config.key];

      // Icon sprite
      if (config.icon.isLoaded()) {
        const sprite = config.icon.toSprite();
        sprite.width = this.iconSize;
        sprite.height = this.iconSize;
        members.push({
          graphic: sprite,
          offset: vec(xOffset, iconY),
        });
      }

      // Value text with space after icon and vertically centered
      const valueText = new Text({
        text: this.formatValue(value),
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
}
