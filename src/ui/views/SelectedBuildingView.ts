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
import { getResourceIcon } from '../../_common/icons';
import { clamp } from '../../_common/math';
import type {
  FarmWorkMode,
  LumbermillWorkMode,
} from '../../_common/models/building-manager.models';
import type {
  StateBuildingActionDefinition,
  TypedBuildingDefinition,
} from '../../_common/models/buildings.models';
import type { MapTileType } from '../../_common/models/map.models';
import type { UnitRole } from '../../_common/models/military.models';
import type { ResourceType } from '../../_common/models/resource.models';
import type { TooltipOutcome } from '../../_common/models/tooltip.models';
import type { SelectedBuildingViewOptions } from '../../_common/models/ui.models';
import { FONT_FAMILY, measureTextWidth } from '../../_common/text';
import { buildingPassiveIncome } from '../../data/buildings';
import { BuildingManager } from '../../managers/BuildingManager';
import { ResourceManager } from '../../managers/ResourceManager';
import { StateManager } from '../../managers/StateManager';
import { TurnManager } from '../../managers/TurnManager';
import { ActionElement } from '../elements/ActionElement';
import { TooltipProvider } from '../tooltip/TooltipProvider';

interface BuildingInfoRowSegment {
  value: string;
  resource?: ResourceType;
  isPositive: boolean;
}

