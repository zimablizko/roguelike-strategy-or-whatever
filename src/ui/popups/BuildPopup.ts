import { Color, Font, FontUnit, ScreenElement, Text } from 'excalibur';
import { wrapText } from '../../_common/text';
import {
  ResourceManager,
  type ResourceType,
} from '../../managers/ResourceManager';
import {
  StateManager,
  type StateBuildingId,
  type TypedBuildingDefinition,
} from '../../managers/StateManager';
import { TurnManager } from '../../managers/TurnManager';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup, type ScreenPopupAnchor } from '../elements/ScreenPopup';

export interface BuildPopupOptions {
  x: number;
  y: number;
  buildingId: StateBuildingId;
  stateManager: StateManager;
  resourceManager: ResourceManager;
  turnManager: TurnManager;
  anchor?: ScreenPopupAnchor;
  onBuilt?: (buildingId: StateBuildingId) => void;
  onClose?: () => void;
}

/**
 * Popup for confirming construction of a single building.
 */
export class BuildPopup extends ScreenPopup {
  constructor(options: BuildPopupOptions) {
    const definition = options.stateManager.getBuildingDefinition(
      options.buildingId
    );
    if (!definition) {
      throw new Error(`Unknown building: ${options.buildingId}`);
    }

    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: 520,
      height: 340,
      title: `Build: ${definition.name}`,
      z: UI_Z.modalPopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      bgColor: Color.fromHex('#16222e'),
      headerColor: Color.fromHex('#223241'),
      onClose: options.onClose,
      contentBuilder: (contentRoot, popup) => {
        BuildPopup.populateContent(
          contentRoot,
          popup,
          definition,
          options.stateManager,
          options.resourceManager,
          options.turnManager,
          options.onBuilt
        );
      },
    });
  }

  private static populateContent(
    contentRoot: ScreenElement,
    popup: ScreenPopup,
    definition: TypedBuildingDefinition,
    stateManager: StateManager,
    resourceManager: ResourceManager,
    turnManager: TurnManager,
    onBuilt: ((buildingId: StateBuildingId) => void) | undefined
  ): void {
    const count = stateManager.getBuildingCount(definition.id);
    const status = stateManager.canBuildBuilding(
      definition.id,
      resourceManager
    );
    const lineColor = Color.fromHex('#e4ecf4');
    const warnColor = Color.fromHex('#f5c179');
    const okColor = Color.fromHex('#9fe6aa');
    const lineWrapWidth = 470;
    const hasActionPoint =
      turnManager.getTurnDataRef().actionPoints.current >= 1;

    let y = 0;
    const line = (text: string, size = 14, color = lineColor, gapAfter = 6) => {
      const element = BuildPopup.createLine(0, y, text, size, color);
      contentRoot.addChild(element);
      y += size + gapAfter;
    };

    if (definition.unique) {
      line(`Built: ${count}/1`, 14, count > 0 ? okColor : lineColor, 8);
    } else {
      line(`Built: ${count}`, 14, lineColor, 8);
    }

    for (const descriptionLine of wrapText(
      definition.description,
      lineWrapWidth,
      14
    )) {
      line(descriptionLine, 14, lineColor, 4);
    }
    y += 4;
    line(`Placement: ${definition.placementDescription}`, 13, lineColor, 8);

    y += 8;
    line('Next build cost:', 15, Color.fromHex('#f0f4f8'), 8);

    const costEntries = Object.entries(status.nextCost) as [
      ResourceType,
      number,
    ][];
    if (costEntries.length === 0) {
      line('- No resource cost', 13, okColor, 6);
    } else {
      for (const [resource, amount] of costEntries) {
        const have = resourceManager.getResource(resource);
        const ok = have >= amount;
        line(
          `- ${resource}: ${amount} (you have ${have})`,
          13,
          ok ? okColor : warnColor,
          4
        );
      }
      y += 4;
    }

    line('Technologies:', 15, Color.fromHex('#f0f4f8'), 8);
    if (definition.requiredTechnologies.length === 0) {
      line('- No technology requirements', 13, okColor, 6);
    } else {
      for (const technology of definition.requiredTechnologies) {
        const unlocked = stateManager.isTechnologyUnlocked(technology);
        line(`- ${technology}`, 13, unlocked ? okColor : warnColor, 4);
      }
      y += 4;
    }

    if (status.buildable) {
      line('Ready to build.', 13, okColor, 10);
    } else {
      line('Requirements are not met yet.', 13, warnColor, 10);
      if (!status.placementAvailable && status.placementReason) {
        line(status.placementReason, 12, warnColor, 8);
      }
    }

    const buttonY = Math.min(230, y + 6);
    const buildButton = new ScreenButton({
      x: 0,
      y: buttonY,
      width: 140,
      height: 38,
      title: 'Build',
      onClick: () => {
        if (!turnManager.spendActionPoints(1)) {
          return;
        }
        const built = stateManager.buildBuilding(
          definition.id,
          resourceManager
        );
        if (!built) {
          return;
        }
        onBuilt?.(definition.id);
        popup.close();
      },
    });
    if (!status.buildable || !hasActionPoint) {
      buildButton.toggle(false);
    }
    contentRoot.addChild(buildButton);

    const cancelButton = new ScreenButton({
      x: 160,
      y: buttonY,
      width: 140,
      height: 38,
      title: 'Cancel',
      onClick: () => popup.close(),
    });
    contentRoot.addChild(cancelButton);
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
