import {
  Color,
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
import type { ResourceType } from '../../managers/ResourceManager';
import { ResourceManager } from '../../managers/ResourceManager';
import {
  StateManager,
  type StateBuildingBuildStatus,
  type TypedBuildingDefinition,
} from '../../managers/StateManager';
import { TurnManager } from '../../managers/TurnManager';
import { ScreenButton } from '../elements/ScreenButton';
import {
  TooltipProvider,
  type TooltipOutcome,
} from '../tooltip/TooltipProvider';

export interface QuickBuildViewOptions {
  stateManager: StateManager;
  resourceManager: ResourceManager;
  turnManager: TurnManager;
  tooltipProvider: TooltipProvider;
  onBuilt?: (instanceId: string) => void;
  leftMargin?: number;
  bottomMargin?: number;
  width?: number;
  toggleButtonWidth?: number;
  toggleButtonHeight?: number;
}

interface BuildRow {
  definition: TypedBuildingDefinition;
  status: StateBuildingBuildStatus;
  enabled: boolean;
}

export class QuickBuildView extends ScreenElement {
  private readonly stateManager: StateManager;
  private readonly resourceManager: ResourceManager;
  private readonly turnManager: TurnManager;
  private readonly tooltipProvider: TooltipProvider;
  private readonly onBuilt?: (instanceId: string) => void;

  private readonly leftMargin: number;
  private readonly bottomMargin: number;
  private readonly panelWidth: number;
  private readonly toggleWidth: number;
  private readonly toggleHeight: number;
  private readonly panelPadding = 8;
  private readonly panelGap = 6;
  private readonly rowHeight = 30;
  private readonly rowGap = 4;
  private readonly headerHeight = 20;

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
    this.stateManager = options.stateManager;
    this.resourceManager = options.resourceManager;
    this.turnManager = options.turnManager;
    this.tooltipProvider = options.tooltipProvider;
    this.onBuilt = options.onBuilt;
    this.leftMargin = options.leftMargin ?? 20;
    this.bottomMargin = options.bottomMargin ?? 160;
    this.panelWidth = options.width ?? 260;
    this.toggleWidth = options.toggleButtonWidth ?? 100;
    this.toggleHeight = options.toggleButtonHeight ?? 40;

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
      (this.expanded ? this.currentPanelHeight + this.panelGap : 0) +
      this.toggleHeight;
    const totalWidth = Math.max(this.panelWidth, this.toggleButton.buttonWidth);
    return (
      screenX >= x &&
      screenX <= x + totalWidth &&
      screenY >= y &&
      screenY <= y + totalHeight
    );
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
      (this.expanded ? this.currentPanelHeight + this.panelGap : 0) +
      this.toggleHeight;
    this.pos = vec(
      this.leftMargin,
      engine.drawHeight - this.bottomMargin - totalHeight
    );
  }

  private render(force: boolean): void {
    const bv = this.stateManager.getBuildingsVersion();
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
      this.panelPadding * 2 +
      this.headerHeight +
      Math.max(
        0,
        rows.length * this.rowHeight +
          Math.max(0, rows.length - 1) * this.rowGap
      );
    this.toggleButton.pos = vec(0, this.currentPanelHeight + this.panelGap);

    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: this.panelWidth,
          height: this.currentPanelHeight,
          color: Color.fromRGB(14, 24, 35, 0.9),
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: this.panelWidth,
          height: 1,
          color: Color.fromRGB(170, 196, 220, 0.55),
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Text({
          text: 'Quick Build',
          font: new Font({
            size: 13,
            unit: FontUnit.Px,
            color: Color.fromHex('#d9e4ef'),
          }),
        }),
        offset: vec(this.panelPadding, this.panelPadding),
      },
    ];
    this.graphics.use(new GraphicsGroup({ members }));

    const buttonWidth = this.panelWidth - this.panelPadding * 2;
    let y = this.panelPadding + this.headerHeight;
    for (const row of rows) {
      const button = new ScreenButton({
        x: this.panelPadding,
        y,
        width: buttonWidth,
        height: this.rowHeight,
        title: row.definition.name,
        onClick: () => {
          const hasActionPoint =
            this.turnManager.getTurnDataRef().actionPoints.current >= 1;
          if (!hasActionPoint) {
            return;
          }

          const buildStatus = this.stateManager.canBuildBuilding(
            row.definition.id,
            this.resourceManager
          );
          if (!buildStatus.buildable) {
            return;
          }

          const built = this.stateManager.buildBuilding(
            row.definition.id,
            this.resourceManager
          );
          if (!built) {
            return;
          }

          this.turnManager.spendActionPoints(1);
          const latestInstance = this.stateManager.getLatestBuildingInstance(
            row.definition.id
          );
          if (latestInstance) {
            this.onBuilt?.(latestInstance.instanceId);
          }
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
      y += this.rowHeight + this.rowGap;
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
    const hasActionPoint =
      this.turnManager.getTurnDataRef().actionPoints.current >= 1;
    return this.stateManager
      .getBuildingDefinitions()
      .filter((definition) => {
        const count = this.stateManager.getBuildingCount(definition.id);
        return !definition.unique || count === 0;
      })
      .map((definition) => {
        const status = this.stateManager.canBuildBuilding(
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
    const apCurrent = this.turnManager.getTurnDataRef().actionPoints.current;
    if (apCurrent < 1) {
      lines.push('Not enough Action Points.');
    }

    if (row.definition.requiredTechnologies.length > 0) {
      const unlocked = row.definition.requiredTechnologies.filter(
        (technology) => this.stateManager.isTechnologyUnlocked(technology)
      );
      const missing = row.definition.requiredTechnologies.filter(
        (technology) => !this.stateManager.isTechnologyUnlocked(technology)
      );
      if (unlocked.length > 0) {
        lines.push(`Tech unlocked: ${unlocked.join(', ')}`);
      }
      if (missing.length > 0) {
        lines.push(`Tech missing: ${missing.join(', ')}`);
      }
    }

    if (!row.status.placementAvailable && row.status.placementReason) {
      lines.push(row.status.placementReason);
    }

    return lines.join('\n');
  }

  private buildTooltipOutcomes(row: BuildRow): TooltipOutcome[] {
    const outcomes: TooltipOutcome[] = [];
    const keys: ResourceType[] = ['gold', 'materials', 'food', 'population'];
    const okColor = Color.fromHex('#9fe6aa');
    const badColor = Color.fromHex('#f2b0a6');
    const neutralColor = Color.fromHex('#d9e4ef');

    outcomes.push({
      label: 'Placement',
      value: row.definition.placementDescription,
      color: neutralColor,
    });

    for (const key of keys) {
      const amount = row.status.nextCost[key];
      if (amount === undefined || amount <= 0) {
        continue;
      }

      const have = this.resourceManager.getResource(key);
      const missing = Math.max(0, amount - have);
      outcomes.push({
        label: key,
        value: missing > 0 ? `${amount} (-${missing})` : `${amount}`,
        color: missing > 0 ? badColor : okColor,
      });
    }

    if (outcomes.length === 0) {
      outcomes.push({
        label: 'Cost',
        value: 'Free',
        color: okColor,
      });
    }

    const apCurrent = this.turnManager.getTurnDataRef().actionPoints.current;
    if (apCurrent < 1) {
      outcomes.push({
        label: 'Action Points',
        value: 'Not enough',
        color: badColor,
      });
    }

    return outcomes;
  }

  private invalidateRender(): void {
    this.lastBuildingsVersion = -1;
  }

  private toggleExpanded(): void {
    this.expanded = !this.expanded;
    this.invalidateRender();
  }
}
