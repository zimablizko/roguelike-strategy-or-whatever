import { Color, Font, FontUnit, ScreenElement, Text } from 'excalibur';
import { StateManager } from '../../managers/StateManager';
import { ScreenPopup, type ScreenPopupAnchor } from '../elements/ScreenPopup';

export interface StatePopupOptions {
  x: number;
  y: number;
  stateManager: StateManager;
  anchor?: ScreenPopupAnchor;
  onClose?: () => void;
}

/**
 * Dedicated popup for state details.
 */
export class StatePopup extends ScreenPopup {
  constructor(options: StatePopupOptions) {
    const state = options.stateManager.getState();
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: 720,
      height: 520,
      title: `State: ${state.name}`,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        const header = StatePopup.createLine(
          0,
          0,
          `Total Size: ${state.size}`,
          16,
          Color.fromHex('#f0f4f8')
        );
        const forest = StatePopup.createLine(
          0,
          40,
          `Forest: ${state.tiles.forest}`,
          14,
          Color.fromHex('#a8e6a1')
        );
        const stone = StatePopup.createLine(
          0,
          70,
          `Stone: ${state.tiles.stone}`,
          14,
          Color.fromHex('#d2d5db')
        );
        const plains = StatePopup.createLine(
          0,
          100,
          `Plains: ${state.tiles.plains}`,
          14,
          Color.fromHex('#f5dd90')
        );
        const water = StatePopup.createLine(
          0,
          130,
          `Water: ${state.tiles.water}`,
          14,
          Color.fromHex('#9fd3ff')
        );

        contentRoot.addChild(header);
        contentRoot.addChild(forest);
        contentRoot.addChild(stone);
        contentRoot.addChild(plains);
        contentRoot.addChild(water);
      },
    });
  }

  private static createLine(
    x: number,
    y: number,
    text: string,
    size: number,
    color: Color
  ): ScreenElement {
    const line = new ScreenElement({ x, y });
    line.graphics.use(
      new Text({
        text,
        font: new Font({
          size,
          unit: FontUnit.Px,
          color,
        }),
      })
    );
    return line;
  }
}
