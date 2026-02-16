import {
  Actor,
  Color,
  Engine,
  Keys,
  Scene,
  type SceneActivationContext,
} from 'excalibur';
import { CONFIG } from '../_common/config';
import type { MapBuildPlacementOverlay } from '../_common/models/ui.models';
import { Resources } from '../_common/resources';
import type { StateBuildingId } from '../_common/models/buildings.models';
import { GameManager } from '../managers/GameManager';
import { ResourceManager } from '../managers/ResourceManager';
import { TurnManager } from '../managers/TurnManager';
import { UI_Z } from '../ui/constants/ZLayers';
import { ActionElement } from '../ui/elements/ActionElement';
import { ScreenButton } from '../ui/elements/ScreenButton';
import { ScreenPopup } from '../ui/elements/ScreenPopup';
import { ResearchPopup } from '../ui/popups/ResearchPopup';
import { StatePopup } from '../ui/popups/StatePopup';
import { TooltipProvider } from '../ui/tooltip/TooltipProvider';
import { MapIncomeEffectsView } from '../ui/views/MapIncomeEffectsView';
import { MapView } from '../ui/views/MapView';
import { QuickBuildView } from '../ui/views/QuickBuildView';
import { ResearchStatusView } from '../ui/views/ResearchStatusView';
import { ResourceDisplay } from '../ui/views/ResourceView';
import { RulerDisplay } from '../ui/views/RulerView';
import { SelectedBuildingView } from '../ui/views/SelectedBuildingView';
import { StateDisplay } from '../ui/views/StateView';
import { TurnDisplay } from '../ui/views/TurnView';

/**
 * Main gameplay scene — manages the game world, UI, and turn lifecycle.
 */
export class GameplayScene extends Scene {
  private gameManager!: GameManager;
  private resourceManager!: ResourceManager;
  private turnManager!: TurnManager;
  private tooltipProvider!: TooltipProvider;
  private mapView?: MapView;
  private mapIncomeEffectsView?: MapIncomeEffectsView;
  private testPopup?: ScreenPopup;
  private statePopup?: StatePopup;
  private rulerPopup?: ScreenPopup;
  private researchPopup?: ResearchPopup;
  private rulerDisplay?: RulerDisplay;
  private selectedBuildingView?: SelectedBuildingView;
  private quickBuildView?: QuickBuildView;
  private selectedBuildingInstanceId?: string;
  private pendingManualBuildBuildingId?: StateBuildingId;
  private placementOverlayCache?: {
    key: string;
    overlay: MapBuildPlacementOverlay;
  };

  onInitialize(_engine: Engine): void {
    // Set background color
    this.backgroundColor = Color.fromHex('#2c3e50');
  }

  onActivate(context: SceneActivationContext): void {
    // Excalibur Scenes are initialized once, then re-activated many times.
    // Reset state on activation so starting a new game gets fresh defaults.
    this.resetGame(context.engine);
  }

