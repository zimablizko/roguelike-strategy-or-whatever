import {
  Color,
  Font,
  FontUnit,
  Rectangle,
  ScreenElement,
  Sprite,
  Text,
  vec,
} from 'excalibur';
import type {
  BattleSideState,
  BattleState,
  BattleUnitState,
  PendingBattleAction,
  UnitRole,
} from '../../_common/models/military.models';
import type { BattlePopupOptions } from '../../_common/models/ui.models';
import { getIconSprite } from '../../_common/icons';
import { FONT_FAMILY } from '../../_common/text';
import {
  getBattleCommandDefinition,
  getBattleStatusDefinition,
  getUnitBattleCommands,
  getUnitDefinition,
} from '../../data/military';
import type { SeededRandom } from '../../_common/random';
import type { MilitaryManager } from '../../managers/MilitaryManager';
import {
  QUICK_BUILD_COLORS,
  QUICK_BUILD_LAYOUT,
} from '../constants/QuickBuildConstants';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup } from '../elements/ScreenPopup';
import type { TooltipProvider } from '../tooltip/TooltipProvider';

export class BattlePopup extends ScreenPopup {
  private static readonly WIDTH = 1140;
  private static readonly HEIGHT = 680;
  private static readonly LEFT_X = 20;
  private static readonly CENTER_X = 392;
  private static readonly RIGHT_X = 804;
  private static readonly TOP_Y = 80;
  private static readonly CARD_W = 300;
  private static readonly FIGHT_ANIMATION_MS = 1480;
  private static readonly EXCHANGE_DELAY_MS = 420;
  private static readonly BATTLE_FINISH_DELAY_MS = 700;
  private static readonly FLOATING_DELTA_MS = 760;

  private readonly militaryManager: MilitaryManager;
  private readonly tooltipProvider: TooltipProvider;
  private readonly rng: SeededRandom;
  private contentRootRef?: ScreenElement;
  private bodyRoot?: ScreenElement;
  private tooltipOwners: unknown[] = [];
  private cardRoots = new Map<string, ScreenElement>();
  private cardBasePositions = new Map<string, { x: number; y: number }>();
  private lastVersion = -1;
  private selectedMenuUnitId?: string;
  private fightAnimationMs = 0;
  private exchangeDelayMs = 0;
  private battleFinishDelayMs = 0;
  private pendingFightResolve = false;
  private resolveQueuedRound = false;
  private animatedAction?: PendingBattleAction;
  private floatingLosses: Array<{
    id: number;
    battleUnitId: string;
    amount: number;
    remainingMs: number;
  }> = [];
  private floatingLossRoots = new Map<number, ScreenElement>();
  private floatingLossSerial = 0;

