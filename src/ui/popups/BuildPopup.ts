import { Color, Font, FontUnit, ScreenElement, Text } from 'excalibur';
import type {
  StateBuildingId,
  TypedBuildingDefinition,
} from '../../_common/models/buildings.models';
import type { ResourceType } from '../../_common/models/resource.models';
import type { BuildPopupOptions } from '../../_common/models/ui.models';
import { wrapText } from '../../_common/text';
import { buildingPassiveIncome } from '../../data/buildings';
import { BuildingManager } from '../../managers/BuildingManager';
import { ResourceManager } from '../../managers/ResourceManager';
import { TurnManager } from '../../managers/TurnManager';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup } from '../elements/ScreenPopup';

/**
 * Popup for confirming construction of a single building.
 */
export class BuildPopup extends ScreenPopup {
  constructor(options: BuildPopupOptions) {
    const definition = options.buildingManager.getBuildingDefinition(
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
          options.buildingManager,
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
    buildingManager: BuildingManager,
    resourceManager: ResourceManager,
    turnManager: TurnManager,
    onBuilt: ((buildingId: StateBuildingId) => void) | undefined
  ): void {
    const count = buildingManager.getBuildingCount(definition.id);
    const status = buildingManager.canBuildBuilding(
      definition.id,
      resourceManager
    );
    const lineColor = Color.fromHex('#e4ecf4');
    const warnColor = Color.fromHex('#f5c179');
    const okColor = Color.fromHex('#9fe6aa');
    const lineWrapWidth = 470;
    const hasActionPoint = turnManager.getTurnDataRef().focus.current >= 1;

    let y = 0;
    const line = (text: string, size = 14, color = lineColor, gapAfter = 6) => {
      const element = BuildPopup.createLine(0, y, text, size, color);
      contentRoot.addChild(element);
      y += size + gapAfter;
    };

    if (definition.unique) {
      line(`Built: ${count}/1`, 12, count > 0 ? okColor : lineColor, 10);
    }

    for (const descriptionLine of wrapText(
      definition.description,
      lineWrapWidth,
      14
    )) {
      line(descriptionLine, 14, lineColor, 4);
    }
    y += 6;

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    if (definition.populationProvided) {
      line(
        `Permanent: +${definition.populationProvided} Population`,
        13,
        okColor,
        4
      );
    }

    const passiveEntries = buildingPassiveIncome[definition.id] ?? [];
    if (passiveEntries.length > 0) {
      const parts = passiveEntries.map((entry) => {
        if (typeof entry.amount === 'string') {
          const p = entry.amount.split(':');
          return `+${p[1]}\u2013${p[2]} ${capitalize(entry.resourceType)}`;
        }
        const pos = entry.amount >= 0;
        return `${pos ? '+' : ''}${entry.amount} ${capitalize(entry.resourceType)}`;
      });
      line(`Each turn: ${parts.join(', ')}`, 13, okColor, 4);
    }

    y += 4;
    const tileNames = definition.placementRule.allowedTiles
      .map(capitalize)
      .join(', ');
    line(`Placement: ${tileNames}`, 13, lineColor, 8);

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
        const unlocked = buildingManager.isTechnologyUnlocked(technology);
        line(`- ${technology}`, 13, unlocked ? okColor : warnColor, 4);
      }
      y += 4;
    }

    if (definition.populationRequired) {
      const freePop = buildingManager.getFreePopulation();
      const enough = freePop >= definition.populationRequired;
      line(
        `Population required: ${definition.populationRequired} (free: ${freePop})`,
        14,
        enough ? okColor : warnColor,
        8
      );
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
        if (!turnManager.spendFocus(1)) {
          return;
        }
        const built = buildingManager.buildBuilding(
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
