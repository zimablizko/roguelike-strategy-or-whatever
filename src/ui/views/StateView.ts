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
import type { StateData } from '../../_common/models/state.models';
import type { StateDisplayOptions } from '../../_common/models/ui.models';
import { FONT_FAMILY } from '../../_common/text';
import type { PoliticsManager } from '../../managers/PoliticsManager';
import { StateManager } from '../../managers/StateManager';
import { InteractivePanelElement } from '../elements/InteractivePanelElement';

/**
 * UI component that displays current state data (name + size).
 */
export class StateDisplay extends InteractivePanelElement {
  private stateManager: StateManager;
  private politicsManager?: PoliticsManager;
  private widthProvider?: () => number;

  private lastRendered:
    | (Pick<StateData, 'name' | 'size'> & { politicsVersion: number })
    | undefined;

  constructor(options: StateDisplayOptions) {
    super(options);
    this.stateManager = options.stateManager;
    this.politicsManager = options.politicsManager;
    this.widthProvider = options.widthProvider;
  }

  protected redraw(force: boolean): void {
    const state = this.stateManager.getStateRef();
    const politicsVersion = this.politicsManager?.getVersion() ?? -1;
    const next = { name: state.name, size: state.size, politicsVersion };

    if (
      !force &&
      this.lastRendered &&
      this.lastRendered.name === next.name &&
      this.lastRendered.size === next.size &&
      this.lastRendered.politicsVersion === next.politicsVersion
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
    const hasPolitics = !!this.politicsManager;
    const townHallLineH = hasPolitics ? lineGap + subSize : 0;
    const contentH =
      contentPadY + nameSize + lineGap + subSize + townHallLineH + contentPadY;
    const panelH = borderW + sectionH + sepH + contentH + borderW;

    const pressOffset = this.getPressOffset();
    this.pos = vec(this.anchorX, this.anchorY);

    const borderColor = Color.fromHex('#2a4158');
    const accentColor = Color.fromHex('#4a7fb8');
    const primaryColor = Color.fromHex('#e7edf3');
    const secondaryColor = Color.fromHex('#a7bacb');

    const members: GraphicsGrouping[] = [];

    // Idle border (overwritten by hover border on hover)
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

    // Left accent bar (section header area)
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
        text: '🏛 STATE',
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

    // Separator line
    members.push({
      graphic: new Rectangle({
        width: panelW - borderW * 2,
        height: sepH,
        color: borderColor,
      }),
      offset: vec(borderW + pressOffset, borderW + sectionH + pressOffset),
    });

    const contentY = borderW + sectionH + sepH + pressOffset;

    // State name
    members.push({
      graphic: new Text({
        text: state.name,
        font: new Font({
          size: nameSize,
          unit: FontUnit.Px,
          color: primaryColor,
          family: FONT_FAMILY,
        }),
      }),
      offset: vec(contentPadX + pressOffset, contentY + contentPadY),
    });

    // Territory sub-line
    members.push({
      graphic: new Text({
        text: `Territory: ${state.size}`,
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

    // Town Hall status line
    if (this.politicsManager) {
      const requestCount = this.politicsManager.getActiveRequests().length;
      const townHallText =
        requestCount > 0
          ? `Town Hall: ${requestCount} ${requestCount === 1 ? 'request' : 'requests'}`
          : 'Town Hall: Idle';
      const townHallColor =
        requestCount > 0 ? Color.fromHex('#52b66f') : Color.fromHex('#6b7b8d');
      members.push({
        graphic: new Text({
          text: townHallText,
          font: new Font({
            size: subSize,
            unit: FontUnit.Px,
            color: townHallColor,
            family: FONT_FAMILY,
          }),
        }),
        offset: vec(
          contentPadX + pressOffset,
          contentY + contentPadY + nameSize + lineGap + subSize + lineGap
        ),
      });
    }

    this.addHoverBorder(members, panelW, panelH);

    this.graphics.use(new GraphicsGroup({ members }));
  }
}