interface BuildingInfoRow {
  label: string;
  segments: BuildingInfoRowSegment[];
  isDetail?: boolean;
}

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
  private readonly onActionPulses?: (
    pulses: import('../../_common/models/turn.models').EndTurnIncomePulse[]
  ) => void;
  private readonly onActionPlacementRequest?: (
    buildingId: string,
    actionId: string,
    instanceId: string
  ) => void;
  private readonly mapTileProvider?: (
    x: number,
    y: number
  ) => MapTileType | undefined;
  private readonly minPanelWidth: number;
  private readonly maxPanelWidth: number;
  private readonly panelHeight: number;
  private readonly bottomMargin: number;
  private readonly mapViewportLeft: number;
  private readonly mapViewportWidth: number;

  private currentPanelWidth: number;
  private currentPanelHeight: number;
  private selectedBuildingInstanceId?: string;
  private selectedFieldTile?: { x: number; y: number };
  private actionRows: ActionElement[] = [];
  private lastBuildingsVersion = -1;
  private lastResourcesVersion = -1;
  private lastTurnVersion = -1;
  private lastSelectedId?: string;
  private lastFieldKey?: string;

  constructor(options: SelectedBuildingViewOptions) {
    super({ x: 0, y: 0 });
    this.stateManager = options.stateManager;
    this.buildingManager = options.buildingManager;
    this.resourceManager = options.resourceManager;
    this.turnManager = options.turnManager;
    this.tooltipProvider = options.tooltipProvider;
    this.onActionHover = options.onActionHover;
    this.onActionPulses = options.onActionPulses;
    this.onActionPlacementRequest = options.onActionPlacementRequest;
    this.mapTileProvider = options.mapTileProvider;
    this.minPanelWidth = 420;
    this.maxPanelWidth = options.width ?? 560;
    this.panelHeight = options.height ?? 118;
    this.bottomMargin = options.bottomMargin ?? 8;
    this.mapViewportLeft = options.mapViewportLeft ?? 0;
    this.mapViewportWidth = options.mapViewportWidth ?? 0;
    this.currentPanelWidth = this.minPanelWidth;
    this.currentPanelHeight = this.panelHeight;
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
    if (
      this.selectedBuildingInstanceId === instanceId &&
      !this.selectedFieldTile
    ) {
      return;
    }

    this.selectedBuildingInstanceId = instanceId;
    this.selectedFieldTile = undefined;
    this.lastBuildingsVersion = -1;
  }

  setSelectedField(tileX: number, tileY: number): void {
    if (
      this.selectedFieldTile?.x === tileX &&
      this.selectedFieldTile?.y === tileY
    ) {
      return;
    }

    this.selectedFieldTile = { x: tileX, y: tileY };
    this.selectedBuildingInstanceId = undefined;
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
      screenY <= y + this.currentPanelHeight
    );
  }

  private updatePosition(): void {
    const engine = this.scene?.engine;
    if (!engine) {
      return;
    }

    const vpLeft = this.mapViewportLeft;
    const vpWidth =
      this.mapViewportWidth > 0 ? this.mapViewportWidth : engine.drawWidth;

    this.pos = vec(
      vpLeft + (vpWidth - this.currentPanelWidth) / 2,
      engine.drawHeight - this.currentPanelHeight - this.bottomMargin
    );
  }

  private updateDisplay(force: boolean): void {
    const bv = this.buildingManager.getBuildingsVersion();
    const rv = this.resourceManager.getResourcesVersion();
    const tv = this.turnManager.getTurnVersion();
    const selId = this.selectedBuildingInstanceId;
    const fieldKey = this.selectedFieldTile
      ? `f:${this.selectedFieldTile.x},${this.selectedFieldTile.y}`
      : undefined;

    if (
      !force &&
      bv === this.lastBuildingsVersion &&
      rv === this.lastResourcesVersion &&
      tv === this.lastTurnVersion &&
      selId === this.lastSelectedId &&
      fieldKey === this.lastFieldKey
    ) {
      return;
    }

    this.lastBuildingsVersion = bv;
    this.lastResourcesVersion = rv;
    this.lastTurnVersion = tv;
    this.lastSelectedId = selId;
    this.lastFieldKey = fieldKey;

    // Field tile selection has priority when set.
    if (this.selectedFieldTile) {
      this.clearActionRows();
      this.updateFieldDisplay();
      return;
    }

    const selected = selId
      ? this.buildingManager
          .getBuildingMapOverlays()
          .find((item) => item.instanceId === selId)
      : undefined;

    this.clearActionRows();

    if (!selected) {
      this.currentPanelHeight = this.panelHeight;
      this.graphics.isVisible = false;
      this.graphics.use(new GraphicsGroup({ members: [] }));
      return;
    }

    this.graphics.isVisible = true;

    const definition = this.buildingManager.getBuildingDefinition(
      selected.buildingId
    );
    if (!definition) {
      this.currentPanelHeight = this.panelHeight;
      this.graphics.isVisible = false;
      this.graphics.use(new GraphicsGroup({ members: [] }));
      return;
    }

    const infoRows = this.getInfoRows(definition, selected.instanceId);
    const LABEL_INDENT = 76;

    const leftSectionMaxLineWidth = Math.max(
      measureTextWidth('Selected', 12),
      measureTextWidth(definition.name, 20),
      ...infoRows.map((row) => {
        const labelPart = row.label
          ? LABEL_INDENT
          : row.isDetail
            ? 8
            : LABEL_INDENT;
        const fontSize = row.isDetail ? 11 : 12;
        let segW = 0;
        for (const seg of row.segments) {
          if (segW > 0) segW += 4;
          segW += measureTextWidth(seg.value, fontSize);
          if (seg.resource && !row.isDetail) segW += 17;
        }
        return labelPart + segW;
      })
    );
    const leftSectionWidth = clamp(
      Math.ceil(leftSectionMaxLineWidth) + 12,
      180,
      280
    );

    const isFarm = definition.id === 'farm';
    const isLumbermill = definition.id === 'lumbermill';
    const hasWorkMode = isFarm || isLumbermill;
    const visibleActions = hasWorkMode
      ? []
      : this.getVisibleActions(definition);
    const rightColumnWidth = hasWorkMode
      ? 188
      : this.resolveActionButtonWidth(visibleActions);
    const contentGap = 14;
    const sidePadding = 12;
    const desiredPanelWidth =
      sidePadding +
      leftSectionWidth +
      contentGap +
      rightColumnWidth +
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

    const INFO_ROW_START_Y = 46;
    const INFO_ROW_GAP = 16;
    const INFO_ICON_SIZE = 13;
    const POS_COLOR = Color.fromHex('#78d989');
    const NEG_COLOR = Color.fromHex('#e6c97a');
    const DETAIL_COLOR = Color.fromHex('#8b9bab');
    const actionsStartY = 30;
    const actionRowGap = 38;
    const farmModeCount = 3;
    const lumbermillModeCount = this.buildingManager.isTechnologyUnlocked(
      'eco-forestry'
    )
      ? 3
      : 2;
    const rightItemCount = isFarm
      ? farmModeCount
      : isLumbermill
        ? lumbermillModeCount
        : visibleActions.length;
    const actionBottomY =
      actionsStartY +
      Math.max(0, rightItemCount * actionRowGap - (rightItemCount > 0 ? 4 : 0));
    const infoBottomY =
      INFO_ROW_START_Y + Math.max(0, infoRows.length * INFO_ROW_GAP - 2);
    this.currentPanelHeight = Math.max(
      this.panelHeight,
      infoBottomY + 10,
      actionBottomY + 12
    );
    const actionsTitleX = this.currentPanelWidth - rightColumnWidth - 12;

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: this.currentPanelWidth,
          height: this.currentPanelHeight,
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
        offset: vec(0, this.currentPanelHeight - 1),
      },
    ];

    members.push(
      this.createTextMember('Selected', 12, Color.fromHex('#9fb4c8'), 12, 8),
      this.createTextMember(
        definition.name,
        20,
        Color.fromHex('#f0f4f8'),
        12,
        24
      )
    );

    let rowY = INFO_ROW_START_Y;
    for (const row of infoRows) {
      if (rowY + 14 > this.currentPanelHeight - 4) break;
      if (row.label) {
        members.push(
          this.createTextMember(
            row.label,
            12,
            Color.fromHex('#9fb4c8'),
            12,
            rowY
          )
        );
      }
      const fontSize = row.isDetail ? 11 : 12;
      const valueX = 12 + (row.label || !row.isDetail ? LABEL_INDENT : 8);
      let segX = valueX;
      for (const seg of row.segments) {
        const valueColor = row.isDetail
          ? DETAIL_COLOR
          : seg.isPositive
            ? POS_COLOR
            : NEG_COLOR;
        members.push(
          this.createTextMember(seg.value, fontSize, valueColor, segX, rowY)
        );
        const textW = measureTextWidth(seg.value, fontSize);
        segX += textW + 3;
        if (seg.resource && !row.isDetail) {
          const iconSprite = this.getResourceIconLocal(
            seg.resource,
            INFO_ICON_SIZE
          );
          if (iconSprite) {
            members.push({
              graphic: iconSprite,
              offset: vec(segX, rowY - 1),
            });
            segX += INFO_ICON_SIZE + 4;
          }
        }
      }
      rowY += INFO_ROW_GAP;
    }

    members.push(
      this.createTextMember(
        hasWorkMode ? 'Work Mode' : 'Actions',
        14,
        Color.fromHex('#f0f4f8'),
        actionsTitleX,
        8
      )
    );

    this.graphics.use(new GraphicsGroup({ members }));

    if (isFarm) {
      this.createFarmWorkModeRows(
        actionsTitleX,
        actionsStartY,
        rightColumnWidth,
        selected.instanceId
      );
    } else if (isLumbermill) {
      this.createLumbermillWorkModeRows(
        actionsTitleX,
        actionsStartY,
        rightColumnWidth,
        selected.instanceId
      );
    } else {
      this.createActionRows(
        definition,
        visibleActions,
        actionsTitleX,
        actionsStartY,
        rightColumnWidth
      );
    }
  }

  private updateFieldDisplay(): void {
    const tile = this.selectedFieldTile;
    if (!tile) return;

    const tileType = this.mapTileProvider?.(tile.x, tile.y);
    if (tileType !== 'field' && tileType !== 'field-empty') {
      // Tile was converted to something else — deselect.
      this.selectedFieldTile = undefined;
      this.currentPanelHeight = this.panelHeight;
      this.graphics.isVisible = false;
      this.graphics.use(new GraphicsGroup({ members: [] }));
      return;
    }

    this.graphics.isVisible = true;

    const isFallow = tileType === 'field-empty';
    const title = isFallow ? 'Fallow Field' : 'Field';
    const parentFarm = this.buildingManager.getFarmInstanceForFieldTile(
      tile.x,
      tile.y
    );

    const POS_COLOR = Color.fromHex('#78d989');
    const DETAIL_COLOR = Color.fromHex('#8b9bab');
    const NEG_COLOR = Color.fromHex('#e6c97a');

    const infoRows: BuildingInfoRow[] = [];

    if (!isFallow) {
      const hasCropRotation = this.buildingManager.hasCropRotation();
      infoRows.push({
        label: 'Harvest:',
        segments: [{ value: '+8–10', resource: 'wheat', isPositive: true }],
      });
      if (hasCropRotation) {
        infoRows.push({
          label: 'Regrow:',
          segments: [{ value: '6 turns (Crop Rotation)', isPositive: true }],
        });
      } else {
        infoRows.push({
          label: 'Regrow:',
          segments: [{ value: '12 turns', isPositive: true }],
        });
      }
    } else {
      const turnsLeft =
        this.turnManager.getEmptyFieldTurnsLeft(tile.x, tile.y) ?? 0;
      infoRows.push({
        label: 'Status:',
        segments: [
          {
            value:
              turnsLeft > 0
                ? `Recovers in ${turnsLeft} turn${turnsLeft === 1 ? '' : 's'}`
                : 'Ready soon',
            isPositive: false,
          },
        ],
      });
    }

    if (parentFarm) {
      const overlay = this.buildingManager
        .getBuildingMapOverlays()
        .find((o) => o.instanceId === parentFarm.instanceId);
      const farmName = overlay?.name ?? 'Farm';
      infoRows.push({
        label: 'Farm:',
        segments: [{ value: farmName, isPositive: true }],
      });
    }

    const LABEL_INDENT = 76;
    const leftSectionMaxLineWidth = Math.max(
      measureTextWidth('Selected', 12),
      measureTextWidth(title, 20),
      ...infoRows.map((row) => {
        const labelPart = row.label
          ? LABEL_INDENT
          : row.isDetail
            ? 8
            : LABEL_INDENT;
        const fontSize = row.isDetail ? 11 : 12;
        let segW = 0;
        for (const seg of row.segments) {
          if (segW > 0) segW += 4;
          segW += measureTextWidth(seg.value, fontSize);
          if (seg.resource && !row.isDetail) segW += 17;
        }
        return labelPart + segW;
      })
    );
    const leftSectionWidth = clamp(
      Math.ceil(leftSectionMaxLineWidth) + 12,
      180,
      280
    );

    const sidePadding = 12;
    const descriptionWidth = 220;
    const contentGap = 14;
    const desiredPanelWidth =
      sidePadding +
      leftSectionWidth +
      contentGap +
      descriptionWidth +
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

    const INFO_ROW_START_Y = 46;
    const INFO_ROW_GAP = 16;
    const INFO_ICON_SIZE = 13;
    const infoBottomY =
      INFO_ROW_START_Y + Math.max(0, infoRows.length * INFO_ROW_GAP - 2);
    this.currentPanelHeight = Math.max(this.panelHeight, infoBottomY + 10);

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: this.currentPanelWidth,
          height: this.currentPanelHeight,
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
        offset: vec(0, this.currentPanelHeight - 1),
      },
    ];

    members.push(
      this.createTextMember('Selected', 12, Color.fromHex('#9fb4c8'), 12, 8),
      this.createTextMember(title, 20, Color.fromHex('#f0f4f8'), 12, 24)
    );

    let rowY = INFO_ROW_START_Y;
    for (const row of infoRows) {
      if (rowY + 14 > this.currentPanelHeight - 4) break;
      if (row.label) {
        members.push(
          this.createTextMember(
            row.label,
            12,
            Color.fromHex('#9fb4c8'),
            12,
            rowY
          )
        );
      }
      const fontSize = row.isDetail ? 11 : 12;
      const valueX = 12 + (row.label || !row.isDetail ? LABEL_INDENT : 8);
      let segX = valueX;
      for (const seg of row.segments) {
        const valueColor = row.isDetail
          ? DETAIL_COLOR
          : seg.isPositive
            ? POS_COLOR
            : NEG_COLOR;
        members.push(
          this.createTextMember(seg.value, fontSize, valueColor, segX, rowY)
        );
        const textW = measureTextWidth(seg.value, fontSize);
        segX += textW + 3;
        if (seg.resource && !row.isDetail) {
          const iconSprite = this.getResourceIconLocal(
            seg.resource,
            INFO_ICON_SIZE
          );
          if (iconSprite) {
            members.push({
              graphic: iconSprite,
              offset: vec(segX, rowY - 1),
            });
            segX += INFO_ICON_SIZE + 4;
          }
        }
      }
      rowY += INFO_ROW_GAP;
    }

    // Right column: description
    const descX = this.currentPanelWidth - descriptionWidth - sidePadding;
    const description = isFallow
      ? 'A harvested field resting and recovering its fertility before it can be sown again.'
      : 'A cultivated 2×2 plot of land. Ready to be harvested by the parent Farm when it is set to Harvest work mode.';

    members.push(
      this.createTextMember(
        'Description',
        14,
        Color.fromHex('#f0f4f8'),
        descX,
        8
      )
    );

    // Wrap description text
    const descLines = this.wrapTextLines(description, 11, descriptionWidth - 4);
    let descY = 30;
    for (const line of descLines) {
      members.push(this.createTextMember(line, 11, DETAIL_COLOR, descX, descY));
      descY += 14;
    }

    this.graphics.use(new GraphicsGroup({ members }));
  }

  private wrapTextLines(
    text: string,
    fontSize: number,
    maxWidth: number
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (measureTextWidth(test, fontSize) <= maxWidth) {
        currentLine = test;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  private createActionRows(
    definition: TypedBuildingDefinition,
    actions: ReadonlyArray<StateBuildingActionDefinition>,
    startX: number,
    startY: number,
    rowWidth: number
  ): void {
    if (actions.length === 0) {
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
    for (const action of actions) {
      if (y + 36 > this.currentPanelHeight - 8) {
        break;
      }

      const actionStatus = this.buildingManager.canActivateBuildingAction(
        definition.id,
        action.id,
        instanceId,
        this.resourceManager
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
              if (action.requiresTilePlacement) {
                this.onActionPlacementRequest?.(
                  definition.id,
                  action.id,
                  instanceId
                );
                return;
              }
              if (!this.turnManager.spendFocus(1)) {
                return;
              }
              const pulses = this.buildingManager.activateBuildingAction(
                definition.id,
                action.id,
                instanceId,
                this.resourceManager
              );
              if (pulses === null) {
                return;
              }
              if (pulses.length > 0) {
                this.onActionPulses?.(pulses);
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

  private createFarmWorkModeRows(
    startX: number,
    startY: number,
    rowWidth: number,
    instanceId: string
  ): void {
    const currentMode = this.buildingManager.getFarmWorkMode(instanceId);
    const hasCropRotation = this.buildingManager.hasCropRotation();
    const regrowTurns = hasCropRotation ? 6 : 12;
    const harvestCount = hasCropRotation ? 2 : 1;
    const modes: Array<{
      mode: FarmWorkMode;
      label: string;
      description: string;
      outcomes: TooltipOutcome[];
    }> = [
      {
        mode: 'idle',
        label: 'Idle',
        description: 'Farm does nothing this turn.',
        outcomes: [],
      },
      {
        mode: 'sow',
        label: 'Sow Crops',
        description:
          'Cultivate a 2x2 Plains area near the Farm into a Field. Switches to Harvest when no space remains.',
        outcomes: [
          {
            label: 'Cooldown',
            value: '3 turns',
            color: Color.fromHex('#a9bbcb'),
          },
        ],
      },
      {
        mode: 'harvest',
        label: 'Harvest',
        description: `Harvest ${harvestCount} ready Field${harvestCount > 1 ? 's' : ''} nearby each turn.`,
        outcomes: [
          {
            label: 'Gains',
            icon: this.getResourceIconLocal('wheat'),
            value: '+8–10 Wheat',
            color: Color.fromHex('#9fe6aa'),
            inline: true,
          },
          {
            label: 'Regrow',
            value: `${regrowTurns} turns`,
            color: Color.fromHex('#a9bbcb'),
          },
        ],
      },
    ];

    let y = startY;
    for (const { mode, label, description, outcomes } of modes) {
      const isActive = mode === currentMode;
      const activeColor = Color.fromHex('#1e5e30');
      const activeHover = Color.fromHex('#267538');
      const inactiveColor = Color.fromHex('#274158');
      const inactiveHover = Color.fromHex('#356083');

      const row = new ActionElement({
        x: startX,
        y,
        width: rowWidth,
        height: 34,
        title: label,
        description,
        outcomes,
        tooltipProvider: this.tooltipProvider,
        bgColor: isActive ? activeColor : inactiveColor,
        hoverBgColor: isActive ? activeHover : inactiveHover,
        pressedBgColor: isActive
          ? Color.fromHex('#1a4d28')
          : Color.fromHex('#2e5270'),
        hoverBorderColor: isActive
          ? Color.fromHex('#4caf73')
          : Color.fromHex('#f1c40f'),
        textColor: Color.White,
        tooltipWidth: 260,
        onClick: () => {
          this.buildingManager.setFarmWorkMode(instanceId, mode);
          this.lastBuildingsVersion = -1;
        },
      });

      this.actionRows.push(row);
      this.addChild(row);
      y += 38;
    }
  }

  private createLumbermillWorkModeRows(
    startX: number,
    startY: number,
    rowWidth: number,
    instanceId: string
  ): void {
    const currentMode = this.buildingManager.getLumbermillWorkMode(instanceId);
    const hasForestry =
      this.buildingManager.isTechnologyUnlocked('eco-forestry');
    const modes: Array<{
      mode: LumbermillWorkMode;
      label: string;
      description: string;
      outcomes: TooltipOutcome[];
    }> = [
      {
        mode: 'idle',
        label: 'Idle',
        description: 'Lumbermill does nothing this turn.',
        outcomes: [],
      },
      {
        mode: 'harvest',
        label: 'Harvest Timber',
        description: 'Cut the nearest Forest tile.',
        outcomes: [
          {
            label: 'Gains',
            icon: this.getResourceIconLocal('wood'),
            value: '+3–5 Lumber',
            color: Color.fromHex('#9fe6aa'),
            inline: true,
          },
          {
            label: 'Cooldown',
            value: '3 turns',
            color: Color.fromHex('#a9bbcb'),
          },
        ],
      },
    ];
    if (hasForestry) {
      modes.push({
        mode: 'plant',
        label: 'Plant Trees',
        description: 'Plant a tree on the nearest Plains or Sand tile.',
        outcomes: [
          {
            label: 'Costs',
            icon: this.getResourceIconLocal('gold'),
            value: '-5',
            color: Color.fromHex('#e6c97a'),
            inline: true,
          },
          {
            label: 'Cooldown',
            value: '5 turns',
            color: Color.fromHex('#a9bbcb'),
          },
        ],
      });
    }

    let y = startY;
    for (const { mode, label, description, outcomes } of modes) {
      const isActive = mode === currentMode;
      const activeColor = Color.fromHex('#1e5e30');
      const activeHover = Color.fromHex('#267538');
      const inactiveColor = Color.fromHex('#274158');
      const inactiveHover = Color.fromHex('#356083');

      const row = new ActionElement({
        x: startX,
        y,
        width: rowWidth,
        height: 34,
        title: label,
        description,
        outcomes,
        tooltipProvider: this.tooltipProvider,
        bgColor: isActive ? activeColor : inactiveColor,
        hoverBgColor: isActive ? activeHover : inactiveHover,
        pressedBgColor: isActive
          ? Color.fromHex('#1a4d28')
          : Color.fromHex('#2e5270'),
        hoverBorderColor: isActive
          ? Color.fromHex('#4caf73')
          : Color.fromHex('#f1c40f'),
        textColor: Color.White,
        tooltipWidth: 260,
        onClick: () => {
          this.buildingManager.setLumbermillWorkMode(instanceId, mode);
          this.lastBuildingsVersion = -1;
        },
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

  private getVisibleActions(
    definition: TypedBuildingDefinition
  ): StateBuildingActionDefinition[] {
    return definition.actions.filter((action) => {
      if (
        definition.id === 'barracks' &&
        action.id === 'train-archers' &&
        !this.buildingManager.isTechnologyUnlocked('mil-fletching')
      ) {
        return false;
      }
      return true;
    });
  }

  private getInfoRows(
    definition: TypedBuildingDefinition,
    instanceId: string
  ): BuildingInfoRow[] {
    const rows: BuildingInfoRow[] = [];

    if (definition.populationProvided) {
      rows.push({
        label: 'Permanent:',
        segments: [
          {
            value: `+${definition.populationProvided}`,
            resource: 'population',
            isPositive: true,
          },
        ],
      });
    }

    if (definition.id === 'farm') {
      const fieldCount = this.buildingManager.getFarmFieldCount(instanceId, 2);
      const mode = this.buildingManager.getFarmWorkMode(instanceId);
      rows.push({
        label: 'Fields:',
        segments: [
          {
            value: `${fieldCount}`,
            resource: 'wheat',
            isPositive: fieldCount > 0,
          },
        ],
      });
      if (mode === 'sow') {
        const cooldown = this.buildingManager.getFarmSowCooldown(instanceId);
        rows.push({
          label: '',
          segments: [
            {
              value:
                cooldown > 0
                  ? `Next sow in ${cooldown} turn${cooldown === 1 ? '' : 's'}`
                  : 'Ready to sow',
              isPositive: cooldown <= 0,
            },
          ],
          isDetail: true,
        });
      }
      if (mode === 'harvest') {
        const harvestCount = this.buildingManager.hasCropRotation() ? 2 : 1;
        rows.push({
          label: '',
          segments: [
            {
              value: `Harvests ${harvestCount} field${harvestCount > 1 ? 's' : ''}/turn, 8-10 Wheat each`,
              isPositive: true,
            },
          ],
          isDetail: true,
        });
      }
    } else if (definition.id === 'lumbermill') {
      const forestCount =
        this.buildingManager.getLumbermillForestCount(instanceId);
      const mode = this.buildingManager.getLumbermillWorkMode(instanceId);
      rows.push({
        label: 'Forests:',
        segments: [
          {
            value: `${forestCount}`,
            resource: 'wood',
            isPositive: forestCount > 0,
          },
        ],
      });
      if (mode === 'harvest' || mode === 'plant') {
        const cooldown = this.buildingManager.getLumbermillCooldown(instanceId);
        const nextLabel = mode === 'harvest' ? 'Next harvest' : 'Next planting';
        rows.push({
          label: '',
          segments: [
            {
              value:
                cooldown > 0
                  ? `${nextLabel} in ${cooldown} turn${cooldown === 1 ? '' : 's'}`
                  : 'Ready',
              isPositive: cooldown <= 0,
            },
          ],
          isDetail: true,
        });
      }
    } else if (definition.id === 'bakery') {
      rows.push({
        label: 'Each turn:',
        segments: [
          { value: '-2', resource: 'wheat', isPositive: false },
          { value: '+3', resource: 'bread', isPositive: true },
        ],
      });
    } else {
      const passiveEntries = buildingPassiveIncome[definition.id] ?? [];
      const segments: BuildingInfoRowSegment[] = [];
      for (const entry of passiveEntries) {
        let valueText: string;
        let isPositive = true;
        if (typeof entry.amount === 'string') {
          const parts = entry.amount.split(':');
          valueText = `+${parts[1]}\u2013${parts[2]}`;
        } else {
          isPositive = entry.amount >= 0;
          valueText = (isPositive ? '+' : '') + String(entry.amount);
        }
        segments.push({
          value: valueText,
          resource: entry.resourceType,
          isPositive,
        });
      }

      // Rare resource bonuses (e.g. golden ore under a mine)
      const rareBonuses =
        this.buildingManager.getRareResourceBonusForInstance(instanceId);
      for (const bonus of rareBonuses) {
        let valueText: string;
        if (typeof bonus.amount === 'string') {
          const parts = bonus.amount.split(':');
          valueText = `+${parts[1]}\u2013${parts[2]}`;
        } else {
          valueText = `+${bonus.amount}`;
        }
        segments.push({
          value: valueText,
          resource: bonus.resourceType,
          isPositive: true,
        });
      }

      if (definition.id === 'house') {
        const hasTax =
          this.buildingManager.isTechnologyUnlocked('eco-tax-collection');
        if (hasTax) {
          segments.push({ value: '+2', resource: 'gold', isPositive: true });
        }
      }

      if (segments.length > 0) {
        rows.push({ label: 'Each turn:', segments });
      }
    }

    const activeProgress = this.buildingManager
      .getBuildingActionProgresses()
      .filter((progress) => progress.instanceId === instanceId);
    for (const progress of activeProgress) {
      rows.push({
        label: 'Action:',
        segments: [
          {
            value: `${this.getUnitLabel(progress.unitId)} ready in ${progress.turnsLeft} turn${progress.turnsLeft === 1 ? '' : 's'}`,
            isPositive: true,
          },
        ],
        isDetail: true,
      });
    }

    return rows;
  }

  private getActionOutcomes(
    definition: TypedBuildingDefinition,
    action: StateBuildingActionDefinition,
    _instanceId: string
  ): TooltipOutcome[] {
    const state = this.stateManager.getStateRef();
    const buildingCount = Math.max(
      1,
      this.buildingManager.getBuildingCount(definition.id)
    );

    if (definition.id === 'castle' && action.id === 'call-to-arms') {
      return [
        {
          label: 'Costs',
          icon: this.getResourceIconLocal('gold'),
          value: '-10',
          color: Color.fromHex('#e6c97a'),
          inline: true,
        },
        {
          label: 'Muster',
          value: '+4-6 Militia',
          color: Color.fromHex('#9fe6aa'),
        },
        {
          label: 'Time',
          value: '1 turn',
          color: Color.fromHex('#a9bbcb'),
        },
      ];
    }

    if (definition.id === 'barracks' && action.id === 'train-footmen') {
      return [
        {
          label: 'Costs',
          icon: this.getResourceIconLocal('gold'),
          value: '-50',
          color: Color.fromHex('#e6c97a'),
          inline: true,
        },
        {
          label: 'Training',
          value: '+3-5 Footmen',
          color: Color.fromHex('#9fe6aa'),
        },
        {
          label: 'Time',
          value: '2 turns',
          color: Color.fromHex('#a9bbcb'),
        },
      ];
    }

    if (definition.id === 'barracks' && action.id === 'train-archers') {
      return [
        {
          label: 'Costs',
          icon: this.getResourceIconLocal('gold'),
          value: '-75',
          color: Color.fromHex('#e6c97a'),
          inline: true,
        },
        {
          label: '',
          icon: this.getResourceIconLocal('wood'),
          value: '-25',
          color: Color.fromHex('#e6c97a'),
          inline: true,
        },
        {
          label: 'Training',
          value: '+3-5 Archers',
          color: Color.fromHex('#9fe6aa'),
        },
        {
          label: 'Time',
          value: '2 turns',
          color: Color.fromHex('#a9bbcb'),
        },
      ];
    }

    const gainByBuilding: Partial<
      Record<TypedBuildingDefinition['id'], number>
    > = {
      mine: Math.max(1, Math.floor(state.tiles.stone / 4)) * buildingCount,
    };
    const value = gainByBuilding[definition.id];
    if (value === undefined) {
      return [];
    }

    const resourceByBuilding: Partial<
      Record<TypedBuildingDefinition['id'], ResourceType>
    > = {
      lumbermill: 'wood',
      mine: 'stone',
    };
    return [
      {
        label: '',
        icon: getResourceIcon(resourceByBuilding[definition.id]!),
        value: `+${value}`,
        color: Color.fromHex('#9fe6aa'),
      },
    ];
  }

  private getResourceIconLocal(
    resourceType: ResourceType | undefined,
    size?: number
  ) {
    if (!resourceType) return undefined;
    return getResourceIcon(resourceType, size);
  }

  private getUnitLabel(unitId: UnitRole): string {
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
          family: FONT_FAMILY,
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
          family: FONT_FAMILY,
        }),
      })
    );
    return line;
  }
}
