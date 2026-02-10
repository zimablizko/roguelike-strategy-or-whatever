import {
  Color,
  Font,
  FontUnit,
  ScreenElement,
  Text,
  type Scene,
} from 'excalibur';
import {
  ResourceManager,
  type ResourceType,
} from '../../managers/ResourceManager';
import {
  StateManager,
  type StateBuildingActionDefinition,
  type StateBuildingDefinition,
  type StateBuildingId,
} from '../../managers/StateManager';
import { ActionElement } from '../elements/ActionElement';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenList } from '../elements/ScreenList';
import { ScreenPopup, type ScreenPopupAnchor } from '../elements/ScreenPopup';
import { TooltipProvider } from '../tooltip/TooltipProvider';
import { BuildPopup } from './BuildPopup';

export interface StatePopupOptions {
  x: number;
  y: number;
  stateManager: StateManager;
  resourceManager: ResourceManager;
  tooltipProvider: TooltipProvider;
  anchor?: ScreenPopupAnchor;
  onClose?: () => void;
}

type StatePopupTab = 'overview' | 'buildings';

interface BuildingListItem {
  id: StateBuildingId;
  name: string;
  built: boolean;
}

const POPUP_WIDTH = 820;
const POPUP_HEIGHT = 560;
const POPUP_PADDING = 14;
const POPUP_HEADER_HEIGHT = 44;
const BODY_OFFSET_Y = 46;

/**
 * Dedicated popup for state details and buildings management.
 */
export class StatePopup extends ScreenPopup {
  private stateManager: StateManager;
  private resourceManager: ResourceManager;
  private tooltipProvider: TooltipProvider;

  private contentRootRef?: ScreenElement;
  private bodyRoot?: ScreenElement;
  private selectedTab: StatePopupTab = 'overview';
  private selectedBuildingId?: StateBuildingId;
  private buildPopup?: BuildPopup;

