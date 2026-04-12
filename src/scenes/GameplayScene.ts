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
import { getIconSprite } from '../_common/icons';
import type { StateBuildingId } from '../_common/models/buildings.models';
import type { GameSetupData } from '../_common/models/game-setup.models';
import { FOOD_RESOURCE_TYPES } from '../_common/models/resource.models';
import type { RandomEventOption } from '../_common/models/ui.models';
import type { SaveSlotId } from '../_common/models/save.models';
import type {
  MapBuildPlacementOverlay,
  RandomEventPopupOptions,
} from '../_common/models/ui.models';
import { createGameTestBridge } from '../_common/testing/gameTestBridge';
import {
  createDefaultGameSetup,
  getMapSizeDefinition,
  getStatePrehistoryDefinition,
  introductionLoreDefinitions,
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
import { ActionElement } from '../ui/elements/ActionElement';
import { ScreenButton } from '../ui/elements/ScreenButton';
import { ScreenPopup } from '../ui/elements/ScreenPopup';
import { BattlePopup } from '../ui/popups/BattlePopup';
import { BattleResultPopup } from '../ui/popups/BattleResultPopup';
import { GameMenuPopup } from '../ui/popups/GameMenuPopup';
import { IntroductionLorePopup } from '../ui/popups/IntroductionLorePopup';
import { LogPopup } from '../ui/popups/LogPopup';
import { MarketTradePopup } from '../ui/popups/MarketTradePopup';
import { MilitaryPopup } from '../ui/popups/MilitaryPopup';
import { RandomEventPopup } from '../ui/popups/RandomEventPopup';
import { ResearchPopup } from '../ui/popups/ResearchPopup';
import { RulerPopup } from '../ui/popups/RulerPopup';
import { StatePopup } from '../ui/popups/StatePopup';
import {
  buildTooltipEffectResourceSections,
  buildTooltipResourceSection,
} from '../ui/tooltip/TooltipResourceSection';
import { TooltipProvider } from '../ui/tooltip/TooltipProvider';
import { AutoTurnControlView } from '../ui/views/AutoTurnControlView';
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
  private mapView?: MapView;
  private mapIncomeEffectsView?: MapIncomeEffectsView;
  private testPopup?: ScreenPopup;
  private gameMenuPopup?: GameMenuPopup;
  private statePopup?: StatePopup;
  private rulerPopup?: ScreenPopup;
  private researchPopup?: ResearchPopup;
  private militaryPopup?: MilitaryPopup;
  private marketTradePopup?: MarketTradePopup;
  private battlePopup?: BattlePopup;
  private battleResultPopup?: BattleResultPopup;
  private introductionLorePopup?: IntroductionLorePopup;
  private randomEventPopup?: RandomEventPopup;
  private logPopup?: LogPopup;
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
    this.syncBattleUi(engine);

    const quickBuildExpanded = this.quickBuildView?.isExpanded() ?? false;

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.S)) {
      this.showStatePopup(engine);
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.F)) {
      this.mapView?.focusOnPlayerState();
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.X)) {
      this.showRulerPopup(engine);
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.R)) {
      this.showResearchPopup(engine);
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.T)) {
      this.showMilitaryPopup(engine);
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.H)) {
      this.showLogPopup(engine);
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.M)) {
      this.showGameMenuPopup(engine);
    }

    if (!quickBuildExpanded && engine.input.keyboard.wasPressed(Keys.D)) {
      this.showDebugMenu(engine);
    }

    if (engine.input.keyboard.wasPressed(Keys.Esc)) {
      if (quickBuildExpanded) {
        this.quickBuildView?.collapse();
      } else if (this.pendingManualBuildBuildingId || this.pendingSowField) {
        this.cancelManualBuildPlacement();
      } else {
        this.closeTopPopup();
      }
    }

    if (
      !quickBuildExpanded &&
      engine.input.keyboard.wasPressed(Keys.Space) &&
      !this.hasOpenPopup()
    ) {
      this.performEndTurn(engine);
    }

    this.updateAutoTurn(engine, elapsedMs);
    this.autoSaveIfDirty();
  }

  onDeactivate(): void {
    this.saveCurrentGame();

    // Clean up references so they can be garbage-collected between scene transitions
    this.tooltipProvider = undefined!;
    this.mapView = undefined;
    this.mapIncomeEffectsView = undefined;
    this.testPopup = undefined;
    this.gameMenuPopup = undefined;
    this.statePopup = undefined;
    this.rulerPopup = undefined;
    this.researchPopup = undefined;
    this.militaryPopup = undefined;
    this.battlePopup = undefined;
    this.battleResultPopup = undefined;
    this.introductionLorePopup = undefined;
    this.randomEventPopup = undefined;
    this.logPopup = undefined;
    this.selectedBuildingView = undefined;
    this.quickBuildView = undefined;
    this.selectedBuildingInstanceId = undefined;
    this.pendingManualBuildBuildingId = undefined;
    this.pendingSowField = undefined;
    this.placementOverlayCache = undefined;
    this.activeSaveSlot = undefined;
    this.lastSavedSignature = '';
    this.clearAutoTurnCountdown();
  }

  private resetGame(engine: Engine): void {
    // Remove all actors/entities/timers from the previous run
    this.clear();
    this.testPopup = undefined;
    this.gameMenuPopup = undefined;
    this.statePopup = undefined;
    this.rulerPopup = undefined;
    this.researchPopup = undefined;
    this.militaryPopup = undefined;
    this.battlePopup = undefined;
    this.battleResultPopup = undefined;
    this.introductionLorePopup = undefined;
    this.randomEventPopup = undefined;
    this.logPopup = undefined;
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

    this.gameManager.logData();

    // Re-add world + UI
    this.addTooltipProvider();
    this.addMapView();
    this.addMapIncomeEffectsView();
    this.addLayoutBackgrounds(engine);
    this.addStateDisplay(engine);
    this.addRulerDisplay(engine);
    this.addResourceDisplay(engine);
    this.addTurnDisplay(engine);
    this.addResearchStatusDisplay(engine);
    this.addMilitaryStatusDisplay(engine);
    this.addLogView(engine);
    this.addButtons(engine);
    this.addQuickBuildView();
    this.addSelectedBuildingView();
    if (slotSave) {
      this.showPendingRandomEventPopup(engine);
    } else {
      this.showIntroductionLorePopup(engine, newGameSetup);
    }

    this.saveCurrentGame();
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
      isInputBlocked: () => this.hasOpenPopup(),
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
      onClick: () => {
        this.showStatePopup(_engine);
      },
    });
    this.addHudElement(view);
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
      politicsManager: this.gameManager.politicsManager,
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
      x: SIDEBAR_LAYOUT.panelX,
      y: SIDEBAR_STACK.rulerY,
      rulerManager: this.gameManager.rulerManager,
      widthProvider: () => SIDEBAR_LAYOUT.panelWidth,
      yProvider: () => SIDEBAR_STACK.rulerY,
      onClick: () => {
        this.showRulerPopup(_engine);
      },
    });
    this.addHudElement(view);
  }

  private showRulerPopup(engine: Engine): void {
    if (this.rulerPopup) {
      this.rulerPopup.close();
      this.rulerPopup = undefined;
    }

    const popup = new RulerPopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      rulerManager: this.gameManager.rulerManager,
      tooltipProvider: this.tooltipProvider,
      onClose: () => {
        this.rulerPopup = undefined;
      },
    });

    this.rulerPopup = popup;
    this.add(popup);
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
        onClick: () => {
          this.showGameMenuPopup(engine);
        },
      })
    );

    this.addHudElement(
      new ScreenButton({
        x: SIDEBAR_LAYOUT.panelX + btnWidth + btnGap,
        y: btnY,
        width: btnWidth,
        height: btnHeight,
        title: 'Debug [D]',
        onClick: () => {
          this.showDebugMenu(engine);
        },
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
      this.showPendingRandomEventPopup(engine);
      return;
    }
    this.armAutoTurnForCurrentTurn();
  }

  private syncBattleUi(engine: Engine): void {
    const activeBattle = this.gameManager?.militaryManager.getActiveBattle();
    const lastBattleResult =
      this.gameManager?.militaryManager.getLastBattleResult();

    if (lastBattleResult) {
      if (this.battlePopup && !this.battlePopup.isKilled()) {
        this.battlePopup.close();
        this.battlePopup = undefined;
      }
      if (!this.battleResultPopup || this.battleResultPopup.isKilled()) {
        this.showBattleResultPopup(engine);
      }
      return;
    }

    if (activeBattle) {
      if (!this.battlePopup || this.battlePopup.isKilled()) {
        this.showBattlePopup(engine);
      }
      return;
    }

    if (this.battlePopup && !this.battlePopup.isKilled()) {
      this.battlePopup.close();
      this.battlePopup = undefined;
    }
  }

  private addResearchStatusDisplay(engine: Engine): void {
    const view = new ResearchStatusView({
      x: SIDEBAR_LAYOUT.panelX,
      y: SIDEBAR_STACK.researchY,
      researchManager: this.gameManager.researchManager,
      turnManager: this.turnManager,
      widthProvider: () => SIDEBAR_LAYOUT.panelWidth,
      yProvider: () => SIDEBAR_STACK.researchY,
      onClick: () => this.showResearchPopup(engine),
    });
    this.addHudElement(view);
  }

  private addMilitaryStatusDisplay(engine: Engine): void {
    const view = new MilitaryStatusView({
      x: SIDEBAR_LAYOUT.panelX,
      y: SIDEBAR_STACK.militaryY,
      militaryManager: this.gameManager.militaryManager,
      buildingManager: this.gameManager.buildingManager,
      widthProvider: () => SIDEBAR_LAYOUT.panelWidth,
      yProvider: () => SIDEBAR_STACK.militaryY,
      onClick: () => this.showMilitaryPopup(engine),
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
      onClick: () => this.showLogPopup(engine),
    });
    this.addHudElement(view);
  }

  private showLogPopup(engine: Engine): void {
    if (this.logPopup) {
      this.logPopup.close();
      this.logPopup = undefined;
    }

    const popup = new LogPopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      logManager: this.gameManager.logManager,
      onClose: () => {
        this.logPopup = undefined;
      },
    });

    this.logPopup = popup;
    this.add(popup);
  }

  private showMilitaryPopup(engine: Engine): void {
    if (this.militaryPopup) {
      this.militaryPopup.close();
      this.militaryPopup = undefined;
    }

    const popup = new MilitaryPopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      militaryManager: this.gameManager.militaryManager,
      buildingManager: this.gameManager.buildingManager,
      resourceManager: this.resourceManager,
      turnManager: this.turnManager,
      tooltipProvider: this.tooltipProvider,
      onClose: () => {
        this.militaryPopup = undefined;
      },
    });

    this.militaryPopup = popup;
    this.add(popup);
  }

  private showBattlePopup(engine: Engine): void {
    if (this.battlePopup) {
      this.battlePopup.close();
      this.battlePopup = undefined;
    }

    const popup = new BattlePopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      militaryManager: this.gameManager.militaryManager,
      rng: this.gameManager.rng,
      tooltipProvider: this.tooltipProvider,
      onClose: () => {
        this.battlePopup = undefined;
      },
    });

    this.battlePopup = popup;
    this.add(popup);
  }

  private showBattleResultPopup(engine: Engine): void {
    const result = this.gameManager.militaryManager.getLastBattleResult();
    if (!result) return;

    if (this.battleResultPopup) {
      this.battleResultPopup.close();
      this.battleResultPopup = undefined;
    }

    const popup = new BattleResultPopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      result,
      tooltipProvider: this.tooltipProvider,
      onClose: () => {
        this.battleResultPopup = undefined;
        this.gameManager.militaryManager.clearLastBattleResult();
      },
    });

    this.battleResultPopup = popup;
    this.add(popup);
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
          this.showMarketTradePopup(instanceId);
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

  private showGameMenuPopup(engine: Engine): void {
    if (this.gameMenuPopup) {
      this.gameMenuPopup.close();
      this.gameMenuPopup = undefined;
    }

    const popup = new GameMenuPopup({
      engine,
      onClose: () => {
        this.gameMenuPopup = undefined;
      },
      onSaveAndExit: () => {
        this.saveCurrentGame();
        engine.goToScene('main-menu');
      },
    });

    this.gameMenuPopup = popup;
    this.add(popup);
  }

  private showMarketTradePopup(marketInstanceId: string): void {
    if (this.marketTradePopup) {
      this.marketTradePopup.close();
      this.marketTradePopup = undefined;
    }

    const engine = this.engine;
    const popup = new MarketTradePopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      buildingManager: this.gameManager.buildingManager,
      resourceManager: this.resourceManager,
      turnManager: this.turnManager,
      logManager: this.gameManager.logManager,
      marketInstanceId,
      onClose: () => {
        this.marketTradePopup = undefined;
      },
    });
    this.marketTradePopup = popup;
    this.add(popup);
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
            wood: 15,
            stone: 15,
            wheat: 20,
            meat: 10,
            bread: 10,
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
          if (!this.turnManager.spendFocus(1)) return;
          this.resourceManager.spendResources({
            gold: 30,
            wood: 5,
            stone: 5,
            bread: 5,
            meat: 5,
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

      new ScreenButton({
        x: 0,
        y: 150,
        width: 120,
        height: 40,
        title: 'Test Battle',
        onClick: () => {
          this.startDebugBattle(engine);
        },
      }),

      new ScreenButton({
        x: 0,
        y: 200,
        width: 120,
        height: 40,
        title: 'Peasants',
        onClick: () => {
          this.showAngryPeasantsEvent(engine);
        },
      }),

      new ActionElement({
        x: 150,
        y: 0,
        width: 330,
        height: 44,
        title: 'Harvest Forest',
        description:
          'Send workers to gather wood from nearby forest tiles. Costs 1 AP and grants Wood.',
        icon: getIconSprite('resources'),
        outcomes: buildTooltipEffectResourceSections({
          resourceEffects: { wood: 4 },
          focusDelta: -1,
          resourceManager: this.resourceManager,
          focusAvailable: this.turnManager.getTurnDataRef().focus.current,
        }),
        tooltipProvider: this.tooltipProvider,
        onClick: () => {
          if (!this.turnManager.spendFocus(1)) return;
          this.resourceManager.addResource('wood', 4);
        },
      }),

      new ActionElement({
        x: 150,
        y: 54,
        width: 330,
        height: 44,
        title: 'Fishing Boats',
        description:
          'Launch small boats on water tiles to secure meat supplies for the next turn.',
        icon: getIconSprite('food'),
        outcomes: buildTooltipEffectResourceSections({
          resourceEffects: { meat: 5 },
          focusDelta: -1,
          resourceManager: this.resourceManager,
          focusAvailable: this.turnManager.getTurnDataRef().focus.current,
        }),
        tooltipProvider: this.tooltipProvider,
        onClick: () => {
          if (!this.turnManager.spendFocus(1)) return;
          this.resourceManager.addResource('meat', 5);
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
      height: 360,
      title: 'Debug Menu',
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      content: debugButtons,
      onClose: () => {
        this.testPopup = undefined;
      },
      contentBuilder: () => {},
    });

    this.testPopup = popup;
    this.add(popup);
  }

  private startDebugBattle(engine: Engine): void {
    if (this.testPopup && !this.testPopup.isKilled()) {
      this.testPopup.close();
      this.testPopup = undefined;
    }
    if (this.battleResultPopup && !this.battleResultPopup.isKilled()) {
      this.battleResultPopup.close();
      this.battleResultPopup = undefined;
      this.gameManager.militaryManager.clearLastBattleResult();
    }

    this.gameManager.militaryManager.startBattle({
      name: 'Debug Skirmish',
      player: {
        label: 'Player',
        morale: 68,
      },
      enemy: {
        label: 'Militia',
        morale: 52,
        units: { militia: 10 },
      },
      rewardMultiplier: 1,
    });
    this.showBattlePopup(engine);
  }

  private showRandomEventPopup(
    engine: Engine,
    config: Omit<
      RandomEventPopupOptions,
      'x' | 'y' | 'anchor' | 'tooltipProvider' | 'onClose'
    >,
    announceInLog = true
  ): void {
    if (this.randomEventPopup && !this.randomEventPopup.isKilled()) {
      this.randomEventPopup.close();
      this.randomEventPopup = undefined;
    }

    const popup = new RandomEventPopup({
      ...config,
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      anchor: 'center',
      tooltipProvider: this.tooltipProvider,
      onClose: () => {
        this.randomEventPopup = undefined;
      },
    });

    this.randomEventPopup = popup;
    if (announceInLog) {
      this.gameManager.logManager.addNeutral(`Event: ${config.title}.`);
    }
    this.add(popup);
  }

  private showPendingRandomEventPopup(engine: Engine): void {
    const pending =
      this.gameManager.randomEventManager.getPendingEventPresentation();
    if (!pending) {
      return;
    }

    this.showRandomEventPopup(engine, {
      title: pending.title,
      description: pending.description,
      options: pending.options.map((option) => ({
        title: option.title,
        outcomeDescription: option.outcomeDescription,
        resourceEffects: option.resourceEffects,
        focusDelta: option.focusDelta,
        resourceRanges: option.resourceRanges,
        focusRange: option.focusRange,
        tooltipOutcomes: this.buildRandomEventTooltipOutcomes(option),
        skillCheck: option.skillCheck,
        disabled: option.disabled,
        disabledReason: option.disabledReason,
        onSelect: () => {
          const resolution =
            this.gameManager.randomEventManager.resolvePendingEventOption(
              option.id
            );
          if (!resolution) {
            return;
          }
          this.saveCurrentGame();
          if (!resolution.battleStarted) {
            this.showRandomEventResolutionPopup(engine, resolution);
          }
        },
      })),
    });
  }

  private showRandomEventResolutionPopup(
    engine: Engine,
    resolution: {
      title: string;
      description: string;
    }
  ): void {
    this.showRandomEventPopup(
      engine,
      {
        title: `${resolution.title} Resolved`,
        description: resolution.description,
        options: [
          {
            title: 'Continue',
            outcomeDescription: 'Resume the turn.',
            onSelect: () => {},
          },
        ],
      },
      false
    );
  }

  private showAngryPeasantsEvent(engine: Engine): void {
    if (this.testPopup && !this.testPopup.isKilled()) {
      this.testPopup.close();
      this.testPopup = undefined;
    }

    const foodDemand = 8;
    const totalFood = this.getTotalFoodStock();
    const canGiveFood = totalFood >= foodDemand;
    const canNegotiate =
      this.turnManager.getTurnDataRef().focus.current >= 1 &&
      this.resourceManager.getResource('gold') >= 4;

    this.showRandomEventPopup(engine, {
      title: 'Angry Peasants',
      description:
        'A hungry crowd has gathered before the granary doors. They shout that the winter levies were harsh, the bakeries bare, and the lordly storehouses too full for honest folk to go unfed. The reeve waits for your word before the mood turns from anger to riot.',
      options: [
        {
          title: 'Open the Granaries',
          disabled: !canGiveFood,
          disabledReason: canGiveFood
            ? undefined
            : 'Not enough food in reserve.',
          tooltipOutcomes: buildTooltipResourceSection('Costs', [
            {
              resourceType: 'food',
              amount: foodDemand,
              available: totalFood,
            },
          ]),
          outcomeDescription: canGiveFood
            ? 'Open the stores and feed the crowd before dusk.'
            : 'Open the stores and try to satisfy the crowd.',
          onSelect: () => {
            if (!this.spendFoodFromStores(foodDemand)) {
              return;
            }
            this.gameManager.logManager.addGood(
              'The angry peasants were fed from the granaries.'
            );
          },
        },
        {
          title: 'Send the Steward',
          disabled: !canNegotiate,
          disabledReason: canNegotiate
            ? undefined
            : 'Not enough Focus or Gold.',
          tooltipOutcomes: buildTooltipEffectResourceSections({
            resourceEffects: { gold: -4 },
            focusDelta: -1,
            resourceManager: this.resourceManager,
            focusAvailable: this.turnManager.getTurnDataRef().focus.current,
          }),
          outcomeDescription: canNegotiate
            ? 'Send your steward to promise relief, record grievances, and quiet the square without bloodshed.'
            : 'Without coin and personal attention, no peaceful settlement can be arranged.',
          onSelect: () => {
            if (!this.turnManager.spendFocus(1)) return;
            if (!this.resourceManager.spendResource('gold', 4)) return;
            this.gameManager.logManager.addGood(
              'The steward calmed the angry peasants.'
            );
          },
        },
        {
          title: 'Break the Crowd',
          outcomeDescription:
            'Begin a battle against Angry Peasants. Order will be restored by force if your troops prevail.',
          onSelect: () => {
            if (this.battleResultPopup && !this.battleResultPopup.isKilled()) {
              this.battleResultPopup.close();
              this.battleResultPopup = undefined;
              this.gameManager.militaryManager.clearLastBattleResult();
            }
            this.gameManager.militaryManager.startBattle({
              name: 'Angry Peasants',
              player: {
                label: 'Player',
                morale: 66,
              },
              enemy: {
                label: 'Peasants',
                morale: 44,
                units: { militia: 14 },
              },
              rewardMultiplier: 0.6,
            });
            this.gameManager.logManager.addBad(
              'The angry peasants were confronted by force.'
            );
            this.showBattlePopup(engine);
          },
        },
      ],
    });
  }

  private getTotalFoodStock(): number {
    let total = 0;
    for (const type of FOOD_RESOURCE_TYPES) {
      total += this.resourceManager.getResource(type);
    }
    return total;
  }

  private spendFoodFromStores(amount: number): boolean {
    let remaining = amount;
    if (this.getTotalFoodStock() < amount) {
      return false;
    }

    for (const type of FOOD_RESOURCE_TYPES) {
      const available = this.resourceManager.getResource(type);
      const spend = Math.min(available, remaining);
      if (spend > 0) {
        this.resourceManager.spendResource(type, spend);
        remaining -= spend;
      }
      if (remaining <= 0) {
        break;
      }
    }

    return remaining <= 0;
  }

  private buildRandomEventTooltipOutcomes(
    option: Pick<
      RandomEventOption,
      'resourceEffects' | 'focusDelta' | 'resourceRanges' | 'focusRange'
    >
  ) {
    const fixedEffects = buildTooltipEffectResourceSections({
      resourceEffects: option.resourceEffects,
      focusDelta: option.focusDelta,
      resourceManager: this.resourceManager,
      focusAvailable: this.turnManager.getTurnDataRef().focus.current,
    });

    const coveredResources = new Set<string>([
      ...Object.keys(option.resourceEffects ?? {}),
      ...(option.focusDelta ? ['focus'] : []),
    ]);

    const rangeCosts: Array<{
      resourceType: import('../ui/tooltip/TooltipResourceSection').TooltipResourceKey;
      amount: string;
    }> = [];
    const rangeGains: Array<{
      resourceType: import('../ui/tooltip/TooltipResourceSection').TooltipResourceKey;
      amount: string;
    }> = [];

    const addRange = (
      resourceType: import('../ui/tooltip/TooltipResourceSection').TooltipResourceKey,
      min: number,
      max: number
    ) => {
      if (coveredResources.has(resourceType)) {
        return;
      }

      if (max <= 0) {
        rangeCosts.push({
          resourceType,
          amount: this.formatTooltipRange(Math.abs(max), Math.abs(min)),
        });
        return;
      }

      if (min >= 0) {
        rangeGains.push({
          resourceType,
          amount: this.formatTooltipRange(min, max),
        });
        return;
      }

      rangeCosts.push({
        resourceType,
        amount: this.formatTooltipRange(0, Math.abs(min)),
      });
      rangeGains.push({
        resourceType,
        amount: this.formatTooltipRange(0, max),
      });
    };

    for (const range of option.resourceRanges ?? []) {
      addRange(range.resourceType, range.min, range.max);
    }

    if (option.focusRange) {
      addRange('focus', option.focusRange.min, option.focusRange.max);
    }

    return [
      ...fixedEffects,
      ...buildTooltipResourceSection('Costs', rangeCosts),
      ...buildTooltipResourceSection('Gains', rangeGains),
    ];
  }

  private formatTooltipRange(min: number, max: number): string {
    return min === max ? `${max}` : `${min}-${max}`;
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
      !this.hasOpenPopup() &&
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

  private hasOpenPopup(): boolean {
    return (
      (this.testPopup !== undefined && !this.testPopup.isKilled()) ||
      (this.gameMenuPopup !== undefined && !this.gameMenuPopup.isKilled()) ||
      (this.statePopup !== undefined && !this.statePopup.isKilled()) ||
      (this.rulerPopup !== undefined && !this.rulerPopup.isKilled()) ||
      (this.researchPopup !== undefined && !this.researchPopup.isKilled()) ||
      (this.militaryPopup !== undefined && !this.militaryPopup.isKilled()) ||
      (this.introductionLorePopup !== undefined &&
        !this.introductionLorePopup.isKilled()) ||
      (this.randomEventPopup !== undefined &&
        !this.randomEventPopup.isKilled()) ||
      (this.logPopup !== undefined && !this.logPopup.isKilled()) ||
      (this.battlePopup !== undefined && !this.battlePopup.isKilled()) ||
      (this.battleResultPopup !== undefined &&
        !this.battleResultPopup.isKilled())
    );
  }

  private closeTopPopup(): void {
    if (this.introductionLorePopup && !this.introductionLorePopup.isKilled()) {
      this.introductionLorePopup.close();
      this.introductionLorePopup = undefined;
      return;
    }
    if (this.gameMenuPopup && !this.gameMenuPopup.isKilled()) {
      this.gameMenuPopup.close();
      this.gameMenuPopup = undefined;
      return;
    }
    if (this.militaryPopup && !this.militaryPopup.isKilled()) {
      this.militaryPopup.close();
      this.militaryPopup = undefined;
      return;
    }
    if (this.logPopup && !this.logPopup.isKilled()) {
      this.logPopup.close();
      this.logPopup = undefined;
      return;
    }
    if (this.battleResultPopup && !this.battleResultPopup.isKilled()) {
      this.battleResultPopup.close();
      this.battleResultPopup = undefined;
      return;
    }
    if (this.battlePopup && !this.battlePopup.isKilled()) {
      this.battlePopup.close();
      this.battlePopup = undefined;
      return;
    }
    if (this.researchPopup && !this.researchPopup.isKilled()) {
      this.researchPopup.close();
      this.researchPopup = undefined;
      return;
    }
    if (this.statePopup && !this.statePopup.isKilled()) {
      this.statePopup.close();
      this.statePopup = undefined;
      return;
    }
    if (this.rulerPopup && !this.rulerPopup.isKilled()) {
      this.rulerPopup.close();
      this.rulerPopup = undefined;
      return;
    }
    if (this.testPopup && !this.testPopup.isKilled()) {
      this.testPopup.close();
      this.testPopup = undefined;
    }
  }

  private showIntroductionLorePopup(
    engine: Engine,
    setup: GameSetupData
  ): void {
    if (this.introductionLorePopup) {
      this.introductionLorePopup.close();
      this.introductionLorePopup = undefined;
    }

    const prehistory = getStatePrehistoryDefinition(setup.prehistory);
    const loreDefinition =
      introductionLoreDefinitions[setup.prehistory] ??
      introductionLoreDefinitions['distant-colony'];
    const stateName = this.gameManager.stateManager.getStateRef().name;
    const rulerName = this.gameManager.rulerManager.getRulerRef().name;

    const popup = new IntroductionLorePopup({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      title: loreDefinition.title,
      body: `${stateName} now stands beneath the authority of ${rulerName}. ${prehistory.description} ${loreDefinition.body}`,
      onClose: () => {
        this.introductionLorePopup = undefined;
        this.showPendingRandomEventPopup(engine);
      },
    });

    this.introductionLorePopup = popup;
    this.add(popup);
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
