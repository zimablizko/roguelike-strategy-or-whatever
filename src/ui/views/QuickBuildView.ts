import {
  Font,
  FontUnit,
  GraphicsGroup,
  Keys,
  PointerButton,
  Rectangle,
  ScreenElement,
  Text,
  vec,
  type GraphicsGrouping,
  type Scene,
  type Subscription,
} from 'excalibur';
import type {
  StateBuildingId,
  TypedBuildingDefinition,
} from '../../_common/models/buildings.models';
import type { ResourceType } from '../../_common/models/resource.models';
import type { TooltipOutcome } from '../../_common/models/tooltip.models';
import type {
  BuildRow,
  QuickBuildViewOptions,
} from '../../_common/models/ui.models';
import { Resources } from '../../_common/resources';
import { getResearchDefinition, isResearchId } from '../../data/researches';
import { BuildingManager } from '../../managers/BuildingManager';
import { ResourceManager } from '../../managers/ResourceManager';
import { TurnManager } from '../../managers/TurnManager';
import {
  QUICK_BUILD_COLORS,
  QUICK_BUILD_HOTKEYS,
  QUICK_BUILD_LAYOUT,
} from '../constants/QuickBuildConstants';
import { ScreenButton } from '../elements/ScreenButton';
import { TooltipProvider } from '../tooltip/TooltipProvider';

export class QuickBuildView extends ScreenElement {
  private readonly buildingManager: BuildingManager;
  private readonly resourceManager: ResourceManager;
  private readonly turnManager: TurnManager;
  private readonly tooltipProvider: TooltipProvider;
  private readonly onSelectBuildingForPlacement?: (
    buildingId: StateBuildingId
  ) => void;

  private readonly leftMargin: number;
  private readonly bottomMargin: number;
  private readonly panelWidth: number;
  private readonly toggleWidth: number;
  private readonly toggleHeight: number;

  private expanded = false;
  private currentPanelHeight = 0;
  private lastBuildingsVersion = -1;
  private lastResourcesVersion = -1;
  private lastTurnVersion = -1;
  private lastExpandedState = false;
  private readonly toggleButton: ScreenButton;
  private rowButtons: ScreenButton[] = [];
  private pointerSubscriptions: Subscription[] = [];

  constructor(options: QuickBuildViewOptions) {
    super({ x: 0, y: 0 });
    this.buildingManager = options.buildingManager;
    this.resourceManager = options.resourceManager;
    this.turnManager = options.turnManager;
    this.tooltipProvider = options.tooltipProvider;
    this.onSelectBuildingForPlacement = options.onSelectBuildingForPlacement;
    this.leftMargin = options.leftMargin ?? QUICK_BUILD_LAYOUT.leftMargin;
    this.bottomMargin = options.bottomMargin ?? QUICK_BUILD_LAYOUT.bottomMargin;
    this.panelWidth = options.width ?? QUICK_BUILD_LAYOUT.panelWidth;
    this.toggleWidth =
      options.toggleButtonWidth ?? QUICK_BUILD_LAYOUT.toggleWidth;
    this.toggleHeight =
      options.toggleButtonHeight ?? QUICK_BUILD_LAYOUT.toggleHeight;

    this.toggleButton = new ScreenButton({
      x: 0,
      y: 0,
      width: this.toggleWidth,
      height: this.toggleHeight,
      title: 'Build',
      onClick: () => {
        this.toggleExpanded();
      },
    });
  }

  onInitialize(): void {
    this.addChild(this.toggleButton);
    const pointers = this.scene?.input.pointers;
    if (pointers) {
      this.pointerSubscriptions.push(
        pointers.on('down', (evt) => {
          if (evt.button !== PointerButton.Left) {
            return;
          }
          if (!this.expanded) {
            return;
          }
          if (this.containsScreenPoint(evt.screenPos.x, evt.screenPos.y)) {
            return;
          }
          this.expanded = false;
          this.invalidateRender();
        })
      );
    }
    this.refresh(true);
  }

  onPreUpdate(): void {
    if (this.scene?.engine.input.keyboard.wasPressed(Keys.B)) {
      this.toggleExpanded();
    }
    this.handleBuildHotkeys();
    this.refresh(false);
  }

  override onPreKill(_scene: Scene): void {
    for (const sub of this.pointerSubscriptions) {
      sub.close();
    }
    this.pointerSubscriptions = [];
    for (const row of this.rowButtons) {
      this.tooltipProvider.hide(row);
    }
  }

  containsScreenPoint(screenX: number, screenY: number): boolean {
    const x = this.globalPos.x;
    const y = this.globalPos.y;
    const totalHeight =
      (this.expanded
        ? this.currentPanelHeight + QUICK_BUILD_LAYOUT.panelGap
        : 0) + this.toggleHeight;
    const totalWidth = Math.max(this.panelWidth, this.toggleButton.buttonWidth);
    return (
      screenX >= x &&
      screenX <= x + totalWidth &&
      screenY >= y &&
      screenY <= y + totalHeight
    );
  }

