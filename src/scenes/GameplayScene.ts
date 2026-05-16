import {
  Actor,
  Color,
  Engine,
  Keys,
  Rectangle,
  Scene,
  ScreenElement,
  vec,
  type SceneActivationContext,
} from 'excalibur';
import { CONFIG } from '../_common/config';
import type { StateBuildingId } from '../_common/models/buildings.models';
import type { GameSetupData } from '../_common/models/game-setup.models';
import type { SaveSlotId } from '../_common/models/save.models';
import type { MapBuildPlacementOverlay } from '../_common/models/ui.models';
import { createGameTestBridge } from '../_common/testing/gameTestBridge';
import {
  createDefaultGameSetup,
  getMapSizeDefinition,
  getStatePrehistoryDefinition,
} from '../data/gameSetup';
import { GameManager } from '../managers/GameManager';
import { ResourceManager } from '../managers/ResourceManager';
import { SaveManager } from '../managers/SaveManager';
import { TurnManager } from '../managers/TurnManager';
import {
  LAYOUT,
  SIDEBAR_LAYOUT,
  SIDEBAR_STACK,
} from '../ui/constants/LayoutConstants';
import { UI_Z } from '../ui/constants/ZLayers';
import { ScreenButton } from '../ui/elements/ScreenButton';
import { PopupController } from '../ui/PopupController';
import { TooltipProvider } from '../ui/tooltip/TooltipProvider';
import { AutoTurnControlView } from '../ui/views/AutoTurnControlView';
import { ConditionStatusView } from '../ui/views/ConditionStatusView';
import { LogView } from '../ui/views/LogView';
import { MapIncomeEffectsView } from '../ui/views/MapIncomeEffectsView';
import { MapView } from '../ui/views/MapView';
import { MilitaryStatusView } from '../ui/views/MilitaryStatusView';
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
  private static readonly AUTO_TURN_DELAY_MS = 10_000;

  private gameManager!: GameManager;
  private resourceManager!: ResourceManager;
  private readonly testBridge = createGameTestBridge();
  private turnManager!: TurnManager;
  private tooltipProvider!: TooltipProvider;
  private popupController!: PopupController;
  private mapView?: MapView;
  private mapIncomeEffectsView?: MapIncomeEffectsView;
  private selectedBuildingView?: SelectedBuildingView;
  private quickBuildView?: QuickBuildView;
  private selectedBuildingInstanceId?: string;
  private pendingManualBuildBuildingId?: StateBuildingId;
  private pendingSowField?: { farmInstanceId: string };
  private placementOverlayCache?: {
    key: string;
    overlay: MapBuildPlacementOverlay;
  };
  private activeSaveSlot?: SaveSlotId;
  private lastSavedSignature = '';
  private autoTurnEnabled = false;
  private boundBeforeUnload?: () => void;
  private autoTurnCountdownMs = 0;
  private autoTurnCountdownTurnNumber?: number;
  private autoTurnBaselineSignature?: string;

  onInitialize(_engine: Engine): void {
    // Set background color
    this.backgroundColor = Color.fromHex('#2c3e50');
  }

  onActivate(context: SceneActivationContext): void {
    // Excalibur Scenes are initialized once, then re-activated many times.
    // Reset state on activation so starting a new game gets fresh defaults.
    this.testBridge.reportScene('gameplay');
    this.resetGame(context.engine);
  }

  onPreUpdate(engine: Engine, elapsedMs: number): void {
    const quickBuildExpanded = this.quickBuildView?.isExpanded() ?? false;

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.S)) {
      this.popupController.showStatePopup();
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.F)) {
      this.mapView?.focusOnPlayerState();
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.X)) {
      this.popupController.showRulerPopup();
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.R)) {
      this.popupController.showResearchPopup();
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.T)) {
      this.popupController.showMilitaryPopup();
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.H)) {
      this.popupController.showLogPopup();
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.M)) {
      this.popupController.showGameMenuPopup();
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.D)) {
      this.popupController.showDebugMenu();
    }

    if (engine.input.keyboard.wasPressed(Keys.Esc)) {
      if (quickBuildExpanded) {
        this.quickBuildView?.collapse();
      } else if (this.pendingManualBuildBuildingId || this.pendingSowField) {
        this.cancelManualBuildPlacement();
      } else {
        this.popupController.closeTopPopup();
      }
    }

    if (
      !quickBuildExpanded &&
      engine.input.keyboard.wasPressed(Keys.Space) &&
      !this.popupController.hasOpenPopup()
    ) {
      this.performEndTurn(engine);
    }

    this.popupController.syncBattleUi();
    this.updateAutoTurn(engine, elapsedMs);
    this.autoSaveIfDirty();
  }

  onDeactivate(): void {
    this.saveCurrentGame();

    this.popupController.clear();
    this.tooltipProvider = undefined!;
    this.mapView = undefined;
    this.mapIncomeEffectsView = undefined;
    this.selectedBuildingView = undefined;
    this.quickBuildView = undefined;
    this.selectedBuildingInstanceId = undefined;
    this.pendingManualBuildBuildingId = undefined;
    this.pendingSowField = undefined;
    this.placementOverlayCache = undefined;
    this.activeSaveSlot = undefined;
    this.lastSavedSignature = '';
    this.clearAutoTurnCountdown();
    if (this.boundBeforeUnload) {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
      this.boundBeforeUnload = undefined;
    }
  }

  private resetGame(engine: Engine): void {
    // Remove all actors/entities/timers from the previous run
    this.clear();
    this.mapView = undefined;
    this.mapIncomeEffectsView = undefined;
    this.selectedBuildingView = undefined;
    this.quickBuildView = undefined;
    this.selectedBuildingInstanceId = undefined;
    this.pendingManualBuildBuildingId = undefined;
    this.pendingSowField = undefined;
    this.placementOverlayCache = undefined;
    this.clearAutoTurnCountdown();

    const launch = SaveManager.consumePendingLaunch();
    const selectedSlot: SaveSlotId = launch?.slot ?? 1;
    const slotSave =
      launch?.mode === 'continue'
        ? SaveManager.loadFromSlot(selectedSlot)
        : undefined;
    const newGameSetup = launch?.setup ?? createDefaultGameSetup();

    this.activeSaveSlot = selectedSlot;
    this.gameManager = slotSave
      ? new GameManager({ saveData: slotSave })
      : new GameManager(this.buildNewGameOptions(newGameSetup));
    this.resourceManager = this.gameManager.resourceManager;
    this.turnManager = new TurnManager(
      this.resourceManager,
      this.gameManager.rulerManager,
      this.gameManager.buildingManager,
      {
        rng: this.gameManager.rng,
        mapManager: this.gameManager.mapManager,
        researchManager: this.gameManager.researchManager,
        militaryManager: this.gameManager.militaryManager,
        politicsManager: this.gameManager.politicsManager,
        randomEventManager: this.gameManager.randomEventManager,
        logManager: this.gameManager.logManager,
        initial: slotSave?.turn
          ? {
              data: slotSave.turn.data,
              version: slotSave.turn.version,
              emptyFieldQueue: slotSave.turn.emptyFieldQueue,
            }
          : undefined,
      }
    );
    this.gameManager.randomEventManager.setFocusBridge({
      getFocusCurrent: () => this.turnManager.getTurnDataRef().focus.current,
      adjustFocus: (delta) => this.turnManager.adjustFocus(delta),
    });
    this.gameManager.buildingManager.setCurrentTurnProvider(
      () => this.turnManager.getTurnDataRef().turnNumber
    );
    this.gameManager.politicsManager.setDecisionFocusBridge({
      getFocusCurrent: () => this.turnManager.getTurnDataRef().focus.current,
      spendFocus: (amount) => this.turnManager.spendFocus(amount),
    });
    this.turnManager.setConditionBridge({
      getAggregatedEffects: () =>
        this.gameManager.conditionManager.getAggregatedEffects(),
      tickConditions: () => this.gameManager.conditionManager.tickConditions(),
    });
    this.gameManager.randomEventManager.setConditionBridge({
      applyCondition: (conditionId, currentTurn, options) =>
        this.gameManager.conditionManager.applyCondition(
          conditionId,
          currentTurn,
          options
        ),
    });
    this.gameManager.researchManager.setResearchSpeedProvider(() => {
      return (
        this.gameManager.conditionManager.getAggregatedEffects()
          .researchSpeedModifier ?? 1
      );
    });
    this.gameManager.buildingManager.setBuildSpeedProvider(() => {
      return (
        this.gameManager.conditionManager.getAggregatedEffects()
          .buildSpeedModifier ?? 1
      );
    });
    this.gameManager.militaryManager.setCombatModifierProvider(() => {
      return (
        this.gameManager.conditionManager.getAggregatedEffects()
          .combatModifiers ?? {}
      );
    });
    this.gameManager.logManager.setCurrentDate(
      this.turnManager.getTurnDataRef().turnNumber,
      this.turnManager.getDateLabel()
    );
    if (slotSave) {
      // Loaded from existing save — no log entry needed.
    } else {
      const prehistory = getStatePrehistoryDefinition(newGameSetup.prehistory);
      this.gameManager.logManager.addNeutral(
        `A new reign begins in ${this.gameManager.stateManager.getStateRef().name} under the ${prehistory.label.toLowerCase()} prehistory.`
      );
    }

    // Re-add world + UI
    this.addTooltipProvider();
    this.popupController = new PopupController({
      addActor: (actor) => this.add(actor),
      engine,
      gameManager: this.gameManager,
      resourceManager: this.resourceManager,
      turnManager: this.turnManager,
      tooltipProvider: this.tooltipProvider,
      onSaveGame: () => this.saveCurrentGame(),
    });
    this.addMapView();
    this.addMapIncomeEffectsView();
    this.addLayoutBackgrounds(engine);
    this.addStateDisplay(engine);
    this.addRulerDisplay(engine);
    this.addResourceDisplay(engine);
    this.addTurnDisplay(engine);
    this.addResearchStatusDisplay(engine);
    this.addMilitaryStatusDisplay(engine);
    this.addConditionStatusView(engine);
    this.addLogView(engine);
    this.addButtons(engine);
    this.addQuickBuildView();
    this.addSelectedBuildingView();
    if (slotSave) {
      this.popupController.showPendingRandomEventPopup();
    } else {
      this.popupController.showIntroductionLorePopup(newGameSetup);
    }

    this.saveCurrentGame();

    if (this.boundBeforeUnload) {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
    }
    this.boundBeforeUnload = () => this.saveCurrentGame();
    window.addEventListener('beforeunload', this.boundBeforeUnload);
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
      onFieldTileSelected: (tileX, tileY) => {
        this.selectField(tileX, tileY);
      },
      fallowFieldInfo: (tileX, tileY) =>
        this.turnManager.getEmptyFieldTurnsLeft(tileX, tileY),
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
      isInputBlocked: () => this.popupController.hasOpenPopup(),
      tooltipProvider: this.tooltipProvider,
      tileSize: 56,
      showGrid: CONFIG.MAP_SHOW_GRID,
      initialPlayerStateCoverage: CONFIG.MAP_INITIAL_STATE_COVERAGE,
      viewportLeft: LAYOUT.SIDEBAR_WIDTH,
      viewportTop: LAYOUT.TOPBAR_HEIGHT,
      viewportWidth: CONFIG.GAME_WIDTH - LAYOUT.SIDEBAR_WIDTH,
      viewportHeight: CONFIG.GAME_HEIGHT - LAYOUT.TOPBAR_HEIGHT,
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

  /** Draw sidebar and topbar background panels that sit above the map. */
  private addLayoutBackgrounds(engine: Engine): void {
    const bgColor = Color.fromHex('#0f1a24');
    const borderColor = Color.fromHex('#2a4158');

    // Sidebar background
    const sidebar = new ScreenElement({ x: 0, y: LAYOUT.TOPBAR_HEIGHT });
    sidebar.anchor = vec(0, 0);
    sidebar.graphics.use(
      new Rectangle({
        width: LAYOUT.SIDEBAR_WIDTH,
        height: engine.drawHeight - LAYOUT.TOPBAR_HEIGHT,
        color: bgColor,
      })
    );
    sidebar.z = UI_Z.hud - 1;
    this.add(sidebar);

    // Sidebar right border
    const sidebarBorder = new ScreenElement({
      x: LAYOUT.SIDEBAR_WIDTH - 1,
      y: LAYOUT.TOPBAR_HEIGHT,
    });
    sidebarBorder.anchor = vec(0, 0);
    sidebarBorder.graphics.use(
      new Rectangle({
        width: 1,
        height: engine.drawHeight - LAYOUT.TOPBAR_HEIGHT,
        color: borderColor,
      })
    );
    sidebarBorder.z = UI_Z.hud - 1;
    this.add(sidebarBorder);

    // Topbar background
    const topbar = new ScreenElement({ x: 0, y: 0 });
    topbar.anchor = vec(0, 0);
    topbar.graphics.use(
      new Rectangle({
        width: engine.drawWidth,
        height: LAYOUT.TOPBAR_HEIGHT,
        color: bgColor,
      })
    );
    topbar.z = UI_Z.hud - 1;
    this.add(topbar);

    // Topbar bottom border
    const topbarBorder = new ScreenElement({
      x: 0,
      y: LAYOUT.TOPBAR_HEIGHT - 1,
    });
    topbarBorder.anchor = vec(0, 0);
    topbarBorder.graphics.use(
      new Rectangle({
        width: engine.drawWidth,
        height: 1,
        color: borderColor,
      })
    );
    topbarBorder.z = UI_Z.hud - 1;
    this.add(topbarBorder);
  }

  private addStateDisplay(_engine: Engine) {
    const view = new StateDisplay({
      x: SIDEBAR_LAYOUT.panelX,
      y: SIDEBAR_STACK.stateY,
      stateManager: this.gameManager.stateManager,
      politicsManager: this.gameManager.politicsManager,
      widthProvider: () => SIDEBAR_LAYOUT.panelWidth,
      onClick: () => this.popupController.showStatePopup(),
    });
    this.addHudElement(view);
  }

  private addRulerDisplay(_engine: Engine) {
    const view = new RulerDisplay({
      x: SIDEBAR_LAYOUT.panelX,
      y: SIDEBAR_STACK.rulerY,
      rulerManager: this.gameManager.rulerManager,
      widthProvider: () => SIDEBAR_LAYOUT.panelWidth,
      yProvider: () => SIDEBAR_STACK.rulerY,
      onClick: () => this.popupController.showRulerPopup(),
    });
    this.addHudElement(view);
  }

  private addResourceDisplay(_engine: Engine) {
    // Resources left-aligned in topbar after the sidebar.
    // ResourceDisplay actual height = iconSize(24) + padding(8)*2 = 40
    this.addHudElement(
      new ResourceDisplay({
        x: LAYOUT.SIDEBAR_WIDTH + LAYOUT.MARGIN,
        y: (LAYOUT.TOPBAR_HEIGHT - 40) / 2,
        bgColor: Color.fromHex('#0c141c'),
        resourceManager: this.resourceManager,
        buildingManager: this.gameManager.buildingManager,
        tooltipProvider: this.tooltipProvider,
        anchor: 'top-left',
      })
    );
  }

  private addTurnDisplay(engine: Engine) {
    // Date label right-aligned in the topbar.
    this.addHudElement(
      new TurnDisplay({
        x: engine.drawWidth - LAYOUT.MARGIN,
        y: LAYOUT.TOPBAR_HEIGHT / 2,
        turnManager: this.turnManager,
        tooltipProvider: this.tooltipProvider,
      })
    );
  }

  private addButtons(engine: Engine) {
    const btnGap = 8;
    const btnWidth = (SIDEBAR_LAYOUT.panelWidth - btnGap) / 2;
    const btnHeight = 30;
    const btnY = (LAYOUT.TOPBAR_HEIGHT - btnHeight) / 2;

    // Game Menu button in top-left (topbar, within sidebar width)
    this.addHudElement(
      new ScreenButton({
        x: SIDEBAR_LAYOUT.panelX,
        y: btnY,
        width: btnWidth,
        height: btnHeight,
        title: 'Menu [M]',
        onClick: () => this.popupController.showGameMenuPopup(),
      })
    );

    this.addHudElement(
      new ScreenButton({
        x: SIDEBAR_LAYOUT.panelX + btnWidth + btnGap,
        y: btnY,
        width: btnWidth,
        height: btnHeight,
        title: 'Debug [D]',
        onClick: () => this.popupController.showDebugMenu(),
      })
    );

    // End Turn button in bottom-right of map area
    const endTurnButtonWidth = 180;
    const endTurnButtonX = engine.drawWidth - endTurnButtonWidth - 20;
    const endTurnButtonY = engine.drawHeight - 60;
    const endTurnButton = new ScreenButton({
      x: endTurnButtonX,
      y: endTurnButtonY,
      width: endTurnButtonWidth,
      height: 40,
      title: 'End Turn [Space]',
      onClick: () => {
        this.performEndTurn(engine);
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

    this.addHudElement(
      new AutoTurnControlView({
        x: endTurnButtonX - 56,
        y: endTurnButtonY - 8,
        progressWidth: endTurnButtonWidth,
        enabledProvider: () => this.autoTurnEnabled,
        progressProvider: () => this.getAutoTurnProgress(),
        onToggle: () => {
          this.toggleAutoTurn();
        },
        tooltipProvider: this.tooltipProvider,
      })
    );
    this.addHudElement(endTurnButton);
  }

  /** Execute end-of-turn logic (shared by button click and Space hotkey). */
  private performEndTurn(engine: Engine): void {
    this.clearAutoTurnCountdown();
    const result = this.turnManager.endTurn();
    this.mapIncomeEffectsView?.addIncomePulses(result.passiveIncomePulses);
    this.mapIncomeEffectsView?.addIncomePulses(result.actionPulses);
    this.saveCurrentGame();
    if (!result.upkeepPaid) {
      engine.goToScene('game-over');
      return;
    }
    if (result.pendingRandomEvent) {
      this.popupController.showPendingRandomEventPopup();
      return;
    }
    this.armAutoTurnForCurrentTurn();
  }

  private addResearchStatusDisplay(_engine: Engine): void {
    const view = new ResearchStatusView({
      x: SIDEBAR_LAYOUT.panelX,
      y: SIDEBAR_STACK.researchY,
      researchManager: this.gameManager.researchManager,
      turnManager: this.turnManager,
      widthProvider: () => SIDEBAR_LAYOUT.panelWidth,
      yProvider: () => SIDEBAR_STACK.researchY,
      onClick: () => this.popupController.showResearchPopup(),
    });
    this.addHudElement(view);
  }

  private addMilitaryStatusDisplay(_engine: Engine): void {
    const view = new MilitaryStatusView({
      x: SIDEBAR_LAYOUT.panelX,
      y: SIDEBAR_STACK.militaryY,
      militaryManager: this.gameManager.militaryManager,
      buildingManager: this.gameManager.buildingManager,
      widthProvider: () => SIDEBAR_LAYOUT.panelWidth,
      yProvider: () => SIDEBAR_STACK.militaryY,
      onClick: () => this.popupController.showMilitaryPopup(),
    });
    this.addHudElement(view);
  }

  private addConditionStatusView(engine: Engine): void {
    const view = new ConditionStatusView({
      conditionManager: this.gameManager.conditionManager,
      tooltipProvider: this.tooltipProvider,
      rightX: engine.drawWidth - LAYOUT.MARGIN,
      topY: LAYOUT.TOPBAR_HEIGHT + LAYOUT.MARGIN,
    });
    this.addHudElement(view);
  }

  private addLogView(engine: Engine): void {
    const view = new LogView({
      x: SIDEBAR_LAYOUT.panelX,
      y: SIDEBAR_STACK.logY,
      width: SIDEBAR_LAYOUT.panelWidth,
      height: SIDEBAR_STACK.getLogHeight(engine.drawHeight),
      logManager: this.gameManager.logManager,
      onClick: () => this.popupController.showLogPopup(),
    });
    this.addHudElement(view);
  }

  private addSelectedBuildingView(): void {
    const HARVEST_TIMBER_RANGE = 3;
    const view = new SelectedBuildingView({
      stateManager: this.gameManager.stateManager,
      buildingManager: this.gameManager.buildingManager,
      resourceManager: this.resourceManager,
      turnManager: this.turnManager,
      tooltipProvider: this.tooltipProvider,
      mapTileProvider: (x, y) =>
        this.gameManager.mapManager.getMapRef().tiles[y]?.[x],
      mapViewportLeft: LAYOUT.SIDEBAR_WIDTH,
      mapViewportWidth: CONFIG.GAME_WIDTH - LAYOUT.SIDEBAR_WIDTH,
      onActionPulses: (pulses) => {
        this.mapIncomeEffectsView?.addIncomePulses(pulses);
      },
      onActionPlacementRequest: (_buildingId, actionId, instanceId) => {
        if (actionId === 'sow-field') {
          this.startSowFieldPlacement(instanceId);
        }
      },
      onActionPopupRequest: (buildingId, actionId, instanceId, popupId) => {
        if (
          buildingId === 'market' &&
          actionId === 'trade' &&
          popupId === 'market-trade'
        ) {
          this.popupController.showMarketTradePopup(instanceId);
        }
      },
      onActionHover: (buildingId, actionId, instanceId, hovered) => {
        if (
          !hovered ||
          buildingId !== 'lumbermill' ||
          actionId !== 'harvest-timber'
        ) {
          this.mapView?.setActionRangeHighlight(undefined);
          return;
        }

        const map = this.gameManager.mapManager.getMapRef();
        const instances = this.gameManager.buildingManager
          .getBuildingInstances()
          .filter((i) => i.instanceId === instanceId);

        const cells = new Set<number>();
        for (const inst of instances) {
          const minTx = inst.x - HARVEST_TIMBER_RANGE;
          const maxTx = inst.x + inst.width - 1 + HARVEST_TIMBER_RANGE;
          const minTy = inst.y - HARVEST_TIMBER_RANGE;
          const maxTy = inst.y + inst.height - 1 + HARVEST_TIMBER_RANGE;
          for (let ty = minTy; ty <= maxTy; ty++) {
            for (let tx = minTx; tx <= maxTx; tx++) {
              if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) {
                cells.add(ty * map.width + tx);
              }
            }
          }
        }

        this.mapView?.setActionRangeHighlight(cells);
      },
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
      leftMargin: LAYOUT.SIDEBAR_WIDTH + 20,
      bottomMargin: 20,
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
    this.clearAutoTurnCountdown();
    this.selectedBuildingInstanceId = instanceId;
    this.selectedBuildingView?.setSelectedBuilding(instanceId);
    this.mapView?.setActionRangeHighlight(undefined);
    if (syncMap) {
      this.mapView?.setSelectedBuilding(instanceId);
    }
  }

  private selectField(tileX: number, tileY: number): void {
    this.clearAutoTurnCountdown();
    this.selectedBuildingInstanceId = undefined;
    this.selectedBuildingView?.setSelectedField(tileX, tileY);
    this.mapView?.setActionRangeHighlight(undefined);
    this.mapView?.setSelectedField(tileX, tileY);
  }


  private autoSaveIfDirty(): void {
    if (!this.activeSaveSlot) {
      return;
    }

    const signature = this.buildSaveSignature();
    if (signature === this.lastSavedSignature) {
      return;
    }

    this.saveCurrentGame(signature);
  }

  private saveCurrentGame(signatureOverride?: string): void {
    if (!this.activeSaveSlot) {
      return;
    }

    const save = SaveManager.captureGameState(
      this.gameManager,
      this.turnManager
    );
    SaveManager.saveToSlot(this.activeSaveSlot, save);
    this.lastSavedSignature = signatureOverride ?? this.buildSaveSignature();
  }

  private toggleAutoTurn(): void {
    this.autoTurnEnabled = !this.autoTurnEnabled;
    if (this.autoTurnEnabled) {
      this.armAutoTurnForCurrentTurn();
    } else {
      this.clearAutoTurnCountdown();
    }
  }

  private getAutoTurnProgress(): number {
    if (
      !this.autoTurnEnabled ||
      this.autoTurnCountdownMs <= 0 ||
      this.autoTurnCountdownTurnNumber !==
        this.turnManager.getTurnDataRef().turnNumber
    ) {
      return 0;
    }

    return this.autoTurnCountdownMs / GameplayScene.AUTO_TURN_DELAY_MS;
  }

  private armAutoTurnForCurrentTurn(): void {
    if (!this.autoTurnEnabled || !this.canAutoTurnContinue()) {
      this.clearAutoTurnCountdown();
      return;
    }

    this.autoTurnCountdownTurnNumber =
      this.turnManager.getTurnDataRef().turnNumber;
    this.autoTurnBaselineSignature = this.buildSaveSignature();
    this.autoTurnCountdownMs = GameplayScene.AUTO_TURN_DELAY_MS;
  }

  private clearAutoTurnCountdown(): void {
    this.autoTurnCountdownMs = 0;
    this.autoTurnCountdownTurnNumber = undefined;
    this.autoTurnBaselineSignature = undefined;
  }

  private updateAutoTurn(engine: Engine, elapsedMs: number): void {
    if (!this.autoTurnEnabled || this.autoTurnCountdownMs <= 0) {
      return;
    }

    const turnNumber = this.turnManager.getTurnDataRef().turnNumber;
    if (this.autoTurnCountdownTurnNumber !== turnNumber) {
      this.clearAutoTurnCountdown();
      return;
    }

    if (!this.canAutoTurnContinue()) {
      this.clearAutoTurnCountdown();
      return;
    }

    if (!this.autoTurnBaselineSignature) {
      this.clearAutoTurnCountdown();
      return;
    }

    if (this.buildSaveSignature() !== this.autoTurnBaselineSignature) {
      this.clearAutoTurnCountdown();
      return;
    }

    this.autoTurnCountdownMs = Math.max(
      0,
      this.autoTurnCountdownMs - elapsedMs
    );
    if (this.autoTurnCountdownMs > 0) {
      return;
    }

    this.performEndTurn(engine);
  }

  private canAutoTurnContinue(): boolean {
    return (
      !this.popupController.hasOpenPopup() &&
      !(this.quickBuildView?.isExpanded() ?? false) &&
      !this.pendingManualBuildBuildingId &&
      !this.pendingSowField &&
      !this.gameManager.randomEventManager.getPendingEventPresentation() &&
      !this.gameManager.militaryManager.getActiveBattle() &&
      !this.gameManager.militaryManager.getLastBattleResult()
    );
  }

  private buildSaveSignature(): string {
    const resourcesVersion = this.resourceManager.getResourcesVersion();
    const buildingsVersion =
      this.gameManager.buildingManager.getBuildingsVersion();
    const researchVersion =
      this.gameManager.researchManager.getResearchVersion();
    const militaryVersion =
      this.gameManager.militaryManager.getMilitaryVersion();
    const politicsVersion = this.gameManager.politicsManager.getVersion();
    const randomEventVersion = this.gameManager.randomEventManager.getVersion();
    const logVersion = this.gameManager.logManager.getVersion();
    const turnVersion = this.turnManager.getTurnVersion();
    const rngState = this.gameManager.rng.getState();
    const ruler = this.gameManager.rulerManager.getRulerRef();
    const state = this.gameManager.stateManager.getStateRef();

    return [
      resourcesVersion,
      buildingsVersion,
      researchVersion,
      militaryVersion,
      politicsVersion,
      randomEventVersion,
      logVersion,
      turnVersion,
      rngState,
      ruler.age,
      ruler.name,
      state.name,
      state.size,
      state.ocean,
      state.tiles.forest,
      state.tiles.stone,
      state.tiles.plains,
      state.tiles.river,
    ].join('|');
  }

  private addHudElement<TActor extends Actor>(actor: TActor): TActor {
    actor.z = UI_Z.hud;
    this.add(actor);
    return actor;
  }


  private startManualBuildPlacement(buildingId: StateBuildingId): void {
    const hasActionPoint = this.turnManager.getTurnDataRef().focus.current >= 1;
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
    if (!this.pendingManualBuildBuildingId && !this.pendingSowField) {
      return;
    }
    this.pendingManualBuildBuildingId = undefined;
    this.pendingSowField = undefined;
    this.placementOverlayCache = undefined;
  }

  private startSowFieldPlacement(farmInstanceId: string): void {
    this.pendingManualBuildBuildingId = undefined;
    this.pendingSowField = { farmInstanceId };
    this.placementOverlayCache = undefined;
  }

  private getPlacementOverlay(): MapBuildPlacementOverlay | undefined {
    if (this.pendingSowField) {
      const { farmInstanceId } = this.pendingSowField;
      const cacheKey = `sow-field:${farmInstanceId}:${this.gameManager.buildingManager.getBuildingsVersion()}`;
      if (this.placementOverlayCache?.key === cacheKey) {
        return this.placementOverlayCache.overlay;
      }
      const placements =
        this.gameManager.buildingManager.getAvailableFieldPlacements(
          farmInstanceId,
          2
        );
      const mapWidth = this.gameManager.mapManager.getMapRef().width;
      const validTopLeftCells = new Set<number>();
      for (const p of placements) {
        validTopLeftCells.add(p.y * mapWidth + p.x);
      }
      const overlay: MapBuildPlacementOverlay = {
        buildingId: 'field',
        width: 2,
        height: 2,
        validTopLeftCells,
      };
      this.placementOverlayCache = { key: cacheKey, overlay };
      return overlay;
    }

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
    if (this.pendingSowField) {
      const { farmInstanceId } = this.pendingSowField;
      let idHash = 99;
      for (let i = 0; i < farmInstanceId.length; i++) {
        idHash += farmInstanceId.charCodeAt(i);
      }
      return (
        idHash * 1_000_000 +
        this.gameManager.buildingManager.getBuildingsVersion() * 107
      );
    }

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

  private handleManualBuildPlacementConfirm(
    tileX: number,
    tileY: number
  ): void {
    if (this.pendingSowField) {
      const { farmInstanceId } = this.pendingSowField;
      const hasAP = this.turnManager.getTurnDataRef().focus.current >= 1;
      if (!hasAP) return;
      const valid = this.gameManager.buildingManager
        .getAvailableFieldPlacements(farmInstanceId, 2)
        .some((p) => p.x === tileX && p.y === tileY);
      if (!valid) return;
      this.gameManager.buildingManager.placeFarmField(
        tileX,
        tileY,
        farmInstanceId
      );
      this.turnManager.spendFocus(1);
      this.cancelManualBuildPlacement();
      return;
    }

    const buildingId = this.pendingManualBuildBuildingId;
    if (!buildingId) {
      return;
    }

    const hasActionPoint = this.turnManager.getTurnDataRef().focus.current >= 1;
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

    this.turnManager.spendFocus(1);
    const latestInstance =
      this.gameManager.buildingManager.getLatestBuildingInstance(buildingId);
    this.selectBuilding(latestInstance?.instanceId, true);

    this.cancelManualBuildPlacement();
  }

  private buildNewGameOptions(
    setup: GameSetupData
  ): ConstructorParameters<typeof GameManager>[0] {
    const mapSize = getMapSizeDefinition(setup.mapSize);
    const prehistory = getStatePrehistoryDefinition(setup.prehistory);
    const resources = {
      gold: 100,
      wood: 50,
      stone: 50,
      jewelry: 0,
      ironOre: 0,
      wheat: 0,
      meat: 50,
      bread: 50,
      fish: 0,
      population: 10,
      politicalPower: 0,
    };

    for (const [resourceType, amount] of Object.entries(
      prehistory.startingResources ?? {}
    )) {
      const key = resourceType as keyof typeof resources;
      resources[key] += amount ?? 0;
    }

    return {
      setup,
      playerData: {
        race: 'human',
        resources,
      },
      map: {
        width: mapSize.width,
        height: mapSize.height,
      },
      state: {
        name: setup.stateName,
      },
      ruler: {
        name: setup.rulerName,
        traits: [...setup.rulerTraits],
      },
      startingTechnologies: prehistory.startingTechnologies,
      startingUnits: prehistory.startingUnits?.map((unit) => ({ ...unit })),
    };
  }
}
