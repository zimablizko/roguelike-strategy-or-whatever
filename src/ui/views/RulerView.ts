import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  Rectangle,
  Text,
  vec,
} from 'excalibur';
import type { RulerData } from '../../_common/models/ruler.models';
import type { RulerDisplayOptions } from '../../_common/models/ui.models';
import { RulerManager } from '../../managers/RulerManager';
import { InteractivePanelElement } from '../elements/InteractivePanelElement';

/**
 * UI component that displays the current ruler's name and stats.
 */
export class RulerDisplay extends InteractivePanelElement {
  private rulerManager: RulerManager;
  private textColor: Color;
  private xProvider?: () => number;
  private yProvider?: () => number;
  private widthProvider?: () => number;

  private lastRendered:
    | Pick<RulerData, 'name' | 'age' | 'popularity'>
    | undefined;

  constructor(options: RulerDisplayOptions) {
    super(options);
    this.rulerManager = options.rulerManager;
    this.textColor = options.textColor ?? Color.White;
    this.xProvider = options.xProvider;
    this.yProvider = options.yProvider;
    this.widthProvider = options.widthProvider;
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
    };

    // Always update position from providers (stateDisplay size may change)
    const dynamicX = this.xProvider?.() ?? this.anchorX;
    const dynamicY = this.yProvider?.() ?? this.anchorY;
    this.pos = vec(dynamicX, dynamicY);

    if (
      !force &&
      this.lastRendered &&
      this.lastRendered.name === next.name &&
      this.lastRendered.age === next.age &&
      this.lastRendered.popularity === next.popularity
    ) {
      return;
    }
    this.lastRendered = next;

    const padding = 10;
    const lineGap = 4;

    const nameText = new Text({
      text: `Ruler: ${ruler.name}`,
      font: new Font({
        size: 18,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    const statsText = new Text({
      text: `Age: ${ruler.age}  ${this.formatPopularity(ruler.popularity)}`,
      font: new Font({
        size: 14,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    const naturalW = padding * 2 + Math.max(nameText.width, statsText.width);
    const contentW = this.widthProvider
      ? this.widthProvider()
      : naturalW;
    const contentH = padding * 2 + 18 + lineGap + 14;
    const pressOffset = this.getPressOffset();

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: contentW,
          height: contentH,
          color: this.getPanelBackgroundColor(),
        }),
        offset: vec(pressOffset, pressOffset),
      },
      {
        graphic: nameText,
        offset: vec(padding + pressOffset, padding + pressOffset),
      },
      {
        graphic: statsText,
        offset: vec(
          padding + pressOffset,
          padding + 18 + lineGap + pressOffset
        ),
      },
    ];

    this.addHoverBorder(members, contentW, contentH);

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );
  }
}
