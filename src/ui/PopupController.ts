import { Actor, Color } from 'excalibur';
import type { Engine } from 'excalibur';
import { getIconSprite } from '../_common/icons';
import type { GameSetupData } from '../_common/models/game-setup.models';
import { FOOD_RESOURCE_TYPES } from '../_common/models/resource.models';
import type {
  RandomEventOption,
  RandomEventPopupOptions,
} from '../_common/models/ui.models';
import { getAllConditionDefinitions } from '../data/conditions';
import {
  getStatePrehistoryDefinition,
  introductionLoreDefinitions,
} from '../data/gameSetup';
import type { GameManager } from '../managers/GameManager';
import type { ResourceManager } from '../managers/ResourceManager';
import type { TurnManager } from '../managers/TurnManager';
import { UI_Z } from './constants/ZLayers';
import { ActionElement } from './elements/ActionElement';
import { ScreenButton } from './elements/ScreenButton';
import { ScreenPopup } from './elements/ScreenPopup';
import { BattlePopup } from './popups/BattlePopup';
import { BattleResultPopup } from './popups/BattleResultPopup';
import { GameMenuPopup } from './popups/GameMenuPopup';
import { IntroductionLorePopup } from './popups/IntroductionLorePopup';
import { LogPopup } from './popups/LogPopup';
import { MarketTradePopup } from './popups/MarketTradePopup';
import { MilitaryPopup } from './popups/MilitaryPopup';
import { RandomEventPopup } from './popups/RandomEventPopup';
import { ResearchPopup } from './popups/ResearchPopup';
import { RulerPopup } from './popups/RulerPopup';
import { NpcPopup } from './popups/NpcPopup';
import { StatePopup } from './popups/StatePopup';
import type { TooltipProvider } from './tooltip/TooltipProvider';
import {
  buildTooltipEffectResourceSections,
  buildTooltipResourceSection,
  type TooltipResourceKey,
} from './tooltip/TooltipResourceSection';

export interface PopupControllerOptions {
  addActor: (actor: Actor) => void;
  engine: Engine;
  gameManager: GameManager;
  resourceManager: ResourceManager;
  turnManager: TurnManager;
  tooltipProvider: TooltipProvider;
  onSaveGame: () => void;
}

export class PopupController {
  private readonly addActor: (actor: Actor) => void;
  private readonly engine: Engine;
  private readonly gm: GameManager;
  private readonly rm: ResourceManager;
  private readonly tm: TurnManager;
  private readonly tp: TooltipProvider;
  private readonly onSaveGame: () => void;

  private testPopup?: ScreenPopup;
  private gameMenuPopup?: GameMenuPopup;
  private statePopup?: StatePopup;
  private rulerPopup?: RulerPopup;
  private researchPopup?: ResearchPopup;
  private militaryPopup?: MilitaryPopup;
  private marketTradePopup?: MarketTradePopup;
  private battlePopup?: BattlePopup;
  private battleResultPopup?: BattleResultPopup;
  private introductionLorePopup?: IntroductionLorePopup;
  private randomEventPopup?: RandomEventPopup;
  private npcPopup?: NpcPopup;
  private logPopup?: LogPopup;

  constructor(opts: PopupControllerOptions) {
    this.addActor = opts.addActor;
    this.engine = opts.engine;
    this.gm = opts.gameManager;
    this.rm = opts.resourceManager;
    this.tm = opts.turnManager;
    this.tp = opts.tooltipProvider;
    this.onSaveGame = opts.onSaveGame;
  }

  clear(): void {
    this.testPopup = undefined;
    this.gameMenuPopup = undefined;
    this.statePopup = undefined;
    this.rulerPopup = undefined;
    this.researchPopup = undefined;
    this.militaryPopup = undefined;
    this.marketTradePopup = undefined;
    this.battlePopup = undefined;
    this.battleResultPopup = undefined;
    this.introductionLorePopup = undefined;
    this.randomEventPopup = undefined;
    this.logPopup = undefined;
  }

