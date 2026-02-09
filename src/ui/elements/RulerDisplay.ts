import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  Rectangle,
  ScreenElement,
  Text,
  vec,
} from 'excalibur';
import type { RulerData } from '../../managers/RulerManager';
import { RulerManager } from '../../managers/RulerManager';

export interface RulerDisplayOptions {
  x: number;
  y: number;
  rulerManager: RulerManager;
  portraitSize?: number;
  bgColor?: Color;
  textColor?: Color;
}

/**
 * UI component that displays the current ruler (top-left portrait + text).
 */
export class RulerDisplay extends ScreenElement {
  private rulerManager: RulerManager;
  private anchorX: number;
  private anchorY: number;
  private portraitSize: number;
  private bgColor: Color;
  private textColor: Color;

  private lastRendered:
    | Pick<RulerData, 'name' | 'age' | 'popularity' | 'portrait'>
    | undefined;

  constructor(options: RulerDisplayOptions) {
    super({ x: options.x, y: options.y });
    this.rulerManager = options.rulerManager;
    this.anchorX = options.x;
    this.anchorY = options.y;
    this.portraitSize = options.portraitSize ?? 64;
    this.bgColor = options.bgColor ?? Color.fromHex('#1a252f');
    this.textColor = options.textColor ?? Color.White;
  }

  onInitialize(): void {
    this.updateDisplay(true);
  }

  onPreUpdate(): void {
    this.updateDisplay(false);
  }

  private formatPopularity(value: number): string {
    if (value <= 19) return 'Despised';
    if (value <= 39) return 'Unpopular';
    if (value <= 59) return 'Neutral';
    if (value <= 74) return 'Liked';
    if (value <= 89) return 'Admired';
    return 'Beloved';
  }

  private updateDisplay(force: boolean): void {
    const ruler = this.rulerManager.getRuler();
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

    // Treat x/y as an anchor point (top-left).
    this.pos = vec(this.anchorX, this.anchorY);

    const members: GraphicsGrouping[] = [];

    // Background
    members.push({
      graphic: new Rectangle({
        width: contentW,
        height: contentH,
        color: this.bgColor,
      }),
      offset: vec(0, 0),
    });

    // Portrait
    const portraitX = padding;
    const portraitY = padding;

    if (ruler.portrait.isLoaded()) {
      const sprite = ruler.portrait.toSprite();
      sprite.width = this.portraitSize;
      sprite.height = this.portraitSize;
      members.push({
        graphic: sprite,
        offset: vec(portraitX, portraitY),
      });
    } else {
      members.push({
        graphic: new Rectangle({
          width: this.portraitSize,
          height: this.portraitSize,
          color: Color.fromHex('#233241'),
        }),
        offset: vec(portraitX, portraitY),
      });
    }

    // Text block (to the right of portrait)
    const textX = portraitX + this.portraitSize + gap;
    const topY = padding;
    members.push(
      { graphic: nameText, offset: vec(textX, topY) },
      {
        graphic: statsText,
        offset: vec(textX, topY + nameText.height + 4),
      }
    );

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );
  }
}
