import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  ImageSource,
  Rectangle,
  Sprite,
  Text,
  type Scene,
  vec,
} from 'excalibur';
import {
  InteractivePanelElement,
} from './InteractivePanelElement';
import { TooltipProvider } from '../tooltip/TooltipProvider';
import type {
  ActionElementOptions,
  ActionOutcome,
} from '../../_common/models/ui.models';

/**
 * Reusable interactive action row:
 * - Optional icon at the left side
 * - Action title next to icon
 * - Description tooltip on hover (with optional outcome rows)
 */
export class ActionElement extends InteractivePanelElement {
  private readonly title: string;
  private readonly description: string;
  private readonly outcomes: ActionOutcome[];
  private readonly actionWidth: number;
  private readonly actionHeight: number;
  private readonly icon?: ImageSource;
  private readonly iconSize: number;
  private readonly textColor: Color;
  private readonly tooltipProvider: TooltipProvider;
  private readonly tooltipBgColor: Color;
  private readonly tooltipTextColor: Color;
  private readonly tooltipWidth: number;

  private cachedIcon?: { source: ImageSource; sprite: Sprite };
  private lastVisualState:
    | { hovered: boolean; pressed: boolean }
    | undefined;

  constructor(options: ActionElementOptions) {
    super(options);
    this.title = options.title;
    this.description = options.description;
    this.outcomes = options.outcomes ?? [];
    this.actionWidth = options.width ?? 260;
    this.actionHeight = options.height ?? 44;
    this.icon = options.icon;
    this.iconSize = options.iconSize ?? 24;
    this.textColor = options.textColor ?? Color.White;
    this.tooltipProvider = options.tooltipProvider;
    this.tooltipBgColor = options.tooltipBgColor ?? Color.fromHex('#12202d');
    this.tooltipTextColor = options.tooltipTextColor ?? Color.fromHex('#ecf3fa');
    this.tooltipWidth = options.tooltipWidth ?? 300;
  }

  protected redraw(force: boolean): void {
    const visualState = { hovered: this.isHovered, pressed: this.isPressed };
    if (
      !force &&
      this.lastVisualState &&
      this.lastVisualState.hovered === visualState.hovered &&
      this.lastVisualState.pressed === visualState.pressed
    ) {
      return;
    }
    this.lastVisualState = visualState;

    const pressOffset = this.getPressOffset();
    const padding = 10;
    const iconGap = 8;

    this.pos = vec(this.anchorX, this.anchorY);

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: this.actionWidth,
          height: this.actionHeight,
          color: this.getPanelBackgroundColor(),
        }),
        offset: vec(pressOffset, pressOffset),
      },
    ];

    let contentX = padding;

    const iconSprite = this.getIconSprite();
    if (iconSprite) {
      members.push({
        graphic: iconSprite,
        offset: vec(
          contentX + pressOffset,
          (this.actionHeight - this.iconSize) / 2 + pressOffset
        ),
      });
      contentX += this.iconSize + iconGap;
    }

    const titleText = new Text({
      text: this.title,
      font: new Font({
        size: 16,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    members.push({
      graphic: titleText,
      offset: vec(
        contentX + pressOffset,
        (this.actionHeight - titleText.height) / 2 + pressOffset
      ),
    });

    this.addHoverBorder(members, this.actionWidth, this.actionHeight);

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );

    if (this.isHovered) {
      this.tooltipProvider.show({
        owner: this,
        getAnchorRect: () => {
          const currentPressOffset = this.getPressOffset();
          return {
            x: this.globalPos.x + currentPressOffset,
            y: this.globalPos.y + currentPressOffset,
            width: this.actionWidth,
            height: this.actionHeight,
          };
        },
        description: this.description,
        outcomes: this.outcomes,
        width: this.tooltipWidth,
        bgColor: this.tooltipBgColor,
        textColor: this.tooltipTextColor,
      });
    } else {
      this.tooltipProvider.hide(this);
    }
  }

  override onPreKill(_scene: Scene): void {
    this.tooltipProvider.hide(this);
  }

  private getIconSprite(): Sprite | undefined {
    if (!this.icon || !this.icon.isLoaded()) {
      return undefined;
    }

    if (this.cachedIcon && this.cachedIcon.source === this.icon) {
      return this.cachedIcon.sprite;
    }

    const sprite = this.icon.toSprite();
    sprite.width = this.iconSize;
    sprite.height = this.iconSize;
    this.cachedIcon = { source: this.icon, sprite };
    return sprite;
  }

}
