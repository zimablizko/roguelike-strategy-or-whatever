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
import { FONT_FAMILY } from '../../_common/text';
import { RulerManager } from '../../managers/RulerManager';
import { InteractivePanelElement } from '../elements/InteractivePanelElement';

/**
 * UI component that displays the current ruler's name and stats.
 */
export class RulerDisplay extends InteractivePanelElement {
  private rulerManager: RulerManager;
  private xProvider?: () => number;
  private yProvider?: () => number;
  private widthProvider?: () => number;

  private lastRendered:
    | Pick<
        RulerData,
        | 'name'
        | 'age'
        | 'health'
      >
    | undefined;

  constructor(options: RulerDisplayOptions) {
    super(options);
    this.rulerManager = options.rulerManager;
    this.xProvider = options.xProvider;
    this.yProvider = options.yProvider;
    this.widthProvider = options.widthProvider;
  }

  protected redraw(force: boolean): void {
    const ruler = this.rulerManager.getRulerRef();
    const next = {
      name: ruler.name,
      age: ruler.age,
      health: ruler.health,
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
      this.lastRendered.health === next.health
    ) {
      return;
    }
    this.lastRendered = next;

    const panelW = this.widthProvider ? this.widthProvider() : 196;
    const borderW = 1;
    const accentW = 3;
    const labelPadX = 8;
    const labelPadY = 5;
    const labelSize = 11;
    const sectionH = labelPadY * 2 + labelSize;
    const sepH = 1;
    const contentPadX = 10;
    const contentPadY = 8;
    const nameSize = 15;
    const lineGap = 4;
    const subSize = 12;
    const contentH = contentPadY + nameSize + lineGap + subSize + contentPadY;
    const panelH = borderW + sectionH + sepH + contentH + borderW;

    const pressOffset = this.getPressOffset();

    const borderColor = Color.fromHex('#2a4158');
    const accentColor = Color.fromHex('#d8b24a');
    const primaryColor = Color.fromHex('#e7edf3');
    const secondaryColor = Color.fromHex('#a7bacb');

    const members: GraphicsGrouping[] = [];

    // Idle border
    members.push({
      graphic: new Rectangle({
        width: panelW,
        height: panelH,
        color: borderColor,
      }),
      offset: vec(pressOffset, pressOffset),
    });

    // Panel background
    members.push({
      graphic: new Rectangle({
        width: panelW - borderW * 2,
        height: panelH - borderW * 2,
        color: this.getPanelBackgroundColor(),
      }),
      offset: vec(borderW + pressOffset, borderW + pressOffset),
    });

    // Left accent bar
    members.push({
      graphic: new Rectangle({
        width: accentW,
        height: sectionH,
        color: accentColor,
      }),
      offset: vec(borderW + pressOffset, borderW + pressOffset),
    });

    // Section label
    members.push({
      graphic: new Text({
        text: '👑 RULER [X]',
        font: new Font({
          size: labelSize,
          unit: FontUnit.Px,
          color: secondaryColor,
          family: FONT_FAMILY,
        }),
      }),
      offset: vec(
        borderW + accentW + labelPadX + pressOffset,
        borderW + labelPadY + pressOffset
      ),
    });

    // Separator
    members.push({
      graphic: new Rectangle({
        width: panelW - borderW * 2,
        height: sepH,
        color: borderColor,
      }),
      offset: vec(borderW + pressOffset, borderW + sectionH + pressOffset),
    });

    const contentY = borderW + sectionH + sepH + pressOffset;

    // Ruler name
    members.push({
      graphic: new Text({
        text: ruler.name,
        font: new Font({
          size: nameSize,
          unit: FontUnit.Px,
          color: primaryColor,
          family: FONT_FAMILY,
        }),
      }),
      offset: vec(contentPadX + pressOffset, contentY + contentPadY),
    });

    // Stats sub-line
    members.push({
      graphic: new Text({
        text: `Age: ${ruler.age}  Health: ${ruler.health}`,
        font: new Font({
          size: subSize,
          unit: FontUnit.Px,
          color: secondaryColor,
          family: FONT_FAMILY,
        }),
      }),
      offset: vec(
        contentPadX + pressOffset,
        contentY + contentPadY + nameSize + lineGap
      ),
    });

    this.addHoverBorder(members, panelW, panelH);

    this.graphics.use(new GraphicsGroup({ members }));
  }
}