  isExpanded(): boolean {
    return this.expanded;
  }

  private refresh(force: boolean): void {
    this.updatePosition();
    this.render(force);
  }

  private updatePosition(): void {
    const engine = this.scene?.engine;
    if (!engine) {
      return;
    }

    const totalHeight =
      (this.expanded
        ? this.currentPanelHeight + QUICK_BUILD_LAYOUT.panelGap
        : 0) + this.toggleHeight;
    this.pos = vec(
      this.leftMargin,
      engine.drawHeight - this.bottomMargin - totalHeight
    );
  }

  private render(force: boolean): void {
    const bv = this.buildingManager.getBuildingsVersion();
    const rv = this.resourceManager.getResourcesVersion();
    const tv = this.turnManager.getTurnVersion();
    const ex = this.expanded;

    if (
      !force &&
      bv === this.lastBuildingsVersion &&
      rv === this.lastResourcesVersion &&
      tv === this.lastTurnVersion &&
      ex === this.lastExpandedState
    ) {
      return;
    }

    this.lastBuildingsVersion = bv;
    this.lastResourcesVersion = rv;
    this.lastTurnVersion = tv;
    this.lastExpandedState = ex;

    const rows = this.getRows();

    this.clearRows();

    if (!this.expanded) {
      this.currentPanelHeight = 0;
      this.toggleButton.pos = vec(0, 0);
      this.graphics.use(new GraphicsGroup({ members: [] }));
      return;
    }

    this.currentPanelHeight =
      QUICK_BUILD_LAYOUT.panelPadding * 2 +
      QUICK_BUILD_LAYOUT.headerHeight +
      Math.max(
        0,
        rows.length * QUICK_BUILD_LAYOUT.rowHeight +
          Math.max(0, rows.length - 1) * QUICK_BUILD_LAYOUT.rowGap
      );
    this.toggleButton.pos = vec(
      0,
      this.currentPanelHeight + QUICK_BUILD_LAYOUT.panelGap
    );

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: this.panelWidth,
          height: this.currentPanelHeight,
          color: QUICK_BUILD_COLORS.panelBackground,
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: this.panelWidth,
          height: 1,
          color: QUICK_BUILD_COLORS.panelBorder,
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Text({
          text: 'Quick Build',
          font: new Font({
            size: 13,
            unit: FontUnit.Px,
            color: QUICK_BUILD_COLORS.headerText,
          }),
        }),
        offset: vec(
          QUICK_BUILD_LAYOUT.panelPadding,
          QUICK_BUILD_LAYOUT.panelPadding
        ),
      },
    ];
    this.graphics.use(new GraphicsGroup({ members }));

    const buttonWidth = this.panelWidth - QUICK_BUILD_LAYOUT.panelPadding * 2;
    let y = QUICK_BUILD_LAYOUT.panelPadding + QUICK_BUILD_LAYOUT.headerHeight;
    for (const row of rows) {
      const button = new ScreenButton({
        x: QUICK_BUILD_LAYOUT.panelPadding,
        y,
        width: buttonWidth,
        height: QUICK_BUILD_LAYOUT.rowHeight,
        title: this.getRowTitle(row.definition),
        onClick: () => {
          const hasActionPoint =
            this.turnManager.getTurnDataRef().focus.current >= 1;
          if (!hasActionPoint) {
            return;
          }

          const buildStatus = this.buildingManager.canBuildBuilding(
            row.definition.id,
            this.resourceManager
          );
          if (!buildStatus.buildable) {
            return;
          }

          this.onSelectBuildingForPlacement?.(row.definition.id);
          this.expanded = false;
          this.invalidateRender();
        },
      });
      if (!row.enabled) {
        button.toggle(false);
      }

      button.on('pointerenter', () => {
        this.tooltipProvider.show({
          owner: button,
          getAnchorRect: () => ({
            x: button.globalPos.x,
            y: button.globalPos.y,
            width: button.buttonWidth,
            height: button.buttonHeight,
          }),
          description: this.buildTooltipDescription(row),
          outcomes: this.buildTooltipOutcomes(row),
          width: 320,
          placement: 'right',
        });
      });
      button.on('pointerleave', () => {
        this.tooltipProvider.hide(button);
      });
      button.on('prekill', () => {
        this.tooltipProvider.hide(button);
      });

      this.rowButtons.push(button);
      this.addChild(button);
      y += QUICK_BUILD_LAYOUT.rowHeight + QUICK_BUILD_LAYOUT.rowGap;
    }
  }

  private clearRows(): void {
    for (const row of this.rowButtons) {
      this.tooltipProvider.hide(row);
      if (!row.isKilled()) {
        row.kill();
      }
    }
    this.rowButtons = [];
  }

  private getRows(): BuildRow[] {
    const hasActionPoint = this.turnManager.getTurnDataRef().focus.current >= 1;
    return this.buildingManager
      .getBuildingDefinitions()
      .filter((definition) => {
        const count = this.buildingManager.getBuildingCount(definition.id);
        if (definition.unique && count > 0) {
          return false;
        }
        return definition.requiredTechnologies.every((technology) =>
          this.buildingManager.isTechnologyUnlocked(technology)
        );
      })
      .map((definition) => {
        const status = this.buildingManager.canBuildBuilding(
          definition.id,
          this.resourceManager
        );
        return {
          definition,
          status,
          enabled: hasActionPoint && status.buildable,
        };
      });
  }

  private buildTooltipDescription(row: BuildRow): string {
    const lines: string[] = [row.definition.description];
    const apCurrent = this.turnManager.getTurnDataRef().focus.current;
    if (apCurrent < 1) {
      lines.push('Not enough Focus.');
    }

    if (!row.status.placementAvailable && row.status.placementReason) {
      lines.push(row.status.placementReason);
    }

    if (row.status.populationInsufficient) {
      const freePop = this.buildingManager.getFreePopulation();
      lines.push(
        `Not enough free population (need ${row.definition.populationRequired}, have ${freePop}).`
      );
    }

    return lines.join('\n');
  }

  private buildTooltipOutcomes(row: BuildRow): TooltipOutcome[] {
    const outcomes: TooltipOutcome[] = [];
    const keys: ResourceType[] = ['gold', 'materials', 'food', 'population'];
    const okColor = QUICK_BUILD_COLORS.costOk;
    const badColor = QUICK_BUILD_COLORS.costBad;
    const neutralColor = QUICK_BUILD_COLORS.neutral;

    outcomes.push({
      label: 'Placement',
      value: row.definition.placementDescription,
      color: neutralColor,
    });

    const costOutcomes: TooltipOutcome[] = [];
    for (const key of keys) {
      const amount = row.status.nextCost[key];
      if (amount === undefined || amount <= 0) {
        continue;
      }

      const have = this.resourceManager.getResource(key);
      const missing = Math.max(0, amount - have);
      costOutcomes.push({
        label: '',
        icon: this.getResourceIcon(key),
        value: missing > 0 ? `${amount} (-${missing})` : `${amount}`,
        color: missing > 0 ? badColor : okColor,
        inline: true,
      });
    }

    if (costOutcomes.length === 0) {
      outcomes.push({
        label: 'Costs',
        value: 'Free',
        color: okColor,
      });
    } else {
      costOutcomes[0].label = 'Costs';
      outcomes.push(...costOutcomes);
    }

    if (row.definition.populationRequired) {
      const freePop = this.buildingManager.getFreePopulation();
      const enough = freePop >= row.definition.populationRequired;
      outcomes.push({
        label: costOutcomes.length === 0 ? 'Costs' : '',
        icon: this.getResourceIcon('population'),
        value: enough
          ? `${row.definition.populationRequired} (free: ${freePop})`
          : `${row.definition.populationRequired} (free: ${freePop})`,
        color: enough ? okColor : badColor,
        inline: true,
      });
    }

    const apCurrent = this.turnManager.getTurnDataRef().focus.current;
    if (apCurrent < 1) {
      outcomes.push({
        label: 'Focus',
        value: 'Not enough',
        color: badColor,
      });
    }

    const missingTechnologies = row.definition.requiredTechnologies
      .filter(
        (technology) => !this.buildingManager.isTechnologyUnlocked(technology)
      )
      .map((technology) => this.resolveTechnologyName(technology));
    if (missingTechnologies.length > 0) {
      outcomes.push({
        label: 'Requires',
        value: missingTechnologies.join(', '),
        color: badColor,
      });
    }

    if (row.definition.populationProvided) {
      outcomes.push({
        label: 'Provides',
        icon: this.getResourceIcon('population'),
        value: `+${row.definition.populationProvided} pop`,
        color: okColor,
      });
    }

    return outcomes;
  }

  private resolveTechnologyName(technologyId: string): string {
    if (isResearchId(technologyId)) {
      return getResearchDefinition(technologyId)?.name ?? technologyId;
    }
    return technologyId;
  }

  private getResourceIcon(resourceType: ResourceType) {
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

  private getRowTitle(definition: TypedBuildingDefinition): string {
    const hotkey = QUICK_BUILD_HOTKEYS[definition.id];
    if (!hotkey) {
      return definition.name;
    }
    return `${definition.name} [${hotkey.label}]`;
  }

  private handleBuildHotkeys(): void {
    if (!this.expanded) {
      return;
    }

    const keyboard = this.scene?.engine.input.keyboard;
    if (!keyboard) {
      return;
    }

    const rows = this.getRows();
    for (const row of rows) {
      const hotkey = QUICK_BUILD_HOTKEYS[row.definition.id];
      if (!hotkey || !keyboard.wasPressed(hotkey.key)) {
        continue;
      }
      if (!row.enabled) {
        return;
      }

      this.onSelectBuildingForPlacement?.(row.definition.id);
      this.expanded = false;
      this.invalidateRender();
      return;
    }
  }

  private invalidateRender(): void {
    this.lastBuildingsVersion = -1;
  }

  private toggleExpanded(): void {
    this.expanded = !this.expanded;
    this.invalidateRender();
  }
}