  onPreUpdate(engine: Engine): void {
    const quickBuildExpanded = this.quickBuildView?.isExpanded() ?? false;
    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.F)) {
      this.mapView?.focusOnPlayerState();
    }
  }

  onDeactivate(): void {
    // Clean up references so they can be garbage-collected between scene transitions
    this.tooltipProvider = undefined!;
    this.mapView = undefined;
    this.mapIncomeEffectsView = undefined;
    this.testPopup = undefined;
    this.statePopup = undefined;
    this.rulerPopup = undefined;
    this.researchPopup = undefined;
    this.rulerDisplay = undefined;
    this.selectedBuildingView = undefined;
    this.quickBuildView = undefined;
    this.selectedBuildingInstanceId = undefined;
    this.pendingManualBuildBuildingId = undefined;
    this.placementOverlayCache = undefined;
  }

  private resetGame(engine: Engine): void {
    // Remove all actors/entities/timers from the previous run
    this.clear();
    this.testPopup = undefined;
    this.statePopup = undefined;
    this.rulerPopup = undefined;
    this.researchPopup = undefined;
    this.rulerDisplay = undefined;
    this.mapView = undefined;
    this.mapIncomeEffectsView = undefined;
    this.selectedBuildingView = undefined;
    this.quickBuildView = undefined;
    this.selectedBuildingInstanceId = undefined;
    this.pendingManualBuildBuildingId = undefined;
    this.placementOverlayCache = undefined;

    // Recreate managers with default new-game data
    this.gameManager = new GameManager({
      playerData: {
        race: 'human',
        resources: {
          gold: 100,
          materials: 50,
          food: 75,
          population: 10,
        },
      },
      map: {
        width: 100,
        height: 60,
      },
    });
    this.resourceManager = this.gameManager.resourceManager;
    this.turnManager = new TurnManager(
      this.resourceManager,
      this.gameManager.rulerManager,
      this.gameManager.buildingManager,
      {
        rng: this.gameManager.rng,
        researchManager: this.gameManager.researchManager,
      }
    );

    this.gameManager.logData();

    // Re-add world + UI
    this.addTooltipProvider();
    this.addMapView();
    this.addMapIncomeEffectsView();
    this.addStateDisplay(engine);
    this.addRulerDisplay(engine);
    this.addResourceDisplay(engine);
    this.addTurnDisplay(engine);
    this.addResearchStatusDisplay(engine);
    this.addButtons(engine);
    this.addQuickBuildView();
    this.addSelectedBuildingView();
  }

  private addTooltipProvider(): void {
    this.tooltipProvider = new TooltipProvider({ z: UI_Z.tooltip });
    this.add(this.tooltipProvider);
  }

  private addMapView(): void {
    const map = this.gameManager.mapManager.getMapRef();
    const mapView = new MapView({
      map,
      buildingsProvider: () =>
        this.gameManager.buildingManager.getBuildingMapOverlays(),
      buildingsVersionProvider: () =>
        this.gameManager.buildingManager.getBuildingsVersion(),
      onBuildingSelected: (instanceId) => {
        this.selectBuilding(instanceId, false);
      },
      shouldIgnoreLeftClick: (screenX, screenY) =>
        (this.selectedBuildingView?.containsScreenPoint(screenX, screenY) ??
          false) ||
        (this.quickBuildView?.containsScreenPoint(screenX, screenY) ?? false),
      buildPlacementProvider: () => this.getPlacementOverlay(),
      buildPlacementVersionProvider: () => this.getPlacementOverlayVersion(),
      onBuildPlacementConfirm: (tileX, tileY) => {
        this.handleManualBuildPlacementConfirm(tileX, tileY);
      },
      onBuildPlacementCancel: () => {
        this.cancelManualBuildPlacement();
      },
      isInputBlocked: () => this.hasOpenPopup(),
      tooltipProvider: this.tooltipProvider,
      tileSize: 56,
      showGrid: CONFIG.MAP_SHOW_GRID,
      initialPlayerStateCoverage: CONFIG.MAP_INITIAL_STATE_COVERAGE,
    });

    this.mapView = mapView;
    this.add(mapView);
  }

  private addMapIncomeEffectsView(): void {
    if (!this.mapView) {
      return;
    }

    const effects = new MapIncomeEffectsView({
      mapView: this.mapView,
    });
    this.mapIncomeEffectsView = effects;
    this.add(effects);
  }

  private addStateDisplay(_engine: Engine) {
    this.addHudElement(
      new StateDisplay({
        x: 20,
        y: 20,
        stateManager: this.gameManager.stateManager,
        onClick: () => {
          this.showStatePopup(_engine);
        },
      })
    );
  }

  private showStatePopup(engine: Engine): void {
    if (this.statePopup) {
      this.statePopup.close();
      this.statePopup = undefined;
    }

    const popup = new StatePopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      stateManager: this.gameManager.stateManager,
      buildingManager: this.gameManager.buildingManager,
      resourceManager: this.resourceManager,
      turnManager: this.turnManager,
      tooltipProvider: this.tooltipProvider,
      onClose: () => {
        this.statePopup = undefined;
      },
    });

    this.statePopup = popup;
    this.add(popup);
  }

  private addRulerDisplay(_engine: Engine) {
    const view = new RulerDisplay({
      x: 20,
      y: 100,
      rulerManager: this.gameManager.rulerManager,
      onClick: () => {
        this.showRulerPopup(_engine);
      },
    });
    this.rulerDisplay = view;
    this.addHudElement(view);
  }

  private showRulerPopup(engine: Engine): void {
    if (this.rulerPopup) {
      this.rulerPopup.close();
      this.rulerPopup = undefined;
    }

    const ruler = this.gameManager.rulerManager.getRuler();
    const popup = new ScreenPopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      anchor: 'center',
      width: 520,
      height: 300,
      title: `Ruler: ${ruler.name}`,
      onClose: () => {
        this.rulerPopup = undefined;
      },
      contentBuilder: () => {},
    });

    this.rulerPopup = popup;
    this.add(popup);
  }

  private addResourceDisplay(engine: Engine) {
    this.addHudElement(
      new ResourceDisplay({
        x: engine.drawWidth - 20,
        y: 20,
        bgColor: Color.fromHex('#1a252f'),
        resourceManager: this.resourceManager,
        tooltipProvider: this.tooltipProvider,
        anchor: 'top-right',
      })
    );
  }

  private addTurnDisplay(engine: Engine) {
    this.addHudElement(
      new TurnDisplay({
        x: engine.drawWidth / 2,
        y: 20,
        turnManager: this.turnManager,
      })
    );
  }

  private addButtons(engine: Engine) {
    // little Back to Main Menu button in left top corner
    this.addHudElement(
      new ScreenButton({
        x: 20,
        y: engine.drawHeight - 110,
        width: 100,
        height: 40,
        title: 'Exit',
        onClick: () => {
          engine.goToScene('main-menu');
        },
      })
    );

    this.addHudElement(
      new ScreenButton({
        x: 20,
        y: engine.drawHeight - 60,
        width: 100,
        height: 40,
        title: 'Debug Menu',
        onClick: () => {
          this.showDebugMenu(engine);
        },
      })
    );

    // End Turn button in right bottom corner
    const endTurnButton = new ScreenButton({
      x: engine.drawWidth - 170,
      y: engine.drawHeight - 60,
      width: 150,
      height: 40,
      title: 'End Turn',
      onClick: () => {
        const result = this.turnManager.endTurn();
        this.mapIncomeEffectsView?.addIncomePulses(result.passiveIncomePulses);
        if (!result.upkeepPaid) {
          engine.goToScene('game-over');
        }
      },
    });

    endTurnButton.on('pointerenter', () => {
      this.tooltipProvider.show({
        owner: endTurnButton,
        getAnchorRect: () => ({
          x: endTurnButton.globalPos.x,
          y: endTurnButton.globalPos.y,
          width: endTurnButton.buttonWidth,
          height: endTurnButton.buttonHeight,
        }),
        description: 'Finish current turn and advance to the next one.',
        width: 260,
      });
    });

    endTurnButton.on('pointerleave', () => {
      this.tooltipProvider.hide(endTurnButton);
    });

    endTurnButton.on('prekill', () => {
      this.tooltipProvider.hide(endTurnButton);
    });

    this.addHudElement(endTurnButton);
  }

  private addResearchStatusDisplay(engine: Engine): void {
    this.addHudElement(
      new ResearchStatusView({
        x: 20,
        y: this.getRulerDisplayBottomY() + 16,
        researchManager: this.gameManager.researchManager,
        turnManager: this.turnManager,
        widthProvider: () => this.getRulerDisplayWidth(),
        onClick: () => this.showResearchPopup(engine),
      })
    );
  }

  private showResearchPopup(engine: Engine): void {
    if (this.researchPopup) {
      this.researchPopup.close();
      this.researchPopup = undefined;
    }

    const popup = new ResearchPopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      researchManager: this.gameManager.researchManager,
      turnManager: this.turnManager,
      tooltipProvider: this.tooltipProvider,
      onClose: () => {
        this.researchPopup = undefined;
      },
    });

    this.researchPopup = popup;
    this.add(popup);
  }

  private addSelectedBuildingView(): void {
    const view = new SelectedBuildingView({
      stateManager: this.gameManager.stateManager,
      buildingManager: this.gameManager.buildingManager,
      resourceManager: this.resourceManager,
      turnManager: this.turnManager,
      tooltipProvider: this.tooltipProvider,
    });
    view.setSelectedBuilding(this.selectedBuildingInstanceId);
    this.selectedBuildingView = view;
    this.addHudElement(view);
  }

  private addQuickBuildView(): void {
    const view = new QuickBuildView({
      buildingManager: this.gameManager.buildingManager,
      resourceManager: this.resourceManager,
      turnManager: this.turnManager,
      tooltipProvider: this.tooltipProvider,
      onSelectBuildingForPlacement: (buildingId) => {
        this.startManualBuildPlacement(buildingId);
      },
    });
    this.quickBuildView = view;
    this.addHudElement(view);
  }

  private selectBuilding(
    instanceId: string | undefined,
    syncMap: boolean
  ): void {
    this.selectedBuildingInstanceId = instanceId;
    this.selectedBuildingView?.setSelectedBuilding(instanceId);
    if (syncMap) {
      this.mapView?.setSelectedBuilding(instanceId);
    }
  }

  private showDebugMenu(engine: Engine) {
    const debugButtons: Actor[] = [];
    debugButtons.push(
      //test button to add resources in left top corner below back button
      new ScreenButton({
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        title: 'Add Resources',
        onClick: () => {
          this.resourceManager.addResources({
            gold: 50,
            materials: 25,
            food: 40,
            population: 5,
          });
        },
      }),

      //test button to spend resources in left top corner below add resources button
      new ScreenButton({
        x: 0,
        y: 50,
        width: 100,
        height: 40,
        title: 'Spend Resources',
        onClick: () => {
          if (!this.turnManager.spendActionPoints(1)) return;
          this.resourceManager.spendResources({
            gold: 30,
            materials: 10,
            food: 20,
            population: 2,
          });
        },
      }),

      new ScreenButton({
        x: 0,
        y: 100,
        width: 120,
        height: 40,
        title: 'New Ruler',
        onClick: () => {
          this.gameManager.rulerManager.regenerate();
        },
      }),

      new ActionElement({
        x: 150,
        y: 0,
        width: 330,
        height: 44,
        title: 'Harvest Forest',
        description:
          'Send workers to gather wood from nearby forest tiles. Costs 1 AP and grants materials.',
        icon: Resources.ResourcesIcon,
        outcomes: [
          { label: 'Action Points', value: '-1' },
          {
            label: '',
            value: '+12',
            icon: Resources.ResourcesIcon,
            color: Color.fromHex('#9fe6aa'),
          },
        ],
        tooltipProvider: this.tooltipProvider,
        onClick: () => {
          if (!this.turnManager.spendActionPoints(1)) return;
          this.resourceManager.addResource('materials', 12);
        },
      }),

      new ActionElement({
        x: 150,
        y: 54,
        width: 330,
        height: 44,
        title: 'Fishing Boats',
        description:
          'Launch small boats on water tiles to secure food supplies for the next turn.',
        icon: Resources.FoodIcon,
        outcomes: [
          { label: 'Action Points', value: '-1' },
          {
            label: '',
            value: '+15',
            icon: Resources.FoodIcon,
            color: Color.fromHex('#9fe6aa'),
          },
        ],
        tooltipProvider: this.tooltipProvider,
        onClick: () => {
          if (!this.turnManager.spendActionPoints(1)) return;
          this.resourceManager.addResource('food', 15);
        },
      })
    );

    // Close existing popup if any
    if (this.testPopup) {
      this.testPopup.close();
      this.testPopup = undefined;
    }

    const popup = new ScreenPopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      anchor: 'center',
      width: 520,
      height: 300,
      title: 'Debug Menu',
      content: debugButtons,
      onClose: () => {
        this.testPopup = undefined;
      },
      contentBuilder: () => {},
    });

    this.testPopup = popup;
    this.add(popup);
  }

  private addHudElement<TActor extends Actor>(actor: TActor): TActor {
    actor.z = UI_Z.hud;
    this.add(actor);
    return actor;
  }

  private hasOpenPopup(): boolean {
    return (
      (this.testPopup !== undefined && !this.testPopup.isKilled()) ||
      (this.statePopup !== undefined && !this.statePopup.isKilled()) ||
      (this.rulerPopup !== undefined && !this.rulerPopup.isKilled()) ||
      (this.researchPopup !== undefined && !this.researchPopup.isKilled())
    );
  }

  private getRulerDisplayWidth(): number {
    const width = this.rulerDisplay?.graphics.localBounds.width;
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      return width;
    }
    return 360;
  }

  private getRulerDisplayBottomY(): number {
    const rulerTop = 100;
    const height = this.rulerDisplay?.graphics.localBounds.height;
    if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
      return rulerTop + height;
    }
    return rulerTop + 80;
  }

  private startManualBuildPlacement(buildingId: StateBuildingId): void {
    const hasActionPoint =
      this.turnManager.getTurnDataRef().actionPoints.current >= 1;
    if (!hasActionPoint) {
      return;
    }

    const status = this.gameManager.buildingManager.canBuildBuilding(
      buildingId,
      this.resourceManager
    );
    if (!status.buildable) {
      return;
    }

    this.pendingManualBuildBuildingId = buildingId;
    this.placementOverlayCache = undefined;
  }

  private cancelManualBuildPlacement(): void {
    if (!this.pendingManualBuildBuildingId) {
      return;
    }
    this.pendingManualBuildBuildingId = undefined;
    this.placementOverlayCache = undefined;
  }

  private getPlacementOverlay(): MapBuildPlacementOverlay | undefined {
    const buildingId = this.pendingManualBuildBuildingId;
    if (!buildingId) {
      return undefined;
    }

    const definition =
      this.gameManager.buildingManager.getBuildingDefinition(buildingId);
    if (!definition) {
      return undefined;
    }

    const cacheKey = [
      buildingId,
      this.resourceManager.getResourcesVersion(),
      this.turnManager.getTurnVersion(),
      this.gameManager.buildingManager.getBuildingsVersion(),
    ].join(':');

    if (this.placementOverlayCache?.key === cacheKey) {
      return this.placementOverlayCache.overlay;
    }

    const placements = this.gameManager.buildingManager.getAvailablePlacements(
      buildingId,
      this.resourceManager
    );
    const mapWidth = this.gameManager.mapManager.getMapRef().width;
    const validTopLeftCells = new Set<number>();
    for (const placement of placements) {
      validTopLeftCells.add(placement.y * mapWidth + placement.x);
    }

    const overlay: MapBuildPlacementOverlay = {
      buildingId,
      width: definition.placementRule.width,
      height: definition.placementRule.height,
      validTopLeftCells,
    };

    this.placementOverlayCache = {
      key: cacheKey,
      overlay,
    };
    return overlay;
  }

  private getPlacementOverlayVersion(): number {
    const buildingId = this.pendingManualBuildBuildingId;
    if (!buildingId) {
      return 0;
    }

    let idHash = 0;
    for (let i = 0; i < buildingId.length; i++) {
      idHash += buildingId.charCodeAt(i);
    }

    return (
      idHash * 1_000_000 +
      this.resourceManager.getResourcesVersion() * 101 +
      this.turnManager.getTurnVersion() * 103 +
      this.gameManager.buildingManager.getBuildingsVersion() * 107
    );
  }

  private handleManualBuildPlacementConfirm(tileX: number, tileY: number): void {
    const buildingId = this.pendingManualBuildBuildingId;
    if (!buildingId) {
      return;
    }

    const hasActionPoint =
      this.turnManager.getTurnDataRef().actionPoints.current >= 1;
    if (!hasActionPoint) {
      return;
    }

    const buildStatus = this.gameManager.buildingManager.canPlaceBuildingAt(
      buildingId,
      tileX,
      tileY,
      this.resourceManager
    );
    if (!buildStatus.buildable) {
      return;
    }

    const built = this.gameManager.buildingManager.buildBuildingAt(
      buildingId,
      tileX,
      tileY,
      this.resourceManager
    );
    if (!built) {
      return;
    }

    this.turnManager.spendActionPoints(1);
    const latestInstance =
      this.gameManager.buildingManager.getLatestBuildingInstance(buildingId);
    this.selectBuilding(latestInstance?.instanceId, true);

    this.cancelManualBuildPlacement();
  }
}
