import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  Rectangle,
  ScreenElement,
  Text,
  vec,
} from 'excalibur';
import type { RulerData } from '../../_common/models/ruler.models';
import { FONT_FAMILY } from '../../_common/text';
import type { RulerManager } from '../../managers/RulerManager';
import { UI_Z } from '../constants/ZLayers';
import { ScreenPopup } from '../elements/ScreenPopup';

export interface RulerPopupOptions {
  x: number;
  y: number;
  rulerManager: RulerManager;
  onClose?: () => void;
}

/**
 * Popup displaying detailed ruler information.
 * Two-column layout: stats on left, personal actions on right.
 */
export class RulerPopup extends ScreenPopup {
  private static readonly POPUP_WIDTH = 540;
  private static readonly POPUP_HEIGHT = 340;
  private static readonly COLUMN_GAP = 20;
  private static readonly DIVIDER_WIDTH = 2;

  constructor(options: RulerPopupOptions) {
    const ruler = options.rulerManager.getRulerRef();

    super({
      x: options.x,
      y: options.y,
      anchor: 'center',
      width: RulerPopup.POPUP_WIDTH,
      height: RulerPopup.POPUP_HEIGHT,
      title: `Ruler: ${ruler.name}`,
      z: UI_Z.statePopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.buildContent(contentRoot, ruler);
      },
    });
  }

  // ─── Content ─────────────────────────────────────────────────────

  private buildContent(
    contentRoot: ScreenElement,
    ruler: Readonly<RulerData>
  ): void {
    const totalW = RulerPopup.POPUP_WIDTH - 28; // account for popup padding
    const leftW = Math.floor((totalW - RulerPopup.COLUMN_GAP) * 0.5);
    const rightX = leftW + RulerPopup.COLUMN_GAP;

    // Left column: Stats
    this.buildStatsColumn(contentRoot, ruler, leftW);

    // Vertical divider
    const dividerHeight = RulerPopup.POPUP_HEIGHT - 80;
    const divider = new ScreenElement({
      x: leftW + RulerPopup.COLUMN_GAP / 2 - RulerPopup.DIVIDER_WIDTH / 2,
      y: 0,
    });
    divider.graphics.use(
      new Rectangle({
        width: RulerPopup.DIVIDER_WIDTH,
        height: dividerHeight,
        color: Color.fromHex('#3a4f63'),
      })
    );
    contentRoot.addChild(divider);

    // Right column: Personal Actions
    this.buildActionsColumn(contentRoot, rightX);
  }

  // ─── Stats Column (left) ────────────────────────────────────────

  private buildStatsColumn(
    root: ScreenElement,
    ruler: Readonly<RulerData>,
    _columnWidth: number
  ): void {
    const titleColor = Color.fromHex('#d4e6f1');
    const labelColor = Color.fromHex('#8fa8c0');
    const valueColor = Color.White;
    const lineH = 26;
    let y = 0;

    // Section title
    root.addChild(RulerPopup.createText(0, y, 'Stats', 16, titleColor));
    y += lineH + 4;

    // Age
    root.addChild(
      RulerPopup.createStatRow(
        0,
        y,
        'Age',
        String(ruler.age),
        labelColor,
        valueColor
      )
    );
    y += lineH;

    // Focus
    root.addChild(
      RulerPopup.createStatRow(
        0,
        y,
        'Focus',
        String(ruler.focus),
        labelColor,
        valueColor
      )
    );
    y += lineH;

    // Charisma
    root.addChild(
      RulerPopup.createStatRow(
        0,
        y,
        'Charisma',
        String(ruler.charisma),
        labelColor,
        valueColor
      )
    );
    y += lineH;

    // Health
    root.addChild(
      RulerPopup.createStatRow(
        0,
        y,
        'Health',
        ruler.health,
        labelColor,
        RulerPopup.healthColor(ruler.health)
      )
    );
  }

  // ─── Actions Column (right) ─────────────────────────────────────

  private buildActionsColumn(root: ScreenElement, x: number): void {
    const titleColor = Color.fromHex('#d4e6f1');
    const hintColor = Color.fromHex('#5d7b94');

    root.addChild(
      RulerPopup.createText(x, 0, 'Personal Actions', 16, titleColor)
    );
    root.addChild(
      RulerPopup.createText(x, 34, 'No actions available yet.', 13, hintColor)
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private static healthColor(health: string): Color {
    switch (health) {
      case 'Poor':
        return Color.fromHex('#e74c3c');
      case 'Fair':
        return Color.fromHex('#e67e22');
      case 'Good':
        return Color.fromHex('#f1c40f');
      case 'Strong':
        return Color.fromHex('#2ecc71');
      case 'Excellent':
        return Color.fromHex('#27ae60');
      default:
        return Color.White;
    }
  }

  /**
   * Create a label + value stat row.
   * Label on the left, value right-aligned within the row.
   */
  private static createStatRow(
    x: number,
    y: number,
    label: string,
    value: string,
    labelColor: Color,
    valueColor: Color
  ): ScreenElement {
    const container = new ScreenElement({ x, y });
    const labelText = new Text({
      text: `${label}:`,
      font: new Font({
        size: 14,
        unit: FontUnit.Px,
        color: labelColor,
        family: FONT_FAMILY,
      }),
    });
    const valueText = new Text({
      text: value,
      font: new Font({
        size: 14,
        unit: FontUnit.Px,
        color: valueColor,
        family: FONT_FAMILY,
      }),
    });

    // Render label and value with a fixed offset for alignment
    const valueOffset = 120;
    container.graphics.use(
      new GraphicsGroup({
        members: [
          { graphic: labelText, offset: vec(0, 0) },
          { graphic: valueText, offset: vec(valueOffset, 0) },
        ],
      })
    );

    return container;
  }

  private static createText(
    x: number,
    y: number,
    text: string,
    size: number,
    color: Color
  ): ScreenElement {
    const el = new ScreenElement({ x, y });
    el.graphics.use(
      new Text({
        text,
        font: new Font({ size, unit: FontUnit.Px, color, family: FONT_FAMILY }),
      })
    );
    return el;
  }
}