  hasOpenPopup(): boolean {
    return (
      (this.testPopup !== undefined && !this.testPopup.isKilled()) ||
      (this.gameMenuPopup !== undefined && !this.gameMenuPopup.isKilled()) ||
      (this.statePopup !== undefined && !this.statePopup.isKilled()) ||
      (this.rulerPopup !== undefined && !this.rulerPopup.isKilled()) ||
      (this.researchPopup !== undefined && !this.researchPopup.isKilled()) ||
      (this.militaryPopup !== undefined && !this.militaryPopup.isKilled()) ||
      (this.marketTradePopup !== undefined &&
        !this.marketTradePopup.isKilled()) ||
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

  closeTopPopup(): void {
    if (
      this.introductionLorePopup &&
      !this.introductionLorePopup.isKilled()
    ) {
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
    if (this.marketTradePopup && !this.marketTradePopup.isKilled()) {
      this.marketTradePopup.close();
      this.marketTradePopup = undefined;
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

  syncBattleUi(): void {
    const activeBattle = this.gm.militaryManager.getActiveBattle();
    const lastBattleResult = this.gm.militaryManager.getLastBattleResult();

    if (lastBattleResult) {
      if (this.battlePopup && !this.battlePopup.isKilled()) {
        this.battlePopup.close();
        this.battlePopup = undefined;
      }
      if (!this.battleResultPopup || this.battleResultPopup.isKilled()) {
        this.showBattleResultPopup();
      }
      return;
    }

    if (activeBattle) {
      if (!this.battlePopup || this.battlePopup.isKilled()) {
        this.showBattlePopup();
      }
      return;
    }

    if (this.battlePopup && !this.battlePopup.isKilled()) {
      this.battlePopup.close();
      this.battlePopup = undefined;
    }
  }

  showStatePopup(initialTab?: string): void {
    if (this.statePopup) {
      this.statePopup.close();
      this.statePopup = undefined;
    }
    const { drawWidth, drawHeight } = this.engine;
    const popup = new StatePopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      stateManager: this.gm.stateManager,
      buildingManager: this.gm.buildingManager,
      resourceManager: this.rm,
      turnManager: this.tm,
      politicsManager: this.gm.politicsManager,
      personManager: this.gm.personManager,
      tooltipProvider: this.tp,
      initialTab,
      onShowNpc: (personId) => this.showNpcPopup(personId),
      onClose: () => {
        this.statePopup = undefined;
      },
    });
    this.statePopup = popup;
    this.addActor(popup);
  }

  showNpcPopup(personId: string): void {
    if (this.npcPopup && !this.npcPopup.isKilled()) {
      this.npcPopup.close();
      this.npcPopup = undefined;
    }
    const { drawWidth, drawHeight } = this.engine;
    const popup = new NpcPopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      personId,
      personManager: this.gm.personManager,
      buildingManager: this.gm.buildingManager,
      resourceManager: this.rm,
      turnManager: this.tm,
      militaryManager: this.gm.militaryManager,
      logManager: this.gm.logManager,
      tooltipProvider: this.tp,
      rng: this.gm.rng,
      onClose: () => {
        this.npcPopup = undefined;
      },
    });
    this.npcPopup = popup;
    this.addActor(popup);
  }

  showRulerPopup(): void {
    if (this.rulerPopup) {
      this.rulerPopup.close();
      this.rulerPopup = undefined;
    }
    const { drawWidth, drawHeight } = this.engine;
    const popup = new RulerPopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      rulerManager: this.gm.rulerManager,
      tooltipProvider: this.tp,
      onClose: () => {
        this.rulerPopup = undefined;
      },
    });
    this.rulerPopup = popup;
    this.addActor(popup);
  }

  showResearchPopup(): void {
    if (this.researchPopup) {
      this.researchPopup.close();
      this.researchPopup = undefined;
    }
    const { drawWidth, drawHeight } = this.engine;
    const popup = new ResearchPopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      researchManager: this.gm.researchManager,
      turnManager: this.tm,
      tooltipProvider: this.tp,
      onClose: () => {
        this.researchPopup = undefined;
      },
    });
    this.researchPopup = popup;
    this.addActor(popup);
  }

  showMilitaryPopup(): void {
    if (this.militaryPopup) {
      this.militaryPopup.close();
      this.militaryPopup = undefined;
    }
    const { drawWidth, drawHeight } = this.engine;
    const popup = new MilitaryPopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      militaryManager: this.gm.militaryManager,
      buildingManager: this.gm.buildingManager,
      resourceManager: this.rm,
      turnManager: this.tm,
      tooltipProvider: this.tp,
      onClose: () => {
        this.militaryPopup = undefined;
      },
    });
    this.militaryPopup = popup;
    this.addActor(popup);
  }

  showBattlePopup(): void {
    if (this.battlePopup) {
      this.battlePopup.close();
      this.battlePopup = undefined;
    }
    const { drawWidth, drawHeight } = this.engine;
    const popup = new BattlePopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      militaryManager: this.gm.militaryManager,
      rng: this.gm.rng,
      tooltipProvider: this.tp,
      onClose: () => {
        this.battlePopup = undefined;
      },
    });
    this.battlePopup = popup;
    this.addActor(popup);
  }

  showBattleResultPopup(): void {
    const result = this.gm.militaryManager.getLastBattleResult();
    if (!result) return;
    if (this.battleResultPopup) {
      this.battleResultPopup.close();
      this.battleResultPopup = undefined;
    }
    const { drawWidth, drawHeight } = this.engine;
    const popup = new BattleResultPopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      result,
      tooltipProvider: this.tp,
      onClose: () => {
        this.battleResultPopup = undefined;
        this.gm.militaryManager.clearLastBattleResult();
      },
    });
    this.battleResultPopup = popup;
    this.addActor(popup);
  }

  showLogPopup(): void {
    if (this.logPopup) {
      this.logPopup.close();
      this.logPopup = undefined;
    }
    const { drawWidth, drawHeight } = this.engine;
    const popup = new LogPopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      logManager: this.gm.logManager,
      onClose: () => {
        this.logPopup = undefined;
      },
    });
    this.logPopup = popup;
    this.addActor(popup);
  }

  showGameMenuPopup(): void {
    if (this.gameMenuPopup) {
      this.gameMenuPopup.close();
      this.gameMenuPopup = undefined;
    }
    if (this.testPopup) {
      this.testPopup.close();
      this.testPopup = undefined;
    }
    const popup = new GameMenuPopup({
      engine: this.engine,
      onClose: () => {
        this.gameMenuPopup = undefined;
      },
      onSaveAndExit: () => {
        this.onSaveGame();
        this.engine.goToScene('main-menu');
      },
    });
    this.gameMenuPopup = popup;
    this.addActor(popup);
  }

  showMarketTradePopup(marketInstanceId: string): void {
    if (this.marketTradePopup) {
      this.marketTradePopup.close();
      this.marketTradePopup = undefined;
    }
    const { drawWidth, drawHeight } = this.engine;
    const popup = new MarketTradePopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      buildingManager: this.gm.buildingManager,
      resourceManager: this.rm,
      turnManager: this.tm,
      logManager: this.gm.logManager,
      marketInstanceId,
      onClose: () => {
        this.marketTradePopup = undefined;
      },
    });
    this.marketTradePopup = popup;
    this.addActor(popup);
  }

  showPendingRandomEventPopup(): void {
    const pending =
      this.gm.randomEventManager.getPendingEventPresentation();
    if (!pending) return;
    this.showRandomEventPopup({
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
            this.gm.randomEventManager.resolvePendingEventOption(option.id);
          if (!resolution) return;
          this.onSaveGame();
          if (!resolution.battleStarted) {
            this.showRandomEventResolutionPopup(resolution);
          }
        },
      })),
    });
  }

  showIntroductionLorePopup(setup: GameSetupData): void {
    if (this.introductionLorePopup) {
      this.introductionLorePopup.close();
      this.introductionLorePopup = undefined;
    }
    const prehistory = getStatePrehistoryDefinition(setup.prehistory);
    const loreDefinition =
      introductionLoreDefinitions[setup.prehistory] ??
      introductionLoreDefinitions['distant-colony'];
    const stateName = this.gm.stateManager.getStateRef().name;
    const rulerName = this.gm.rulerManager.getRulerRef().name;
    const { drawWidth, drawHeight } = this.engine;
    const popup = new IntroductionLorePopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      title: loreDefinition.title,
      body: `${stateName} now stands beneath the authority of ${rulerName}. ${prehistory.description} ${loreDefinition.body}`,
      onClose: () => {
        this.introductionLorePopup = undefined;
        this.showPendingRandomEventPopup();
      },
    });
    this.introductionLorePopup = popup;
    this.addActor(popup);
  }

  showDebugMenu(): void {
    const debugButtons: Actor[] = [];
    debugButtons.push(
      new ScreenButton({
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        title: 'Add Resources',
        onClick: () => {
          this.rm.addResources({
            gold: 50,
            wood: 15,
            stone: 15,
            wheat: 20,
            meat: 10,
            bread: 10,
          });
        },
      }),

      new ScreenButton({
        x: 0,
        y: 50,
        width: 100,
        height: 40,
        title: 'Spend Resources',
        onClick: () => {
          if (!this.tm.spendFocus(1)) return;
          this.rm.spendResources({
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
          this.gm.rulerManager.regenerate();
        },
      }),

      new ScreenButton({
        x: 0,
        y: 150,
        width: 120,
        height: 40,
        title: 'Test Battle',
        onClick: () => {
          this.startDebugBattle();
        },
      }),

      new ScreenButton({
        x: 0,
        y: 200,
        width: 120,
        height: 40,
        title: 'Peasants',
        onClick: () => {
          this.showAngryPeasantsEvent();
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
          resourceManager: this.rm,
          focusAvailable: this.tm.getTurnDataRef().focus.current,
        }),
        tooltipProvider: this.tp,
        onClick: () => {
          if (!this.tm.spendFocus(1)) return;
          this.rm.addResource('wood', 4);
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
          resourceManager: this.rm,
          focusAvailable: this.tm.getTurnDataRef().focus.current,
        }),
        tooltipProvider: this.tp,
        onClick: () => {
          if (!this.tm.spendFocus(1)) return;
          this.rm.addResource('meat', 5);
        },
      }),

      ...getAllConditionDefinitions().map(
        (def, i) =>
          new ScreenButton({
            x: 150,
            y: 110 + i * 32,
            width: 160,
            height: 28,
            title: `+ ${def.name}`,
            idleBgColor:
              def.sentiment === 'positive'
                ? Color.fromHex('#2a6e2a')
                : def.sentiment === 'negative'
                  ? Color.fromHex('#6e2a2a')
                  : Color.fromHex('#4a4a4a'),
            onClick: () => {
              this.gm.conditionManager.applyCondition(
                def.id as Parameters<
                  typeof this.gm.conditionManager.applyCondition
                >[0],
                this.tm.getTurnDataRef().turnNumber,
                { sourceType: 'system', sourceId: 'debug' }
              );
            },
          })
      )
    );

    if (this.testPopup) {
      this.testPopup.close();
      this.testPopup = undefined;
    }
    if (this.gameMenuPopup) {
      this.gameMenuPopup.close();
      this.gameMenuPopup = undefined;
    }

    const { drawWidth, drawHeight } = this.engine;
    const popup = new ScreenPopup({
      x: drawWidth / 2,
      y: drawHeight / 2,
      anchor: 'center',
      width: 520,
      height: 420,
      title: 'Debug Menu',
      z: UI_Z.modalPopup,
      backplateStyle: 'gray-full',
      closeOnBackplateClick: true,
      content: debugButtons,
      onClose: () => {
        this.testPopup = undefined;
      },
      contentBuilder: () => {},
    });
    this.testPopup = popup;
    this.addActor(popup);
  }

  private startDebugBattle(): void {
    if (this.testPopup && !this.testPopup.isKilled()) {
      this.testPopup.close();
      this.testPopup = undefined;
    }
    if (this.battleResultPopup && !this.battleResultPopup.isKilled()) {
      this.battleResultPopup.close();
      this.battleResultPopup = undefined;
      this.gm.militaryManager.clearLastBattleResult();
    }
    this.gm.militaryManager.startBattle({
      name: 'Debug Skirmish',
      player: { label: 'Player', morale: 68 },
      enemy: { label: 'Militia', morale: 52, units: { militia: 10 } },
      rewardMultiplier: 1,
    });
    this.showBattlePopup();
  }

  private showAngryPeasantsEvent(): void {
    if (this.testPopup && !this.testPopup.isKilled()) {
      this.testPopup.close();
      this.testPopup = undefined;
    }
    const foodDemand = 8;
    const totalFood = this.getTotalFoodStock();
    const canGiveFood = totalFood >= foodDemand;
    const canNegotiate =
      this.tm.getTurnDataRef().focus.current >= 1 &&
      this.rm.getResource('gold') >= 4;

    this.showRandomEventPopup({
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
            if (!this.spendFoodFromStores(foodDemand)) return;
            this.gm.logManager.addGood(
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
            resourceManager: this.rm,
            focusAvailable: this.tm.getTurnDataRef().focus.current,
          }),
          outcomeDescription: canNegotiate
            ? 'Send your steward to promise relief, record grievances, and quiet the square without bloodshed.'
            : 'Without coin and personal attention, no peaceful settlement can be arranged.',
          onSelect: () => {
            if (!this.tm.spendFocus(1)) return;
            if (!this.rm.spendResource('gold', 4)) return;
            this.gm.logManager.addGood(
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
              this.gm.militaryManager.clearLastBattleResult();
            }
            this.gm.militaryManager.startBattle({
              name: 'Angry Peasants',
              player: { label: 'Player', morale: 66 },
              enemy: {
                label: 'Peasants',
                morale: 44,
                units: { militia: 14 },
              },
              rewardMultiplier: 0.6,
            });
            this.gm.logManager.addBad(
              'The angry peasants were confronted by force.'
            );
            this.showBattlePopup();
          },
        },
      ],
    });
  }

  private showRandomEventPopup(
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
    const { drawWidth, drawHeight } = this.engine;
    const popup = new RandomEventPopup({
      ...config,
      x: drawWidth / 2,
      y: drawHeight / 2,
      anchor: 'center',
      tooltipProvider: this.tp,
      onClose: () => {
        this.randomEventPopup = undefined;
      },
    });
    this.randomEventPopup = popup;
    if (announceInLog) {
      this.gm.logManager.addNeutral(`Event: ${config.title}.`);
    }
    this.addActor(popup);
  }

  private showRandomEventResolutionPopup(resolution: {
    title: string;
    description: string;
  }): void {
    this.showRandomEventPopup(
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

  private buildRandomEventTooltipOutcomes(
    option: Pick<
      RandomEventOption,
      'resourceEffects' | 'focusDelta' | 'resourceRanges' | 'focusRange'
    >
  ) {
    const fixedEffects = buildTooltipEffectResourceSections({
      resourceEffects: option.resourceEffects,
      focusDelta: option.focusDelta,
      resourceManager: this.rm,
      focusAvailable: this.tm.getTurnDataRef().focus.current,
    });

    const coveredResources = new Set<string>([
      ...Object.keys(option.resourceEffects ?? {}),
      ...(option.focusDelta ? ['focus'] : []),
    ]);

    const rangeCosts: Array<{
      resourceType: TooltipResourceKey;
      amount: string;
    }> = [];
    const rangeGains: Array<{
      resourceType: TooltipResourceKey;
      amount: string;
    }> = [];

    const addRange = (
      resourceType: TooltipResourceKey,
      min: number,
      max: number
    ) => {
      if (coveredResources.has(resourceType)) return;
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

  private getTotalFoodStock(): number {
    let total = 0;
    for (const type of FOOD_RESOURCE_TYPES) {
      total += this.rm.getResource(type);
    }
    return total;
  }

  private spendFoodFromStores(amount: number): boolean {
    let remaining = amount;
    if (this.getTotalFoodStock() < amount) return false;
    for (const type of FOOD_RESOURCE_TYPES) {
      const available = this.rm.getResource(type);
      const spend = Math.min(available, remaining);
      if (spend > 0) {
        this.rm.spendResource(type, spend);
        remaining -= spend;
      }
      if (remaining <= 0) break;
    }
    return remaining <= 0;
  }
}
