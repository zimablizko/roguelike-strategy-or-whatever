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
import { StateManager } from '../../managers/StateManager';
import type { StateDisplayOptions } from '../../_common/models/ui.models';
import {
  InteractivePanelElement,
} from '../elements/InteractivePanelElement';

/**
 * UI component that displays current state data (name + size).
 */
export class StateDisplay extends InteractivePanelElement {
  private stateManager: StateManager;
  private textColor: Color;

  private lastRendered: Pick<StateData, 'name' | 'size'> | undefined;

  constructor(options: StateDisplayOptions) {
    super(options);
    this.stateManager = options.stateManager;
    this.textColor = options.textColor ?? Color.White;
  }

  protected redraw(force: boolean): void {
    const state = this.stateManager.getStateRef();
    const next = { name: state.name, size: state.size };

    if (
      !force &&
      this.lastRendered &&
      this.lastRendered.name === next.name &&
      this.lastRendered.size === next.size
    ) {
      return;
    }
    this.lastRendered = next;

    const padding = 10;
    const lineGap = 4;

    const titleText = new Text({
      text: `State: ${state.name}`,
      font: new Font({
        size: 18,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    const sizeText = new Text({
      text: `Size: ${state.size}`,
      font: new Font({
        size: 14,
        unit: FontUnit.Px,
        color: this.textColor,
      }),
    });

    const contentW = padding * 2 + Math.max(titleText.width, sizeText.width);
    const contentH = padding * 2 + titleText.height + lineGap + sizeText.height;
    const backgroundColor = this.getPanelBackgroundColor();
    const pressOffset = this.getPressOffset();

    this.pos = vec(this.anchorX, this.anchorY);

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: contentW,
          height: contentH,
          color: backgroundColor,
        }),
        offset: vec(pressOffset, pressOffset),
      },
      {
        graphic: titleText,
        offset: vec(padding + pressOffset, padding + pressOffset),
      },
      {
        graphic: sizeText,
        offset: vec(
          padding + pressOffset,
          padding + titleText.height + lineGap + pressOffset
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
