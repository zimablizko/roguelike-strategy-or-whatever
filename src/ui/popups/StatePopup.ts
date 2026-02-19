import { Color, Font, FontUnit, ScreenElement, Text } from 'excalibur';
import type { StatePopupOptions } from '../../_common/models/ui.models';
import { BuildingManager } from '../../managers/BuildingManager';
import { ResourceManager } from '../../managers/ResourceManager';
import { StateManager } from '../../managers/StateManager';
import { TurnManager } from '../../managers/TurnManager';
import { STATE_POPUP_LAYOUT } from '../constants/StatePopupConstants';
import { UI_Z } from '../constants/ZLayers';
import { ScreenPopup } from '../elements/ScreenPopup';

/**
 * Dedicated popup for state details.
 */
export class StatePopup extends ScreenPopup {
  private stateManager: StateManager;
  private buildingManager: BuildingManager;
  private resourceManager: ResourceManager;
  private turnManager: TurnManager;
  private contentRootRef?: ScreenElement;
  private bodyRoot?: ScreenElement;

  constructor(options: StatePopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: STATE_POPUP_LAYOUT.width,
      height: STATE_POPUP_LAYOUT.height,
      title: `State: ${options.stateManager.getStateRef().name}`,
      z: UI_Z.statePopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.contentRootRef = contentRoot;
        this.renderBody();
      },
    });

    this.stateManager = options.stateManager;
    this.buildingManager = options.buildingManager;
    this.resourceManager = options.resourceManager;
    this.turnManager = options.turnManager;
  }

  private renderBody(): void {
    const contentRoot = this.contentRootRef;
    if (!contentRoot) {
      return;
    }

    if (this.bodyRoot && !this.bodyRoot.isKilled()) {
      this.bodyRoot.kill();
    }

    const body = new ScreenElement({ x: 0, y: 0 });
    contentRoot.addChild(body);
    this.bodyRoot = body;
    this.populateOverview(body);
  }

  private populateOverview(root: ScreenElement): void {
    const state = this.stateManager.getStateRef();
    const titleColor = Color.fromHex('#f0f4f8');
    const popColor = Color.fromHex('#e0c6f5');
    const warnColor = Color.fromHex('#f5c179');
    const costColor = Color.fromHex('#f2b0a6');
    const okColor = Color.fromHex('#9fe6aa');

    let y = 0;
    const addLine = (
      text: string,
      size: number,
      color: Color,
      gapAfter = 5
    ) => {
      root.addChild(StatePopup.createLine(0, y, text, size, color));
      y += size + gapAfter;
    };

    addLine(`Total Size: ${state.size}`, 18, titleColor, 12);
    addLine(`Forest: ${state.tiles.forest}`, 14, Color.fromHex('#a8e6a1'));
    addLine(`Stone: ${state.tiles.stone}`, 14, Color.fromHex('#d2d5db'));
    addLine(`Plains: ${state.tiles.plains}`, 14, Color.fromHex('#f5dd90'));
    addLine(`River: ${state.tiles.river}`, 14, Color.fromHex('#9fd3ff'));
    addLine(`Ocean border: ${state.ocean}`, 14, Color.fromHex('#7fb7ff'), 12);

    const totalPop = this.buildingManager.getTotalPopulation();
    const occupiedPop = this.buildingManager.getOccupiedPopulation();
    const freePop = this.buildingManager.getFreePopulation();
    addLine('Population', 16, titleColor, 8);
    addLine(
      `Total: ${totalPop}  |  Occupied: ${occupiedPop}  |  Free: ${freePop}`,
      14,
      freePop > 0 ? popColor : warnColor,
      12
    );

    const upkeep = this.turnManager.getUpkeepBreakdown();
    addLine('Upkeep (per turn)', 16, titleColor, 8);
    addLine(
      `Gold: ${upkeep.totalGold} (base: ${upkeep.baseGold})`,
      14,
      costColor
    );
    addLine(
      `Food: ${upkeep.totalFood} (base: ${upkeep.baseFood} + population: ${upkeep.populationFood})`,
      14,
      costColor
    );

    const currentFood = this.resourceManager.getResource('food');
    const currentGold = this.resourceManager.getResource('gold');
    if (currentFood < upkeep.totalFood || currentGold < upkeep.totalGold) {
      addLine(
        'Warning: insufficient resources for next upkeep!',
        13,
        warnColor,
        4
      );
      return;
    }

    addLine('Upkeep is affordable.', 13, okColor, 4);
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
