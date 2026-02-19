import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  Rectangle,
  ScreenElement,
  Text,
  vec,
  type GraphicsGrouping,
  type Scene,
} from 'excalibur';
import { clamp } from '../../_common/math';
import type {
  StateBuildingActionDefinition,
  TypedBuildingDefinition,
} from '../../_common/models/buildings.models';
import type { ResourceType } from '../../_common/models/resource.models';
import type { TooltipOutcome } from '../../_common/models/tooltip.models';
import type { SelectedBuildingViewOptions } from '../../_common/models/ui.models';
import { Resources } from '../../_common/resources';
import { measureTextWidth } from '../../_common/text';
import { BuildingManager } from '../../managers/BuildingManager';
import { ResourceManager } from '../../managers/ResourceManager';
import { StateManager } from '../../managers/StateManager';
import { TurnManager } from '../../managers/TurnManager';
import { ActionElement } from '../elements/ActionElement';
import { TooltipProvider } from '../tooltip/TooltipProvider';

export class SelectedBuildingView extends ScreenElement {
  private readonly stateManager: StateManager;
  private readonly buildingManager: BuildingManager;
  private readonly resourceManager: ResourceManager;
  private readonly turnManager: TurnManager;
  private readonly tooltipProvider: TooltipProvider;
  private readonly onActionHover?: (
    buildingId: string,
    actionId: string,
    instanceId: string,
    hovered: boolean
  ) => void;
  private readonly minPanelWidth: number;
  private readonly maxPanelWidth: number;
  private readonly panelHeight: number;
  private readonly bottomMargin: number;

  private currentPanelWidth: number;
  private selectedBuildingInstanceId?: string;
  private actionRows: ActionElement[] = [];
  private lastBuildingsVersion = -1;
  private lastResourcesVersion = -1;
  private lastTurnVersion = -1;
  private lastSelectedId?: string;

  constructor(options: SelectedBuildingViewOptions) {
    super({ x: 0, y: 0 });
    this.stateManager = options.stateManager;
    this.buildingManager = options.buildingManager;
    this.resourceManager = options.resourceManager;
    this.turnManager = options.turnManager;
    this.tooltipProvider = options.tooltipProvider;
    this.onActionHover = options.onActionHover;
    this.minPanelWidth = 420;
    this.maxPanelWidth = options.width ?? 560;
    this.panelHeight = options.height ?? 118;
    this.bottomMargin = options.bottomMargin ?? 8;
    this.currentPanelWidth = this.minPanelWidth;
  }

  onInitialize(): void {
    this.graphics.isVisible = false;
    this.updateDisplay(true);
    this.updatePosition();
  }

  onPreUpdate(): void {
    this.updateDisplay(false);
    this.updatePosition();
  }

  override onPreKill(_scene: Scene): void {
    this.clearActionRows();
  }

  setSelectedBuilding(instanceId: string | undefined): void {
    if (this.selectedBuildingInstanceId === instanceId) {
      return;
    }

    this.selectedBuildingInstanceId = instanceId;
    this.lastBuildingsVersion = -1;
  }

  containsScreenPoint(screenX: number, screenY: number): boolean {
    if (!this.graphics.isVisible) {
      return false;
    }

    const x = this.globalPos.x;
    const y = this.globalPos.y;
    return (
      screenX >= x &&
      screenX <= x + this.currentPanelWidth &&
      screenY >= y &&
      screenY <= y + this.panelHeight
    );
  }

  private updatePosition(): void {
    const engine = this.scene?.engine;
    if (!engine) {
      return;
    }

    this.pos = vec(
      (engine.drawWidth - this.currentPanelWidth) / 2,
      engine.drawHeight - this.panelHeight - this.bottomMargin
    );
  }