  constructor(options: StatePopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      title: `State: ${options.stateManager.getStateRef().name}`,
      z: UI_Z.statePopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.contentRootRef = contentRoot;
        this.buildStaticLayout();
        this.renderBody();
      },
    });
    this.stateManager = options.stateManager;
    this.resourceManager = options.resourceManager;
    this.tooltipProvider = options.tooltipProvider;

    const firstBuilding = this.stateManager.getBuildingDefinitions()[0];
    this.selectedBuildingId = firstBuilding?.id;
  }

  override onPreKill(scene: Scene): void {
    if (this.buildPopup && !this.buildPopup.isKilled()) {
      this.buildPopup.close();
    }
    super.onPreKill(scene);
  }

  private buildStaticLayout(): void {
    const contentRoot = this.contentRootRef;
    if (!contentRoot) return;

    const tabOverview = new ScreenButton({
      x: 0,
      y: 0,
      width: 150,
      height: 34,
      title: 'Overview',
      onClick: () => {
        if (this.selectedTab === 'overview') return;
        this.selectedTab = 'overview';
        this.renderBody();
      },
    });

    const tabBuildings = new ScreenButton({
      x: 160,
      y: 0,
      width: 150,
      height: 34,
      title: 'Buildings',
      onClick: () => {
        if (this.selectedTab === 'buildings') return;
        this.selectedTab = 'buildings';
        this.renderBody();
      },
    });

    contentRoot.addChild(tabOverview);
    contentRoot.addChild(tabBuildings);
  }

  private renderBody(): void {
    const contentRoot = this.contentRootRef;
    if (!contentRoot) return;

    this.tooltipProvider.hide();

    if (this.bodyRoot && !this.bodyRoot.isKilled()) {
      this.bodyRoot.kill();
    }

    const body = new ScreenElement({ x: 0, y: BODY_OFFSET_Y });
    contentRoot.addChild(body);
    this.bodyRoot = body;

    if (this.selectedTab === 'overview') {
      this.populateOverviewTab(body);
      return;
    }

    this.populateBuildingsTab(body);
  }

  private populateOverviewTab(root: ScreenElement): void {
    const state = this.stateManager.getStateRef();
    const builtCount = this.stateManager
      .getBuildingDefinitions()
      .filter((building) =>
        this.stateManager.isBuildingBuilt(building.id)
      ).length;

    root.addChild(
      StatePopup.createLine(
        0,
        0,
        `Total Size: ${state.size}`,
        18,
        Color.fromHex('#f0f4f8')
      )
    );
    root.addChild(
      StatePopup.createLine(
        0,
        36,
        `Forest: ${state.tiles.forest}`,
        14,
        Color.fromHex('#a8e6a1')
      )
    );
    root.addChild(
      StatePopup.createLine(
        0,
        62,
        `Stone: ${state.tiles.stone}`,
        14,
        Color.fromHex('#d2d5db')
      )
    );
    root.addChild(
      StatePopup.createLine(
        0,
        88,
        `Plains: ${state.tiles.plains}`,
        14,
        Color.fromHex('#f5dd90')
      )
    );
    root.addChild(
      StatePopup.createLine(
        0,
        114,
        `Water: ${state.tiles.water}`,
        14,
        Color.fromHex('#9fd3ff')
      )
    );
    root.addChild(
      StatePopup.createLine(
        0,
        156,
        `Buildings built: ${builtCount}/${this.stateManager.getBuildingDefinitions().length}`,
        14,
        Color.fromHex('#cfd9e2')
      )
    );
  }

  private populateBuildingsTab(root: ScreenElement): void {
    const panelWidth = POPUP_WIDTH - POPUP_PADDING * 2;
    const panelHeight =
      POPUP_HEIGHT - POPUP_HEADER_HEIGHT - POPUP_PADDING - BODY_OFFSET_Y - 8;
    const leftWidth = 270;
    const rightX = leftWidth + 18;
    const rightWidth = panelWidth - rightX;

    const buildingDefinitions = this.stateManager.getBuildingDefinitions();
    if (!buildingDefinitions.length) {
      root.addChild(
        StatePopup.createLine(
          0,
          0,
          'No buildings defined.',
          14,
          Color.fromHex('#f5c179')
        )
      );
      return;
    }

    if (
      !this.selectedBuildingId ||
      !buildingDefinitions.find((item) => item.id === this.selectedBuildingId)
    ) {
      this.selectedBuildingId = buildingDefinitions[0].id;
    }

    const listItems: BuildingListItem[] = buildingDefinitions.map(
      (definition) => ({
        id: definition.id,
        name: definition.name,
        built: this.stateManager.isBuildingBuilt(definition.id),
      })
    );

    const buildingList = new ScreenList<BuildingListItem>({
      x: 0,
      y: 0,
      width: leftWidth,
      height: panelHeight,
      itemHeight: 42,
      gap: 6,
      items: listItems,
      showScrollbar: true,
      getItemLabel: (item) =>
        item.built ? item.name : `${item.name} (Not built)`,
      isItemSelected: (item) => item.id === this.selectedBuildingId,
      onItemActivate: (item) => {
        this.selectedBuildingId = item.id;
        this.renderBody();
      },
    });
    root.addChild(buildingList);

    const selectedDefinition = this.stateManager.getBuildingDefinition(
      this.selectedBuildingId
    );
    if (!selectedDefinition) {
      return;
    }

    const detailsRoot = new ScreenElement({ x: rightX, y: 0 });
    root.addChild(detailsRoot);
    this.populateBuildingDetails(
      detailsRoot,
      selectedDefinition,
      rightWidth,
      panelHeight
    );
  }

  private populateBuildingDetails(
    detailsRoot: ScreenElement,
    definition: StateBuildingDefinition,
    width: number,
    panelHeight: number
  ): void {
    const titleColor = Color.fromHex('#f0f4f8');
    const textColor = Color.fromHex('#dce6ef');
    const okColor = Color.fromHex('#9fe6aa');
    const warnColor = Color.fromHex('#f5c179');
    const built = this.stateManager.isBuildingBuilt(definition.id);
    const buildStatus = this.stateManager.canBuildBuilding(
      definition.id,
      this.resourceManager
    );
    const state = this.stateManager.getStateRef();
    const actionRows: ActionElement[] = [];

    let y = 0;
    const addLine = (
      text: string,
      size = 14,
      color = textColor,
      gapAfter = 5
    ) => {
      detailsRoot.addChild(StatePopup.createLine(0, y, text, size, color));
      y += size + gapAfter;
    };

    addLine(definition.name, 20, titleColor, 10);
    addLine(
      built ? 'Status: Built' : 'Status: Not built yet',
      14,
      built ? okColor : warnColor,
      10
    );

    for (const line of StatePopup.wrapText(definition.description, width, 14)) {
      addLine(line, 14, textColor, 4);
    }
    y += 8;

    addLine('Stats', 16, titleColor, 8);
    for (const stat of definition.getStats(state)) {
      addLine(`- ${stat}`, 13, textColor, 4);
    }
    y += 8;

    if (!built) {
      addLine('Build Requirements', 16, titleColor, 8);
      for (const [resourceType, amount] of Object.entries(
        definition.buildCost
      ) as [ResourceType, number][]) {
        const have = this.resourceManager.getResource(resourceType);
        addLine(
          `- ${resourceType}: ${amount} (you have ${have})`,
          13,
          have >= amount ? okColor : warnColor,
          4
        );
      }
      if (definition.requiredTechnologies.length === 0) {
        addLine('- technologies: none', 13, okColor, 4);
      } else {
        for (const technology of definition.requiredTechnologies) {
          const unlocked = this.stateManager.isTechnologyUnlocked(technology);
          addLine(
            `- tech: ${technology}`,
            13,
            unlocked ? okColor : warnColor,
            4
          );
        }
      }
      y += 10;
    }

    addLine('Actions', 16, titleColor, 8);

    if (!built) {
      const actionWidth = Math.min(width, 480);
      const buildAction = this.createBuildingActionRow({
        x: 0,
        y,
        width: actionWidth,
        title: 'Build',
        description:
          'Construct this building in the state. Available only if all requirements are met.',
        outcomes: this.getBuildOutcomes(definition),
        enabled: buildStatus.buildable,
        onClick: () => this.openBuildPopup(definition.id),
      });
      actionRows.push(buildAction);
      detailsRoot.addChild(buildAction);
      y += 52;

      if (!buildStatus.buildable) {
        if (buildStatus.missingTechnologies.length > 0) {
          addLine(
            `Missing tech: ${buildStatus.missingTechnologies.join(', ')}`,
            12,
            warnColor,
            4
          );
        }

        const missingResources = Object.entries(
          buildStatus.missingResources
        ) as [ResourceType, number][];
        if (missingResources.length > 0) {
          const missingText = missingResources
            .map(([type, amount]) => `${type} +${amount}`)
            .join(', ');
          addLine(`Missing resources: ${missingText}`, 12, warnColor, 4);
        }
      }
      this.syncActionRowsHover(actionRows);
      return;
    }

    if (definition.actions.length === 0) {
      addLine('No actions available for this building.', 13, textColor, 4);
      return;
    }

    for (const action of definition.actions) {
      if (y + 46 > panelHeight) {
        addLine(
          'More actions exist; expand panel to view all.',
          12,
          warnColor,
          3
        );
        break;
      }

      const actionRow = this.createBuildingActionRow({
        x: 0,
        y,
        width: Math.min(width, 480),
        title: action.name,
        description: action.description,
        outcomes: this.getBuildingActionOutcomes(definition, action),
        enabled: true,
        onClick: () => {
          const activated = this.stateManager.activateBuildingAction(
            definition.id,
            action.id,
            this.resourceManager
          );
          if (!activated) {
            return;
          }
          this.renderBody();
        },
      });
      actionRows.push(actionRow);
      detailsRoot.addChild(actionRow);
      y += 52;
    }

    this.syncActionRowsHover(actionRows);
  }

  private syncActionRowsHover(actionRows: ActionElement[]): void {
    if (!actionRows.length) {
      return;
    }

    const pointer = this.scene?.engine.input.pointers.primary.lastScreenPos;
    if (!pointer) {
      return;
    }

    for (const row of actionRows) {
      row.syncHoverFromScreenPoint(pointer.x, pointer.y);
    }
  }

  private openBuildPopup(buildingId: StateBuildingId): void {
    const scene = this.scene;
    const engine = scene?.engine;
    if (!scene || !engine) return;

    if (this.buildPopup && !this.buildPopup.isKilled()) {
      this.buildPopup.close();
      this.buildPopup = undefined;
    }

    const popup = new BuildPopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      buildingId,
      stateManager: this.stateManager,
      resourceManager: this.resourceManager,
      onBuilt: () => {
        this.renderBody();
      },
      onClose: () => {
        this.buildPopup = undefined;
      },
    });

    this.buildPopup = popup;
    scene.add(popup);
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

  private static wrapText(
    text: string,
    maxWidth: number,
    fontSize: number
  ): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) {
      return [''];
    }

    const maxChars = Math.max(18, Math.floor(maxWidth / (fontSize * 0.56)));
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  private createBuildingActionRow(options: {
    x: number;
    y: number;
    width: number;
    title: string;
    description: string;
    outcomes: { label: string; value: string | number; color?: Color }[];
    enabled: boolean;
    onClick: () => void;
  }): ActionElement {
    const disabledBg = Color.fromHex('#2a2f35');
    const disabledText = Color.fromHex('#8b97a3');

    return new ActionElement({
      x: options.x,
      y: options.y,
      width: options.width,
      height: 44,
      title: options.title,
      description: options.description,
      outcomes: options.outcomes,
      tooltipProvider: this.tooltipProvider,
      bgColor: options.enabled ? Color.fromHex('#274158') : disabledBg,
      hoverBgColor: options.enabled ? Color.fromHex('#356083') : disabledBg,
      pressedBgColor: options.enabled ? Color.fromHex('#2e5270') : disabledBg,
      hoverBorderColor: options.enabled
        ? Color.fromHex('#f1c40f')
        : Color.fromHex('#555d66'),
      textColor: options.enabled ? Color.White : disabledText,
      onClick: options.enabled ? options.onClick : undefined,
    });
  }

  private getBuildOutcomes(definition: StateBuildingDefinition): {
    label: string;
    value: string | number;
    color?: Color;
  }[] {
    const outcomes: { label: string; value: string | number; color?: Color }[] =
      [];
    for (const [resourceType, amount] of Object.entries(
      definition.buildCost
    ) as [ResourceType, number][]) {
      outcomes.push({
        label: resourceType,
        value: `-${amount}`,
        color: Color.fromHex('#f2b0a6'),
      });
    }

    if (definition.requiredTechnologies.length > 0) {
      outcomes.push({
        label: 'Tech',
        value: definition.requiredTechnologies.join(', '),
        color: Color.fromHex('#f5c179'),
      });
    }

    return outcomes;
  }

  private getBuildingActionOutcomes(
    definition: StateBuildingDefinition,
    action: StateBuildingActionDefinition
  ): { label: string; value: string | number; color?: Color }[] {
    const state = this.stateManager.getStateRef();
    const gainByBuilding: Partial<Record<StateBuildingId, number>> = {
      lumbermill: Math.max(1, Math.floor(state.tiles.forest / 4)),
      mine: Math.max(1, Math.floor(state.tiles.stone / 3)),
      granary: Math.max(1, Math.floor(state.tiles.plains / 5)),
      harbor: Math.max(1, Math.floor(state.tiles.water / 4)),
    };
    const value = gainByBuilding[definition.id];
    if (value === undefined) {
      return [{ label: 'Action', value: action.id }];
    }

    const resourceByBuilding: Record<StateBuildingId, string> = {
      lumbermill: 'Materials',
      mine: 'Materials',
      granary: 'Food',
      harbor: 'Gold',
    };

    return [
      {
        label: resourceByBuilding[definition.id],
        value: `+${value}`,
        color: Color.fromHex('#9fe6aa'),
      },
    ];
  }
}
