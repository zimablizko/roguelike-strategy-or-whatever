import { Color, Font, FontUnit, ScreenElement, Text } from 'excalibur';
import type { MilitaryPopupOptions } from '../../_common/models/ui.models';
import { FONT_FAMILY } from '../../_common/text';
import { getAllUnitDefinitions } from '../../data/military';
import { BuildingManager } from '../../managers/BuildingManager';
import { MilitaryManager } from '../../managers/MilitaryManager';
import { UI_Z } from '../constants/ZLayers';
import { ScreenPopup } from '../elements/ScreenPopup';

export class MilitaryPopup extends ScreenPopup {
  private readonly militaryManager: MilitaryManager;
  private readonly buildingManager: BuildingManager;
  private contentRootRef?: ScreenElement;
  private bodyRoot?: ScreenElement;
  private lastMilitaryVersion = -1;
  private lastBuildingsVersion = -1;

  constructor(options: MilitaryPopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: 560,
      height: 520,
      title: 'Military',
      z: UI_Z.statePopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      bgColor: Color.fromHex('#1a1f2a'),
      headerColor: Color.fromHex('#2a1520'),
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.contentRootRef = contentRoot;
        this.renderBody();
      },
    });

    this.militaryManager = options.militaryManager;
    this.buildingManager = options.buildingManager;
  }

  onPreUpdate(): void {
    super.onPreUpdate();
    const militaryVersion = this.militaryManager.getMilitaryVersion();
    const buildingsVersion = this.buildingManager.getBuildingsVersion();
    if (
      militaryVersion !== this.lastMilitaryVersion ||
      buildingsVersion !== this.lastBuildingsVersion
    ) {
      this.lastMilitaryVersion = militaryVersion;
      this.lastBuildingsVersion = buildingsVersion;
      this.renderBody();
    }
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

    const snapshot = this.militaryManager.getSnapshot();
    const totalPopulation = this.buildingManager.getTotalPopulation();
    const occupiedPopulation = this.buildingManager.getOccupiedPopulation();
    const freePopulation = this.buildingManager.getFreePopulation();
    const titleColor = Color.fromHex('#f0f4f8');
    const muted = Color.fromHex('#b0bcc8');
    const light = Color.fromHex('#dce6ef');

    let y = 0;
    const addLine = (
      text: string,
      size: number,
      color: Color,
      gapAfter = 5
    ) => {
      body.addChild(MilitaryPopup.createLine(0, y, text, size, color));
      y += size + gapAfter;
    };

    addLine(`Total Military Power: ${snapshot.totalPower}`, 18, titleColor, 10);
    addLine(
      `Population Occupied: ${occupiedPopulation}/${totalPopulation}  |  Free: ${freePopulation}`,
      13,
      muted,
      4
    );
    addLine(
      `Barracks: ${this.buildingManager.getBuildingCount('barracks')}  |  Castles: ${this.buildingManager.getBuildingCount('castle')}`,
      13,
      muted,
      12
    );

    addLine('Unit Roster', 16, titleColor, 8);
    let hasUnits = false;
    for (const definition of getAllUnitDefinitions()) {
      const total = this.militaryManager.getUnitCount(definition.id);
      if (total <= 0) {
        continue;
      }
      hasUnits = true;
      addLine(`  ${definition.name}: ${total}`, 13, light, 4);
    }
    if (!hasUnits) {
      addLine('  No raised units.', 13, muted, 4);
    }

    y += 8;
    addLine('Active Musters', 16, titleColor, 8);
    const progressList = this.buildingManager.getBuildingActionProgresses();
    if (progressList.length === 0) {
      addLine('  No training or musters in progress.', 13, muted, 4);
      addLine('  Use Barracks or Castle actions to raise units.', 13, muted, 4);
      return;
    }

    for (const progress of progressList) {
      const sourceLabel =
        progress.buildingId === 'castle' ? 'Castle' : 'Barracks';
      addLine(
        `  ${sourceLabel}: +${progress.unitCount} ${MilitaryPopup.getUnitLabel(progress.unitId)} in ${progress.turnsLeft} turn${progress.turnsLeft === 1 ? '' : 's'}`,
        13,
        light,
        4
      );
    }
  }

  private static getUnitLabel(unitId: string): string {
    switch (unitId) {
      case 'footman':
        return 'Footmen';
      case 'archer':
        return 'Archers';
      case 'militia':
        return 'Militia';
      case 'spy':
        return 'Spies';
      case 'engineer':
        return 'Engineers';
      default:
        return unitId;
    }
  }

  private static createLine(
    x: number,
    y: number,
    text: string,
    size: number,
    color: Color
  ): ScreenElement {
    const element = new ScreenElement({ x, y });
    element.graphics.use(
      new Text({
        text,
        font: new Font({
          size,
          unit: FontUnit.Px,
          color,
          family: FONT_FAMILY,
        }),
      })
    );
    return element;
  }
}