  private updateDisplay(force: boolean): void {
    const bv = this.buildingManager.getBuildingsVersion();
    const rv = this.resourceManager.getResourcesVersion();
    const tv = this.turnManager.getTurnVersion();
    const selId = this.selectedBuildingInstanceId;

    if (
      !force &&
      bv === this.lastBuildingsVersion &&
      rv === this.lastResourcesVersion &&
      tv === this.lastTurnVersion &&
      selId === this.lastSelectedId
    ) {
      return;
    }

    this.lastBuildingsVersion = bv;
    this.lastResourcesVersion = rv;
    this.lastTurnVersion = tv;
    this.lastSelectedId = selId;

    const state = this.stateManager.getStateRef();
    const selected = selId
      ? this.buildingManager
          .getBuildingMapOverlays()
          .find((item) => item.instanceId === selId)
      : undefined;

    this.clearActionRows();

    if (!selected) {
      this.graphics.isVisible = false;
      this.graphics.use(new GraphicsGroup({ members: [] }));
      return;
    }

    this.graphics.isVisible = true;

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: this.currentPanelWidth,
          height: this.panelHeight,
          color: Color.fromRGB(14, 24, 35, 0.86),
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: this.currentPanelWidth,
          height: 1,
          color: Color.fromRGB(170, 196, 220, 0.55),
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: this.currentPanelWidth,
          height: 1,
          color: Color.fromRGB(170, 196, 220, 0.55),
        }),
        offset: vec(0, this.panelHeight - 1),
      },
    ];

    const definition = this.buildingManager.getBuildingDefinition(
      selected.buildingId
    );
    if (!definition) {
      this.graphics.isVisible = false;
      this.graphics.use(new GraphicsGroup({ members }));
      return;
    }

    const count = this.buildingManager.getBuildingCount(definition.id);
    const stats = definition.getStats(state, count).slice(0, 2);
    const areaLine = `Area ${selected.width}x${selected.height}  Count ${count}`;

    const leftSectionMaxLineWidth = Math.max(
      measureTextWidth('Selected', 12),
      measureTextWidth(definition.name, 20),
      measureTextWidth(areaLine, 12),
      ...stats.map((stat) => measureTextWidth(`- ${stat}`, 12))
    );
    const leftSectionWidth = clamp(
      Math.ceil(leftSectionMaxLineWidth) + 12,
      180,
      280
    );

    const actionButtonWidth = this.resolveActionButtonWidth(definition.actions);
    const contentGap = 14;
    const sidePadding = 12;
    const desiredPanelWidth =
      sidePadding +
      leftSectionWidth +
      contentGap +
      actionButtonWidth +
      sidePadding;

    const engine = this.scene?.engine;
    const viewportMaxWidth = engine
      ? engine.drawWidth - 24
      : this.maxPanelWidth;
    this.currentPanelWidth = clamp(
      desiredPanelWidth,
      this.minPanelWidth,
      Math.min(this.maxPanelWidth, viewportMaxWidth)
    );

    const statsBaseY = 58;
    const statsGap = 17;
    const actionsTitleX = this.currentPanelWidth - actionButtonWidth - 12;

    members.push(
      this.createTextMember('Selected', 12, Color.fromHex('#9fb4c8'), 12, 8),
      this.createTextMember(
        definition.name,
        20,
        Color.fromHex('#f0f4f8'),
        12,
        24
      ),
      this.createTextMember(areaLine, 12, Color.fromHex('#cfd9e2'), 12, 46)
    );

    let statY = statsBaseY;
    for (const stat of stats) {
      members.push(
        this.createTextMember(
          `- ${stat}`,
          12,
          Color.fromHex('#dce6ef'),
          12,
          statY
        )
      );
      statY += statsGap;
    }

    members.push(
      this.createTextMember(
        'Actions',
        14,
        Color.fromHex('#f0f4f8'),
        actionsTitleX,
        8
      )
    );

    this.graphics.use(new GraphicsGroup({ members }));
    this.createActionRows(definition, actionsTitleX, 30, actionButtonWidth);
  }

  private createActionRows(
    definition: TypedBuildingDefinition,
    startX: number,
    startY: number,
    rowWidth: number
  ): void {
    if (definition.actions.length === 0) {
      this.addChild(
        this.createStaticTextElement(
          'No actions available.',
          12,
          Color.fromHex('#a9bbcb'),
          startX,
          startY + 8
        )
      );
      return;
    }

    let y = startY;
    const instanceId = this.selectedBuildingInstanceId ?? '';
    const hasActionPoint = this.turnManager.getTurnDataRef().focus.current >= 1;
    for (const action of definition.actions) {
      if (y + 36 > this.panelHeight - 8) {
        break;
      }

      const actionStatus = this.buildingManager.canActivateBuildingAction(
        definition.id,
        action.id,
        instanceId
      );
      const enabled = hasActionPoint && actionStatus.activatable;
      const usesMax = actionStatus.usesMax ?? 0;
      const usesLabel =
        usesMax > 1 ? ` (${actionStatus.usesRemaining}/${usesMax})` : '';
      const disabledReason =
        !enabled && actionStatus.reason ? `\n\n⚠ ${actionStatus.reason}` : '';
      const row = new ActionElement({
        x: startX,
        y,
        width: rowWidth,
        height: 34,
        title: action.name + usesLabel,
        description: action.description + disabledReason,
        outcomes: this.getActionOutcomes(definition, action, instanceId),
        tooltipProvider: this.tooltipProvider,
        bgColor: enabled ? Color.fromHex('#274158') : Color.fromHex('#2a2f35'),
        hoverBgColor: enabled
          ? Color.fromHex('#356083')
          : Color.fromHex('#2a2f35'),
        pressedBgColor: enabled
          ? Color.fromHex('#2e5270')
          : Color.fromHex('#2a2f35'),
        hoverBorderColor: enabled
          ? Color.fromHex('#f1c40f')
          : Color.fromHex('#555d66'),
        textColor: enabled ? Color.White : Color.fromHex('#8b97a3'),
        tooltipWidth: 260,
        onClick: enabled
          ? () => {
              if (!this.turnManager.spendFocus(1)) {
                return;
              }
              const activated = this.buildingManager.activateBuildingAction(
                definition.id,
                action.id,
                instanceId,
                this.resourceManager
              );
              if (!activated) {
                return;
              }
              this.lastBuildingsVersion = -1;
            }
          : undefined,
        onHoverEnter: () =>
          this.onActionHover?.(definition.id, action.id, instanceId, true),
        onHoverLeave: () =>
          this.onActionHover?.(definition.id, action.id, instanceId, false),
      });

      this.actionRows.push(row);
      this.addChild(row);
      y += 38;
    }
  }

  private resolveActionButtonWidth(
    actions: ReadonlyArray<StateBuildingActionDefinition>
  ): number {
    if (actions.length === 0) {
      return 188;
    }

    const widestTitle = actions.reduce(
      (max, action) => Math.max(max, measureTextWidth(action.name, 16)),
      0
    );

    return clamp(Math.ceil(widestTitle) + 26, 188, 300);
  }

  private getActionOutcomes(
    definition: TypedBuildingDefinition,
    action: StateBuildingActionDefinition,
    instanceId: string
  ): TooltipOutcome[] {
    const state = this.stateManager.getStateRef();
    const buildingCount = Math.max(
      1,
      this.buildingManager.getBuildingCount(definition.id)
    );

    // Lumbermill: compute preview yield from actual in-range forest tiles.
    if (definition.id === 'lumbermill' && action.id === 'harvest-timber') {
      const { forestCount, estimatedYield } =
        this.buildingManager.getLumermillHarvestYieldPreview(instanceId);
      if (forestCount === 0) {
        return [];
      }
      return [
        {
          label: '',
          icon: this.getResourceIcon('materials'),
          value: `+${estimatedYield}`,
          color: Color.fromHex('#9fe6aa'),
        },
      ];
    }

    const gainByBuilding: Partial<
      Record<TypedBuildingDefinition['id'], number>
    > = {
      mine: Math.max(1, Math.floor(state.tiles.stone / 4)) * buildingCount,
      farm: Math.max(1, Math.floor(state.tiles.plains / 4)) * buildingCount,
    };
    if (definition.id === 'castle' && action.id === 'expand-border') {
      return [
        {
          label: 'Border',
          value: '+1 ring',
          color: Color.fromHex('#9fe6aa'),
        },
      ];
    }
    const value = gainByBuilding[definition.id];
    if (value === undefined) {
      return [{ label: 'Action', value: action.id }];
    }

    const resourceByBuilding: Partial<
      Record<TypedBuildingDefinition['id'], ResourceType>
    > = {
      lumbermill: 'materials',
      mine: 'materials',
      farm: 'food',
    };
    return [
      {
        label: '',
        icon: this.getResourceIcon(resourceByBuilding[definition.id]),
        value: `+${value}`,
        color: Color.fromHex('#9fe6aa'),
      },
    ];
  }

  private getResourceIcon(resourceType: ResourceType | undefined) {
    if (resourceType === 'gold') {
      return Resources.MoneyIcon;
    }
    if (resourceType === 'food') {
      return Resources.FoodIcon;
    }
    if (resourceType === 'materials') {
      return Resources.ResourcesIcon;
    }
    if (resourceType === 'population') {
      return Resources.PopulationIcon;
    }
    return undefined;
  }

  private clearActionRows(): void {
    for (const row of this.actionRows) {
      if (!row.isKilled()) {
        row.kill();
      }
    }
    this.actionRows = [];

    const orphanInfoLines = this.children.filter(
      (child) =>
        child !== undefined && child.name === 'selected-building-info-line'
    );
    for (const line of orphanInfoLines) {
      if (!line.isKilled()) {
        line.kill();
      }
    }
  }

  private createTextMember(
    text: string,
    size: number,
    color: Color,
    x: number,
    y: number
  ): GraphicsGrouping {
    return {
      graphic: new Text({
        text,
        font: new Font({
          size,
          unit: FontUnit.Px,
          color,
        }),
      }),
      offset: vec(x, y),
    };
  }

  private createStaticTextElement(
    text: string,
    size: number,
    color: Color,
    x: number,
    y: number
  ): ScreenElement {
    const line = new ScreenElement({ x, y });
    line.name = 'selected-building-info-line';
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
