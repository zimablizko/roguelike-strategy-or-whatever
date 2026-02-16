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
  vec,
} from 'excalibur';
import type { RulerData } from '../../_common/models/ruler.models';
import { RulerManager } from '../../managers/RulerManager';
import type { RulerDisplayOptions } from '../../_common/models/ui.models';
import {
  InteractivePanelElement,
} from '../elements/InteractivePanelElement';

/**
 * UI component that displays the current ruler (top-left portrait + text).
 */
export class RulerDisplay extends InteractivePanelElement {
  private rulerManager: RulerManager;
  private portraitSize: number;
  private textColor: Color;
  private cachedPortrait?: { source: ImageSource; sprite: Sprite };

  private lastRendered:
    | Pick<RulerData, 'name' | 'age' | 'popularity' | 'portrait'>
    | undefined;

  constructor(options: RulerDisplayOptions) {
    super(options);
    this.rulerManager = options.rulerManager;
    this.portraitSize = options.portraitSize ?? 64;
    this.textColor = options.textColor ?? Color.White;
  }

  private formatPopularity(value: number): string {
    if (value <= 19) return 'Despised';
    if (value <= 39) return 'Unpopular';
    if (value <= 59) return 'Neutral';
    if (value <= 74) return 'Liked';
    if (value <= 89) return 'Admired';
    return 'Beloved';
  }

  protected redraw(force: boolean): void {
    const ruler = this.rulerManager.getRulerRef();
    const next = {
      name: ruler.name,
      age: ruler.age,
      popularity: ruler.popularity,
      portrait: ruler.portrait,
    };

    if (
      !force &&
      this.lastRendered &&
      this.lastRendered.name === next.name &&
      this.lastRendered.age === next.age &&
      this.lastRendered.popularity === next.popularity &&
      this.lastRendered.portrait === next.portrait
    ) {
      return;
    }
    this.lastRendered = next;

    const padding = 8;
    const gap = 10;

    const nameText = new Text({
      text: ruler.name,
      font: new Font({
        size: 18,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    const statsText = new Text({
      text: `Age: ${ruler.age}  Popularity: ${this.formatPopularity(
        ruler.popularity
      )}`,
      font: new Font({
        size: 14,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    const textBlockW = Math.max(nameText.width, statsText.width);
    const contentW = padding * 2 + this.portraitSize + gap + textBlockW;
    const textBlockH = nameText.height + 4 + statsText.height;
    const contentH = padding * 2 + Math.max(this.portraitSize, textBlockH);
    const pressOffset = this.getPressOffset();

    // Treat x/y as an anchor point (top-left).
    this.pos = vec(this.anchorX, this.anchorY);

    const members: GraphicsGrouping[] = [];

    // Background
    members.push({
      graphic: new Rectangle({
        width: contentW,
        height: contentH,
        color: this.getPanelBackgroundColor(),
      }),
      offset: vec(pressOffset, pressOffset),
    });

    // Portrait
    const portraitX = padding;
    const portraitY = padding;

    if (ruler.portrait.isLoaded()) {
      const sprite = this.getPortraitSprite(ruler.portrait);
      if (sprite) {
        members.push({
          graphic: sprite,
          offset: vec(portraitX + pressOffset, portraitY + pressOffset),
        });
      }
    } else {
      members.push({
        graphic: new Rectangle({
          width: this.portraitSize,
          height: this.portraitSize,
          color: Color.fromHex('#233241'),
        }),
        offset: vec(portraitX + pressOffset, portraitY + pressOffset),
      });
    }

    // Text block (to the right of portrait)
    const textX = portraitX + this.portraitSize + gap;
    const topY = padding;
    members.push(
      {
        graphic: nameText,
        offset: vec(textX + pressOffset, topY + pressOffset),
      },
      {
        graphic: statsText,
        offset: vec(
          textX + pressOffset,
          topY + nameText.height + 4 + pressOffset
        ),
      }
    );
    this.addHoverBorder(members, contentW, contentH);

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );
  }

  private getPortraitSprite(source: ImageSource): Sprite | undefined {
    if (this.cachedPortrait && this.cachedPortrait.source === source) {
      return this.cachedPortrait.sprite;
    }

    if (!source.isLoaded()) {
      return undefined;
    }

    const sprite = source.toSprite();
    sprite.width = this.portraitSize;
    sprite.height = this.portraitSize;
    this.cachedPortrait = { source, sprite };
    return sprite;
  }
}