  constructor(options: BattlePopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: BattlePopup.WIDTH,
      height: BattlePopup.HEIGHT,
      title: 'Battle',
      z: UI_Z.statePopup + 2,
      backplateStyle: 'gray',
      closeOnBackplateClick: false,
      showCloseButton: false,
      bgColor: Color.fromHex('#171c24'),
      headerColor: Color.fromHex('#3a1b1b'),
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.contentRootRef = contentRoot;
        this.renderBody();
      },
    });

    this.militaryManager = options.militaryManager;
    this.tooltipProvider = options.tooltipProvider;
    this.rng = options.rng;
  }

  onPreUpdate(_engine: unknown, elapsedMs: number = 16): void {
    super.onPreUpdate();
    if (!this.militaryManager.getActiveBattle()) {
      this.close();
      return;
    }

    if (this.fightAnimationMs > 0) {
      this.fightAnimationMs = Math.max(0, this.fightAnimationMs - elapsedMs);
      this.updateFightAnimation();
      if (this.fightAnimationMs === 0) {
        if (this.pendingFightResolve) {
          const battleBefore = this.militaryManager.getActiveBattle();
          const quantitiesBefore = battleBefore
            ? this.captureBattleUnitQuantities(battleBefore)
            : new Map<string, number>();
          this.pendingFightResolve = false;
          this.militaryManager.commitPreparedBattleAction();
          const battle = this.militaryManager.getActiveBattle();
          if (battle && battle.phase === 'battle') {
            this.registerFloatingLosses(quantitiesBefore, battle);
          }
          if (battle?.pendingWinner) {
            this.animatedAction = undefined;
            this.battleFinishDelayMs = BattlePopup.BATTLE_FINISH_DELAY_MS;
            this.exchangeDelayMs = 0;
            this.resolveQueuedRound = false;
            this.renderBody();
            return;
          }
          if (
            this.resolveQueuedRound &&
            battle &&
            battle.phase === 'battle' &&
            battle.attackQueue.length > 0
          ) {
            this.animatedAction = undefined;
            this.exchangeDelayMs = BattlePopup.EXCHANGE_DELAY_MS;
            this.renderBody();
            return;
          }
          this.exchangeDelayMs = 0;
          this.resolveQueuedRound = false;
          this.animatedAction = undefined;
        }
        if (this.militaryManager.getActiveBattle()) {
          this.renderBody();
        }
        return;
      }
    }

    if (this.battleFinishDelayMs > 0) {
      this.battleFinishDelayMs = Math.max(0, this.battleFinishDelayMs - elapsedMs);
      if (this.battleFinishDelayMs === 0) {
        this.militaryManager.finalizePendingBattle();
        return;
      }
    }

    if (this.exchangeDelayMs > 0) {
      this.exchangeDelayMs = Math.max(0, this.exchangeDelayMs - elapsedMs);
      if (this.exchangeDelayMs === 0) {
        if (this.startQueuedExchange()) {
          return;
        }
        this.resolveQueuedRound = false;
        this.animatedAction = undefined;
        if (this.militaryManager.getActiveBattle()) {
          this.renderBody();
        }
      }
    }

    if (this.floatingLosses.length > 0) {
      const beforeCount = this.floatingLosses.length;
      this.floatingLosses = this.floatingLosses
        .map((loss) => ({
          ...loss,
          remainingMs: Math.max(0, loss.remainingMs - elapsedMs),
        }))
        .filter((loss) => loss.remainingMs > 0);
      this.updateFloatingLossAnimations();
      if (this.floatingLosses.length !== beforeCount && this.militaryManager.getActiveBattle()) {
        this.renderBody();
        return;
      }
    }

    const version = this.militaryManager.getMilitaryVersion();
    if (version !== this.lastVersion && !this.pendingFightResolve && this.exchangeDelayMs <= 0) {
      this.lastVersion = version;
      this.renderBody();
    }
  }

  private renderBody(): void {
    const contentRoot = this.contentRootRef;
    const battle = this.militaryManager.getActiveBattle();
    if (!contentRoot || !battle) return;

    this.clearTransientUi();

    const body = new ScreenElement({ x: 0, y: 0 });
    contentRoot.addChild(body);
    this.bodyRoot = body;

    body.addChild(this.createText(0, 0, battle.name, 24, Color.fromHex('#f5ead7')));
    body.addChild(
      this.createText(
        360,
        4,
        battle.phase === 'preparation'
          ? `Preparation • ${battle.player.units.length}/${battle.player.maxGroups} groups`
          : battle.roundNumber > 0
            ? `Round ${battle.roundNumber} • ${battle.attackQueue.length + (battle.pendingAction ? 1 : 0)} actions queued`
            : 'Battle ready • waiting for first round',
        18,
        Color.fromHex('#ffd27a')
      )
    );

    if (battle.phase === 'preparation') {
      this.renderPreparation(body, battle);
      return;
    }

    this.renderBattle(body, battle);
    this.updateFightAnimation();
    this.updateFloatingLossAnimations();
  }

  private renderPreparation(root: ScreenElement, battle: BattleState): void {
    root.addChild(this.createSectionHeader(BattlePopup.LEFT_X, 42, 'Reserve Pool'));
    root.addChild(this.createSectionHeader(BattlePopup.CENTER_X, 42, 'Player Groups'));
    root.addChild(this.createSectionHeader(BattlePopup.RIGHT_X, 42, 'Enemy Groups'));

    let reserveY = BattlePopup.TOP_Y;
    for (const [unitId, count] of Object.entries(battle.player.reserveUnits) as [
      UnitRole,
      number | undefined,
    ][]) {
      const amount = count ?? 0;
      if (amount <= 0) continue;
      root.addChild(this.createReserveRow(BattlePopup.LEFT_X, reserveY, unitId, amount));
      reserveY += 52;
    }
    if (reserveY === BattlePopup.TOP_Y) {
      root.addChild(
        this.createText(
          BattlePopup.LEFT_X,
          reserveY,
          'No units left in reserve.',
          14,
          Color.fromHex('#b7c4d3')
        )
      );
    }

    let groupY = BattlePopup.TOP_Y;
    for (const unit of battle.player.units) {
      const card = this.createPreparationGroupCard(BattlePopup.CENTER_X, groupY, unit);
      root.addChild(card);
      groupY += 114;
    }

    let enemyY = BattlePopup.TOP_Y;
    for (const unit of battle.enemy.units) {
      root.addChild(this.createEnemyPreviewCard(BattlePopup.RIGHT_X, enemyY, unit));
      enemyY += 102;
    }

    const startButton = new ScreenButton({
      x: 466,
      y: 548,
      width: 180,
      height: 54,
      title: 'Begin Battle',
      idleBgColor: Color.fromHex('#bb5a21'),
      hoverBgColor: Color.fromHex('#d2722e'),
      clickedBgColor: Color.fromHex('#934717'),
      onClick: () => {
        if (this.isFightAnimating()) return;
        if (this.militaryManager.startPreparedBattle()) {
          this.selectedMenuUnitId = undefined;
          this.renderBody();
        }
      },
    });
    if (battle.player.units.length === 0) {
      startButton.toggle(false);
    }
    root.addChild(startButton);
  }

  private renderBattle(root: ScreenElement, battle: BattleState): void {
    root.addChild(this.createMoraleHeader(BattlePopup.LEFT_X, 42, battle.player));
    root.addChild(this.createMoraleHeader(BattlePopup.RIGHT_X, 42, battle.enemy));
    root.addChild(this.createCenterPanel(BattlePopup.CENTER_X, 84, battle));

    this.renderBattleSide(root, battle.player, BattlePopup.LEFT_X, true);
    this.renderBattleSide(root, battle.enemy, BattlePopup.RIGHT_X, false);
    this.renderFloatingLosses(root);

    const fightButton = new ScreenButton({
      x: 466,
      y: 562,
      width: 180,
      height: 54,
      title: this.isFightAnimating() ? 'Resolving...' : 'Fight',
      idleBgColor: Color.fromHex('#bb5a21'),
      hoverBgColor: Color.fromHex('#d2722e'),
      clickedBgColor: Color.fromHex('#934717'),
      onClick: () => {
        if (this.isFightAnimating()) return;
        const actionPreview = this.militaryManager.prepareNextBattleAction(this.rng);
        if (!actionPreview) return;
        this.selectedMenuUnitId = undefined;
        this.resolveQueuedRound = true;
        this.animatedAction = actionPreview;
        this.pendingFightResolve = true;
        this.fightAnimationMs = BattlePopup.FIGHT_ANIMATION_MS;
        this.renderBody();
      },
    });
    if (this.isFightAnimating()) {
      fightButton.toggle(false);
    }
    root.addChild(fightButton);
  }

  private renderBattleSide(
    root: ScreenElement,
    side: BattleSideState,
    x: number,
    playerSide: boolean
  ): void {
    let y = BattlePopup.TOP_Y;
    for (const unit of side.units) {
      const card = this.createBattleGroupCard(x, y, unit, playerSide);
      root.addChild(card);
      this.cardRoots.set(unit.battleUnitId, card);
      this.cardBasePositions.set(unit.battleUnitId, { x, y });
      y += this.getBattleCardHeight(unit, playerSide) + 14;
    }
  }

  private createReserveRow(
    x: number,
    y: number,
    unitId: UnitRole,
    amount: number
  ): ScreenElement {
    const row = new ScreenElement({ x, y });
    row.graphics.use(
      new Rectangle({
        width: BattlePopup.CARD_W,
        height: 42,
        color: Color.fromHex('#222a35'),
      })
    );

    const def = getUnitDefinition(unitId);
    row.addChild(
      this.createText(
        12,
        10,
        `${def?.name ?? unitId}: ${amount}`,
        15,
        Color.fromHex('#dce6ef')
      )
    );

    const addButton = new ScreenButton({
      x: 184,
      y: 6,
      width: 104,
      height: 28,
      title: 'Add Group',
      idleBgColor: Color.fromHex('#4c617c'),
      onClick: () => {
        this.militaryManager.createBattleGroup(unitId);
        this.renderBody();
      },
    });
    row.addChild(addButton);
    return row;
  }

  private createPreparationGroupCard(
    x: number,
    y: number,
    unit: BattleUnitState
  ): ScreenElement {
    const card = new ScreenElement({ x, y });
    card.graphics.use(
      new Rectangle({
        width: BattlePopup.CARD_W,
        height: 100,
        color: Color.fromHex('#29313c'),
      })
    );

    const def = getUnitDefinition(unit.unitId);
    const quantity = def ? Math.max(0, Math.ceil(unit.remainingHealth / def.health)) : 0;
    card.addChild(this.createQuantityBadge(12, 10, quantity));
    card.addChild(this.createText(62, 10, def?.name ?? unit.unitId, 18, Color.fromHex('#f4e7d0')));
    card.addChild(
      this.createText(12, 36, `Group size: ${quantity}`, 14, Color.fromHex('#d3dbe4'))
    );
    card.addChild(
      this.createText(12, 58, `Power ${def?.power ?? 0}  Health ${def?.health ?? 0}`, 13, Color.fromHex('#b8c6d6'))
    );

    const minusBtn = new ScreenButton({
      x: 150,
      y: 58,
      width: 34,
      height: 28,
      title: '-',
      onClick: () => {
        this.militaryManager.adjustBattleGroupSize(unit.battleUnitId, -1);
        this.renderBody();
      },
    });
    const plusBtn = new ScreenButton({
      x: 190,
      y: 58,
      width: 34,
      height: 28,
      title: '+',
      onClick: () => {
        this.militaryManager.adjustBattleGroupSize(unit.battleUnitId, 1);
        this.renderBody();
      },
    });
    const removeBtn = new ScreenButton({
      x: 230,
      y: 58,
      width: 58,
      height: 28,
      title: 'Remove',
      idleBgColor: Color.fromHex('#6b4040'),
      onClick: () => {
        this.militaryManager.removeBattleGroup(unit.battleUnitId);
        this.renderBody();
      },
    });
    card.addChild(minusBtn);
    card.addChild(plusBtn);
    card.addChild(removeBtn);
    return card;
  }

  private createEnemyPreviewCard(
    x: number,
    y: number,
    unit: BattleUnitState
  ): ScreenElement {
    const card = new ScreenElement({ x, y });
    card.graphics.use(
      new Rectangle({
        width: BattlePopup.CARD_W,
        height: 88,
        color: Color.fromHex('#29313c'),
      })
    );
    const def = getUnitDefinition(unit.unitId);
    const quantity = def ? Math.max(0, Math.ceil(unit.remainingHealth / def.health)) : 0;
    card.addChild(this.createQuantityBadge(12, 10, quantity));
    card.addChild(this.createText(62, 10, def?.name ?? unit.unitId, 18, Color.fromHex('#f4e7d0')));
    card.addChild(
      this.createText(12, 38, `Group size: ${quantity}`, 14, Color.fromHex('#d3dbe4'))
    );
    card.addChild(
      this.createText(12, 58, `Power ${def?.power ?? 0}  Health ${def?.health ?? 0}`, 13, Color.fromHex('#b8c6d6'))
    );
    return card;
  }

  private createBattleGroupCard(
    x: number,
    y: number,
    unit: BattleUnitState,
    playerSide: boolean
  ): ScreenElement {
    const currentAction = this.animatedAction ?? this.militaryManager.getActiveBattle()?.pendingAction;
    const isAttacking = currentAction?.attackerUnitId === unit.battleUnitId;
    const isDefending = currentAction?.defenderUnitId === unit.battleUnitId;
    const card = new ScreenElement({ x, y });
    card.graphics.use(
      new Rectangle({
        width: BattlePopup.CARD_W,
        height: this.getBattleCardHeight(unit, playerSide),
        color: isAttacking
          ? Color.fromHex('#3e3023')
          : isDefending
            ? Color.fromHex('#36262f')
            : Color.fromHex('#29313c'),
      })
    );
    if (isAttacking || isDefending) {
      card.addChild(
        this.createSolidPanel(
          0,
          0,
          BattlePopup.CARD_W,
          4,
          isAttacking ? Color.fromHex('#d57a2c') : Color.fromHex('#d15a5a')
        )
      );
      card.addChild(
        this.createRoleBadge(
          176,
          10,
          isAttacking ? 'ATTACKING' : 'DEFENDING',
          isAttacking ? Color.fromHex('#8b4c17') : Color.fromHex('#7a2d36')
        )
      );
    }

    const def = getUnitDefinition(unit.unitId);
    const quantity = def ? Math.max(0, Math.ceil(unit.remainingHealth / def.health)) : 0;
    const selectedCommand = unit.selectedCommandId
      ? getBattleCommandDefinition(unit.selectedCommandId)
      : undefined;
    card.addChild(this.createQuantityBadge(12, 10, quantity));
    card.addChild(this.createText(62, 10, def?.name ?? unit.unitId, 18, Color.fromHex('#f4e7d0')));
    card.addChild(
      this.createText(12, 36, `Power ${def?.power ?? 0}  Health ${def?.health ?? 0}`, 14, Color.fromHex('#d3dbe4'))
    );
    card.addChild(
      this.createText(12, 60, `Order: ${selectedCommand?.name ?? 'None'}`, 13, playerSide ? Color.fromHex('#f0c77d') : Color.fromHex('#9fb3c8'))
    );

    let statusX = 214;
    for (const status of unit.activeStatuses) {
      const icon = this.createStatusIcon(statusX, 12, status.statusId);
      card.addChild(icon);
      statusX += 24;
    }

    if (playerSide) {
      const orderButton = new ScreenButton({
        x: 206,
        y: 48,
        width: 82,
        height: 32,
        title: 'Orders',
        idleBgColor: Color.fromHex('#536b8b'),
        onClick: () => {
          this.selectedMenuUnitId =
            this.selectedMenuUnitId === unit.battleUnitId
              ? undefined
              : unit.battleUnitId;
          this.renderBody();
        },
      });
      if (this.isFightAnimating()) {
        orderButton.toggle(false);
      }
      card.addChild(orderButton);
      if (this.selectedMenuUnitId === unit.battleUnitId) {
        this.renderCommandMenu(card, unit);
      }
    }

    return card;
  }

  private renderCommandMenu(card: ScreenElement, unit: BattleUnitState): void {
    const commands = getUnitBattleCommands(unit.unitId);
    const panelY = 108;
    const rowHeight = QUICK_BUILD_LAYOUT.rowHeight;
    const rowGap = QUICK_BUILD_LAYOUT.rowGap;
    const padding = QUICK_BUILD_LAYOUT.panelPadding;
    const headerHeight = QUICK_BUILD_LAYOUT.headerHeight;
    const panelHeight =
      padding * 2 +
      headerHeight +
      (commands.length + 1) * rowHeight +
      commands.length * rowGap;

    const panel = new ScreenElement({ x: 8, y: panelY });
    panel.graphics.use(
      new Rectangle({
        width: BattlePopup.CARD_W - 16,
        height: panelHeight,
        color: QUICK_BUILD_COLORS.panelBackground,
      })
    );
    card.addChild(panel);
    panel.addChild(
      this.createText(padding, padding, 'Unit Orders', 13, QUICK_BUILD_COLORS.headerText)
    );

    let y = padding + headerHeight;
    const clearButton = new ScreenButton({
      x: padding,
      y,
      width: BattlePopup.CARD_W - 16 - padding * 2,
      height: rowHeight,
      title: 'Clear',
      idleBgColor: Color.fromHex('#5a4444'),
      onClick: () => {
        this.militaryManager.issueBattleCommand(unit.battleUnitId, undefined);
        this.selectedMenuUnitId = undefined;
        this.renderBody();
      },
    });
    panel.addChild(clearButton);
    this.bindCommandTooltip(
      clearButton,
      'Clear Orders',
      'Remove the current indirect order and let the group fight normally.'
    );
    y += rowHeight + rowGap;

    for (const command of commands) {
      const btn = new ScreenButton({
        x: padding,
        y,
        width: BattlePopup.CARD_W - 16 - padding * 2,
        height: rowHeight,
        title: command.name,
        idleBgColor: Color.fromHex('#5a6780'),
        hoverBgColor: Color.fromHex('#6d7e9d'),
        clickedBgColor: Color.fromHex('#49566b'),
        onClick: () => {
          this.militaryManager.issueBattleCommand(unit.battleUnitId, command.id);
          this.selectedMenuUnitId = undefined;
          this.renderBody();
        },
      });
      panel.addChild(btn);
      this.bindCommandTooltip(btn, command.name, command.description);
      y += rowHeight + rowGap;
    }
  }

  private bindCommandTooltip(
    button: ScreenButton,
    header: string,
    description: string
  ): void {
    if (this.isFightAnimating()) {
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
        header,
        description,
        width: 250,
        placement: 'right',
      });
    });
    button.on('pointerleave', () => this.tooltipProvider.hide(button));
    button.on('prekill', () => this.tooltipProvider.hide(button));
    this.tooltipOwners.push(button);
  }

  private createCenterPanel(
    x: number,
    y: number,
    battle: BattleState
  ): ScreenElement {
    const panel = new ScreenElement({ x, y });
    panel.graphics.use(
      new Rectangle({
        width: 312,
        height: 440,
        color: Color.fromHex('#212733'),
      })
    );
    panel.addChild(this.createText(14, 12, 'Clash Lane', 18, Color.fromHex('#f5ead7')));

    const action = this.animatedAction ?? battle.pendingAction;
    if (action) {
      panel.addChild(this.createText(14, 48, 'Attacker', 12, Color.fromHex('#f0c77d')));
      panel.addChild(
        this.createWrappedText(
          14,
          64,
          action.attackerLabel,
          280,
          17,
          Color.fromHex('#f5ead7')
        )
      );
      panel.addChild(this.createText(14, 104, 'Defender', 12, Color.fromHex('#e38b8b')));
      panel.addChild(
        this.createWrappedText(
          14,
          120,
          action.defenderLabel,
          280,
          17,
          Color.fromHex('#f5ead7')
        )
      );
      panel.addChild(
        this.createWrappedText(
          14,
          160,
          action.attackType === 'ranged'
            ? 'Ranged strike lands first. No melee return damage.'
            : 'Melee clash. Defender can strike back.',
          280,
          13,
          Color.fromHex('#ffd27a')
        )
      );
    } else {
      panel.addChild(
        this.createWrappedText(
          14,
          52,
          'Groups attack one after another. The side with higher morale opens each round.',
          280,
          15,
          Color.fromHex('#c3cfdb')
        )
      );
    }

    panel.addChild(this.createText(14, 208, 'Battle Log', 15, Color.fromHex('#f0c77d')));

    let lineY = 238;
    const logLines = battle.battleLog.slice(-9);
    for (const line of logLines) {
      const wrapped = this.wrapTextLines(line, 280, 12).slice(0, 3);
      panel.addChild(this.createText(14, lineY, wrapped.join('\n'), 12, Color.fromHex('#c3cfdb')));
      lineY += wrapped.length * 16 + 6;
      if (lineY > 406) {
        break;
      }
    }

    return panel;
  }

  private createStatusIcon(
    x: number,
    y: number,
    statusId: BattleUnitState['activeStatuses'][number]['statusId']
  ): ScreenElement {
    const icon = new ScreenElement({ x, y });
    const sprite: Sprite = getIconSprite('dummy', 18);
    icon.graphics.use(sprite);
    const status = getBattleStatusDefinition(statusId);
    icon.on('pointerenter', () => {
      this.tooltipProvider.show({
        owner: icon,
        getAnchorRect: () => ({
          x: icon.globalPos.x,
          y: icon.globalPos.y,
          width: 18,
          height: 18,
        }),
        header: status?.name ?? statusId,
        description: status?.description ?? statusId,
        width: 220,
      });
    });
    icon.on('pointerleave', () => this.tooltipProvider.hide(icon));
    icon.on('prekill', () => this.tooltipProvider.hide(icon));
    this.tooltipOwners.push(icon);
    return icon;
  }

  private createSectionHeader(x: number, y: number, text: string): ScreenElement {
    const header = new ScreenElement({ x, y });
    header.graphics.use(
      new Rectangle({
        width: BattlePopup.CARD_W,
        height: 30,
        color: Color.fromHex('#222a35'),
      })
    );
    header.addChild(this.createText(12, 7, text, 16, Color.fromHex('#e4edf6')));
    return header;
  }

  private createMoraleHeader(x: number, y: number, side: BattleSideState): ScreenElement {
    return this.createSectionHeader(
      x,
      y,
      `${side.label}: ${this.getMoraleLabel(side.morale)} (${side.morale})`
    );
  }

  private createText(
    x: number,
    y: number,
    text: string,
    size: number,
    color: Color
  ): ScreenElement {
    const el = new ScreenElement({ x, y });
    el.graphics.use(
      new Text({
        text,
        font: new Font({ size, unit: FontUnit.Px, color, family: FONT_FAMILY }),
      })
    );
    return el;
  }

  private createWrappedText(
    x: number,
    y: number,
    text: string,
    maxWidth: number,
    size: number,
    color: Color
  ): ScreenElement {
    return this.createText(x, y, this.wrapTextLines(text, maxWidth, size).slice(0, 3).join('\n'), size, color);
  }

  private createSolidPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color
  ): ScreenElement {
    const panel = new ScreenElement({ x, y });
    panel.graphics.use(
      new Rectangle({
        width,
        height,
        color,
      })
    );
    return panel;
  }

  private createQuantityBadge(x: number, y: number, quantity: number): ScreenElement {
    const badge = new ScreenElement({ x, y });
    badge.graphics.use(
      new Rectangle({
        width: 40,
        height: 22,
        color: Color.fromHex('#46566c'),
      })
    );
    badge.addChild(this.createText(9, 4, `x${quantity}`, 12, Color.fromHex('#f8efe2')));
    return badge;
  }

  private createRoleBadge(
    x: number,
    y: number,
    label: string,
    bgColor: Color
  ): ScreenElement {
    const badge = new ScreenElement({ x, y });
    badge.graphics.use(
      new Rectangle({
        width: 112,
        height: 20,
        color: bgColor,
      })
    );
    badge.addChild(this.createText(8, 4, label, 11, Color.fromHex('#f8efe2')));
    return badge;
  }

  private wrapTextLines(text: string, maxWidth: number, size: number): string[] {
    const roughChars = Math.max(12, Math.floor(maxWidth / (size * 0.58)));
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > roughChars && current) {
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

  private renderFloatingLosses(root: ScreenElement): void {
    for (const loss of this.floatingLosses) {
      const label = this.createText(0, 0, `-${loss.amount}`, 16, Color.fromHex('#ff6f6f'));
      root.addChild(label);
      this.floatingLossRoots.set(loss.id, label);
    }
  }

  private clearTransientUi(): void {
    for (const owner of this.tooltipOwners) {
      this.tooltipProvider.hide(owner);
    }
    this.tooltipOwners = [];
    this.cardRoots.clear();
    this.cardBasePositions.clear();
    this.floatingLossRoots.clear();

    if (this.bodyRoot && !this.bodyRoot.isKilled()) {
      this.bodyRoot.kill();
    }
  }

  private getMoraleLabel(value: number): string {
    if (value < 20) return 'Awful';
    if (value < 40) return 'Poor';
    if (value < 60) return 'Steady';
    if (value < 80) return 'Good';
    return 'Excellent';
  }

  private getBattleCardHeight(unit: BattleUnitState, playerSide: boolean): number {
    if (!playerSide || this.selectedMenuUnitId !== unit.battleUnitId) {
      return 104;
    }
    const commandCount = getUnitBattleCommands(unit.unitId).length;
    const menuHeight =
      QUICK_BUILD_LAYOUT.panelPadding * 2 +
      QUICK_BUILD_LAYOUT.headerHeight +
      (commandCount + 1) * QUICK_BUILD_LAYOUT.rowHeight +
      commandCount * QUICK_BUILD_LAYOUT.rowGap;
    return 108 + menuHeight + 8;
  }

  private captureBattleUnitQuantities(battle: BattleState): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const side of [battle.player, battle.enemy]) {
      for (const unit of side.units) {
        quantities.set(unit.battleUnitId, this.getUnitQuantity(unit));
      }
    }
    return quantities;
  }

  private registerFloatingLosses(
    beforeQuantities: Map<string, number>,
    battle: BattleState
  ): void {
    for (const side of [battle.player, battle.enemy]) {
      for (const unit of side.units) {
        const before = beforeQuantities.get(unit.battleUnitId) ?? this.getUnitQuantity(unit);
        const after = this.getUnitQuantity(unit);
        const lost = before - after;
        if (lost <= 0) continue;
        this.floatingLosses.push({
          id: ++this.floatingLossSerial,
          battleUnitId: unit.battleUnitId,
          amount: lost,
          remainingMs: BattlePopup.FLOATING_DELTA_MS,
        });
      }
    }
  }

  private startQueuedExchange(): boolean {
    const battle = this.militaryManager.getActiveBattle();
    if (
      !this.resolveQueuedRound ||
      !battle ||
      battle.phase !== 'battle' ||
      battle.attackQueue.length === 0
    ) {
      return false;
    }

    const nextAction = this.militaryManager.prepareNextBattleAction(this.rng);
    if (!nextAction) {
      return false;
    }

    this.animatedAction = nextAction;
    this.pendingFightResolve = true;
    this.exchangeDelayMs = 0;
    this.fightAnimationMs = BattlePopup.FIGHT_ANIMATION_MS;
    this.renderBody();
    return true;
  }

  private updateFloatingLossAnimations(): void {
    for (const loss of this.floatingLosses) {
      const label = this.floatingLossRoots.get(loss.id);
      if (!label) continue;
      const card = this.cardRoots.get(loss.battleUnitId);
      const base = this.cardBasePositions.get(loss.battleUnitId);
      if (!base) continue;
      const stackIndex = this.getFloatingLossStackIndex(loss);
      const anchor = card?.pos ?? vec(base.x, base.y);
      const progress = 1 - loss.remainingMs / BattlePopup.FLOATING_DELTA_MS;
      const lift = 10 + progress * 30;
      label.pos = vec(anchor.x + 12 + stackIndex * 34, anchor.y - lift - stackIndex * 6);
    }
  }

  private getFloatingLossStackIndex(
    activeLoss: (typeof this.floatingLosses)[number]
  ): number {
    let index = 0;
    for (const loss of this.floatingLosses) {
      if (loss.id === activeLoss.id) {
        return index;
      }
      if (loss.battleUnitId === activeLoss.battleUnitId) {
        index++;
      }
    }
    return index;
  }

  private getUnitQuantity(unit: BattleUnitState): number {
    const def = getUnitDefinition(unit.unitId);
    if (!def || unit.remainingHealth <= 0) {
      return 0;
    }
    return Math.max(0, Math.ceil(unit.remainingHealth / def.health));
  }

  private updateFightAnimation(): void {
    for (const [unitId, card] of this.cardRoots) {
      const base = this.cardBasePositions.get(unitId);
      if (!base) continue;
      card.pos = vec(base.x, base.y);
    }

    if (!this.animatedAction || this.fightAnimationMs <= 0) {
      return;
    }

    const attackerCard = this.cardRoots.get(this.animatedAction.attackerUnitId);
    const defenderCard = this.cardRoots.get(this.animatedAction.defenderUnitId);
    const attackerBase = this.cardBasePositions.get(this.animatedAction.attackerUnitId);
    const defenderBase = this.cardBasePositions.get(this.animatedAction.defenderUnitId);
    if (!attackerCard || !defenderCard || !attackerBase || !defenderBase) {
      return;
    }

    const progress = 1 - this.fightAnimationMs / BattlePopup.FIGHT_ANIMATION_MS;
    const attackEnd = 0.34;
    const holdEnd = 0.54;
    const maxOffset = 56;
    let forward = 0;
    let dip = 0;

    if (progress < attackEnd) {
      const t = progress / attackEnd;
      forward = maxOffset * t * t * t;
      dip = 3 * t * t;
    } else if (progress < holdEnd) {
      const t = (progress - attackEnd) / (holdEnd - attackEnd);
      forward = maxOffset + 3 * Math.sin(t * Math.PI);
      dip = 3 + 2 * Math.sin(t * Math.PI);
    } else {
      const t = (progress - holdEnd) / (1 - holdEnd);
      const settle = 1 - (1 - t) * (1 - t) * (1 - t);
      forward = maxOffset * (1 - settle);
      dip = 5 * (1 - t) * (1 - t);
    }

    const attackerDirection = this.animatedAction.attackerSide === 'player' ? 1 : -1;
    const defenderDirection = -attackerDirection;
    attackerCard.pos = vec(
      attackerBase.x + forward * attackerDirection,
      attackerBase.y + dip
    );
    defenderCard.pos = vec(
      defenderBase.x + forward * 0.52 * defenderDirection,
      defenderBase.y + dip * 0.75
    );
  }

  private isFightAnimating(): boolean {
    return (
      this.fightAnimationMs > 0 ||
      this.pendingFightResolve ||
      this.exchangeDelayMs > 0 ||
      this.battleFinishDelayMs > 0
    );
  }
}
