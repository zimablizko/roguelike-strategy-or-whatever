import {
  Color,
  Engine,
  Font,
  Keys,
  Label,
  Rectangle,
  Scene,
  ScreenElement,
  TextAlign,
  vec,
} from 'excalibur';
import type { GameSetupData } from '../_common/models/game-setup.models';
import type { RulerTraitDefinition } from '../_common/models/ruler-traits.models';
import type {
  SaveSlotId,
  SaveSlotSummary,
} from '../_common/models/save.models';
import { SeededRandom } from '../_common/random';
import { FONT_FAMILY, wrapText } from '../_common/text';
import {
  createDefaultGameSetup,
  generateRulerName,
  generateStateName,
  getMapSizeDefinition,
  getStatePrehistoryDefinition,
  mapSizeOrder,
  statePrehistoryOrder,
} from '../data/gameSetup';
import {
  BASE_POSITIVE_RULER_TRAIT_LIMIT,
  countRulerTraitsByPolarity,
  getPositiveRulerTraitSelectionLimit,
  getRulerTraitDefinition,
  getRulerTraitsByPolarity,
  MAX_NEGATIVE_RULER_TRAITS,
} from '../data/traits';
import { SaveManager } from '../managers/SaveManager';
import { TurnManager } from '../managers/TurnManager';
import { ScreenButton } from '../ui/elements/ScreenButton';
import { ScreenList } from '../ui/elements/ScreenList';
import { TooltipProvider } from '../ui/tooltip/TooltipProvider';

export class InitializationScene extends Scene {
  private selectedSlot: SaveSlotId = 1;
  private readonly setupRng = new SeededRandom();
  private setup: GameSetupData = createDefaultGameSetup(this.setupRng);
  private tooltipProvider?: TooltipProvider;

  onInitialize(engine: Engine): void {
    this.backgroundColor = Color.fromHex('#0d1620');
    this.render(engine);
  }

  onActivate(): void {
    this.render(this.engine);
  }

  onPreUpdate(engine: Engine): void {
    if (engine.input.keyboard.wasPressed(Keys.Escape)) {
      engine.goToScene('main-menu');
    }

    if (engine.input.keyboard.wasPressed(Keys.Enter)) {
      const summaries = SaveManager.getSlotSummaries();
      const selected = summaries.find((s) => s.slot === this.selectedSlot);
      if (selected?.used) {
        SaveManager.queueContinue(this.selectedSlot);
      } else {
        SaveManager.queueNewGame(this.selectedSlot, { ...this.setup });
      }
      engine.goToScene('gameplay');
    }

    if (engine.input.keyboard.wasPressed(Keys.Delete)) {
      const deleted = SaveManager.deleteSlot(this.selectedSlot);
      if (deleted) {
        this.render(engine);
      }
    }

    if (engine.input.keyboard.wasPressed(Keys.Digit1)) {
      this.selectedSlot = 1;
      this.render(engine);
    }
    if (engine.input.keyboard.wasPressed(Keys.Digit2)) {
      this.selectedSlot = 2;
      this.render(engine);
    }
    if (engine.input.keyboard.wasPressed(Keys.Digit3)) {
      this.selectedSlot = 3;
      this.render(engine);
    }
  }

  private render(engine: Engine): void {
    this.clear();

    const summaries = SaveManager.getSlotSummaries();
    this.syncSelectedSlot(summaries);
    const selectedSummary = summaries.find(
      (summary) => summary.slot === this.selectedSlot
    );
    const settingsLocked = selectedSummary?.used ?? false;

    this.addBackdrop(engine);
    this.addTooltipProvider();
    this.addHeader(engine);
    this.addSaveSlots(engine, summaries, selectedSummary);
    this.addSetupColumns(engine, settingsLocked);
    this.addFooter(engine, selectedSummary);
  }

  private addTooltipProvider(): void {
    this.tooltipProvider = new TooltipProvider();
    this.add(this.tooltipProvider);
  }

  private addBackdrop(engine: Engine): void {
    const topGlow = new ScreenElement({ x: 0, y: 0 });
    topGlow.anchor = vec(0, 0);
    topGlow.graphics.use(
      new Rectangle({
        width: engine.drawWidth,
        height: 128,
        color: Color.fromHex('#142536'),
      })
    );
    this.add(topGlow);

    const body = new ScreenElement({ x: 0, y: 128 });
    body.anchor = vec(0, 0);
    body.graphics.use(
      new Rectangle({
        width: engine.drawWidth,
        height: engine.drawHeight - 128,
        color: Color.fromHex('#101b27'),
      })
    );
    this.add(body);
  }

  private addHeader(engine: Engine): void {
    const title = new Label({
      text: 'New Campaign Preparation',
      x: engine.drawWidth / 2,
      y: 24,
      font: new Font({
        size: 30,
        color: Color.fromHex('#f0e6d2'),
        textAlign: TextAlign.Center,
        family: FONT_FAMILY,
      }),
    });
    this.add(title);

    const subtitle = new Label({
      text: 'Choose an empty save slot to begin a new realm, or select an occupied slot to continue.',
      x: engine.drawWidth / 2,
      y: 60,
      font: new Font({
        size: 16,
        color: Color.fromHex('#aebed0'),
        textAlign: TextAlign.Center,
        family: FONT_FAMILY,
      }),
    });
    this.add(subtitle);
  }

  private addSaveSlots(
    engine: Engine,
    summaries: SaveSlotSummary[],
    selectedSummary?: SaveSlotSummary
  ): void {
    const buttonWidth = 220;
    const buttonGap = 18;
    const totalWidth = buttonWidth * summaries.length + buttonGap * 2;
    const startX = (engine.drawWidth - totalWidth) / 2;
    const y = 96;

    for (const [index, summary] of summaries.entries()) {
      const selected = summary.slot === this.selectedSlot;
      const button = new ScreenButton({
        x: startX + index * (buttonWidth + buttonGap),
        y,
        width: buttonWidth,
        height: 52,
        title: this.buildSlotButtonTitle(summary),
        idleBgColor: selected
          ? Color.fromHex('#8f4b25')
          : Color.fromHex('#294052'),
        hoverBgColor: selected
          ? Color.fromHex('#a3582e')
          : Color.fromHex('#35556d'),
        clickedBgColor: selected
          ? Color.fromHex('#743a1c')
          : Color.fromHex('#223748'),
        onClick: () => {
          this.selectedSlot = summary.slot;
          this.render(engine);
        },
      });
      this.add(button);
    }

    const statusText = this.buildSelectedSlotStatus(selectedSummary);
    const statusLabel = new Label({
      text: wrapText(statusText, 940, 15).join('\n'),
      x: engine.drawWidth / 2,
      y: 158,
      font: new Font({
        size: 15,
        color: Color.fromHex('#d2dbe4'),
        textAlign: TextAlign.Center,
        family: FONT_FAMILY,
      }),
    });
    this.add(statusLabel);
  }

  private addSetupColumns(engine: Engine, settingsLocked: boolean): void {
    const panelY = 194;
    const panelHeight = 418;
    const gap = 18;
    const panelWidth = Math.floor((engine.drawWidth - 40 - gap * 2) / 3);
    const startX = 20;

    this.addPanelChrome(
      startX,
      panelY,
      panelWidth,
      panelHeight,
      'Map settings',
      '#476d87'
    );
    this.addPanelChrome(
      startX + panelWidth + gap,
      panelY,
      panelWidth,
      panelHeight,
      'State settings',
      '#8f4b25'
    );
    this.addPanelChrome(
      startX + (panelWidth + gap) * 2,
      panelY,
      panelWidth,
      panelHeight,
      'Ruler settings',
      '#6b5d3b'
    );

    this.addMapSettings(panelY, panelWidth, startX, settingsLocked);
    this.addStateSettings(
      panelY,
      panelWidth,
      startX + panelWidth + gap,
      settingsLocked
    );
    this.addRulerSettings(
      panelY,
      panelWidth,
      startX + (panelWidth + gap) * 2,
      settingsLocked
    );
  }

  private addMapSettings(
    panelY: number,
    panelWidth: number,
    panelX: number,
    settingsLocked: boolean
  ): void {
    for (const [index, mapSizeId] of mapSizeOrder.entries()) {
      const definition = getMapSizeDefinition(mapSizeId);
      const selected = this.setup.mapSize === mapSizeId;
      const button = new ScreenButton({
        x: panelX + 18,
        y: panelY + 58 + index * 58,
        width: panelWidth - 36,
        height: 44,
        title: definition.label,
        idleBgColor: selected
          ? Color.fromHex('#476d87')
          : Color.fromHex('#203241'),
        hoverBgColor: selected
          ? Color.fromHex('#5484a4')
          : Color.fromHex('#294154'),
        clickedBgColor: selected
          ? Color.fromHex('#355265')
          : Color.fromHex('#192935'),
        onClick: () => {
          this.setup = { ...this.setup, mapSize: mapSizeId };
          this.render(this.engine);
        },
      });
      if (settingsLocked) {
        button.toggle(false);
      }
      this.add(button);
    }

    const selectedMap = getMapSizeDefinition(this.setup.mapSize);
    this.addParagraph(
      `Selected map: ${selectedMap.label} (${selectedMap.width}x${selectedMap.height})`,
      panelX + 18,
      panelY + 246,
      panelWidth - 36,
      16,
      '#f0e6d2',
      TextAlign.Left
    );
    this.addParagraph(
      selectedMap.description,
      panelX + 18,
      panelY + 280,
      panelWidth - 36,
      15,
      '#b7c4d1',
      TextAlign.Left
    );
    if (settingsLocked) {
      this.addParagraph(
        'Settings are locked while this slot contains a save.',
        panelX + 18,
        panelY + 336,
        panelWidth - 36,
        14,
        '#c6a98e',
        TextAlign.Left
      );
    }
  }

  private addStateSettings(
    panelY: number,
    panelWidth: number,
    panelX: number,
    settingsLocked: boolean
  ): void {
    this.addParagraph(
      this.setup.stateName,
      panelX + panelWidth / 2,
      panelY + 58,
      panelWidth - 36,
      22,
      '#f4e3c2',
      TextAlign.Center
    );

    const regenerateStateNameButton = new ScreenButton({
      x: panelX + (panelWidth - 170) / 2,
      y: panelY + 108,
      width: 170,
      height: 40,
      title: 'Regenerate Name',
      idleBgColor: Color.fromHex('#8f4b25'),
      hoverBgColor: Color.fromHex('#a85b31'),
      clickedBgColor: Color.fromHex('#72391a'),
      onClick: () => {
        this.setup = {
          ...this.setup,
          stateName: generateStateName(this.setupRng),
        };
        this.render(this.engine);
      },
    });
    if (settingsLocked) {
      regenerateStateNameButton.toggle(false);
    }
    this.add(regenerateStateNameButton);

    for (const [index, prehistoryId] of statePrehistoryOrder.entries()) {
      const definition = getStatePrehistoryDefinition(prehistoryId);
      const selected = this.setup.prehistory === prehistoryId;
      const button = new ScreenButton({
        x: panelX + 18,
        y: panelY + 170 + index * 54,
        width: panelWidth - 36,
        height: 40,
        title: `${index + 1}. ${definition.label}`,
        idleBgColor: selected
          ? Color.fromHex('#8f4b25')
          : Color.fromHex('#332821'),
        hoverBgColor: selected
          ? Color.fromHex('#a75a31')
          : Color.fromHex('#45352b'),
        clickedBgColor: selected
          ? Color.fromHex('#71381a')
          : Color.fromHex('#2a211b'),
        onClick: () => {
          this.setup = { ...this.setup, prehistory: prehistoryId };
          this.render(this.engine);
        },
      });
      if (settingsLocked) {
        button.toggle(false);
      }
      this.registerTooltip(button, definition.label, [
        definition.description,
        definition.effectSummary,
      ]);
      this.add(button);
    }
  }

  private addRulerSettings(
    panelY: number,
    panelWidth: number,
    panelX: number,
    settingsLocked: boolean
  ): void {
    const selectedTraitIds = this.setup.rulerTraits;
    const positiveTraits = getRulerTraitsByPolarity('positive');
    const negativeTraits = getRulerTraitsByPolarity('negative');
    const positiveTraitCount = countRulerTraitsByPolarity(
      selectedTraitIds,
      'positive'
    );
    const negativeTraitCount = countRulerTraitsByPolarity(
      selectedTraitIds,
      'negative'
    );
    const positiveTraitLimit =
      getPositiveRulerTraitSelectionLimit(selectedTraitIds);
    const traitAreaTop = panelY + 184;
    const traitAreaBottom = panelY + 418 - 20;
    const traitColumnGap = 12;
    const traitColumnWidth = Math.floor((panelWidth - 36 - traitColumnGap) / 2);
    const traitListHeight = traitAreaBottom - traitAreaTop;

    this.addParagraph(
      this.setup.rulerName,
      panelX + panelWidth / 2,
      panelY + 58,
      panelWidth - 36,
      22,
      '#f0e6d2',
      TextAlign.Center
    );

    const regenerateRulerNameButton = new ScreenButton({
      x: panelX + (panelWidth - 170) / 2,
      y: panelY + 100,
      width: 170,
      height: 38,
      title: 'Regenerate Name',
      idleBgColor: Color.fromHex('#6b5d3b'),
      hoverBgColor: Color.fromHex('#82724b'),
      clickedBgColor: Color.fromHex('#55482d'),
      onClick: () => {
        this.setup = {
          ...this.setup,
          rulerName: generateRulerName(this.setupRng),
        };
        this.render(this.engine);
      },
    });
    if (settingsLocked) {
      regenerateRulerNameButton.toggle(false);
    }
    this.add(regenerateRulerNameButton);

    this.addParagraph(
      `Selected: ${positiveTraitCount}/${positiveTraitLimit} positive, ${negativeTraitCount}/${MAX_NEGATIVE_RULER_TRAITS} negative`,
      panelX + 18,
      panelY + 156,
      panelWidth - 36,
      14,
      '#f0e6d2',
      TextAlign.Left
    );

    this.addTraitList({
      traits: positiveTraits,
      x: panelX + 18,
      y: traitAreaTop,
      width: traitColumnWidth,
      height: traitListHeight,
      settingsLocked,
    });
    this.addTraitList({
      traits: negativeTraits,
      x: panelX + 18 + traitColumnWidth + traitColumnGap,
      y: traitAreaTop,
      width: traitColumnWidth,
      height: traitListHeight,
      settingsLocked,
    });
  }

  private addFooter(engine: Engine, selectedSummary?: SaveSlotSummary): void {
    const canDeleteSelectedSlot = summariesContainUsedSlot(
      SaveManager.getSlotSummaries(),
      this.selectedSlot
    );
    const slotUsed = selectedSummary?.used ?? false;

    const primaryButton = new ScreenButton({
      x: engine.drawWidth - 210,
      y: engine.drawHeight - 66,
      width: 190,
      height: 46,
      title: slotUsed ? 'Continue Save [Enter]' : 'Start New Game [Enter]',
      idleBgColor: Color.fromHex('#58733d'),
      hoverBgColor: Color.fromHex('#6c8b4a'),
      clickedBgColor: Color.fromHex('#455b30'),
      onClick: () => {
        if (slotUsed) {
          SaveManager.queueContinue(this.selectedSlot);
        } else {
          SaveManager.queueNewGame(this.selectedSlot, { ...this.setup });
        }
        engine.goToScene('gameplay');
      },
    });
    this.add(primaryButton);

    const deleteButton = new ScreenButton({
      x: engine.drawWidth / 2 - 95,
      y: engine.drawHeight - 66,
      width: 190,
      height: 46,
      title: 'Delete Save [Del]',
      idleBgColor: Color.fromHex('#7a2b2b'),
      hoverBgColor: Color.fromHex('#943434'),
      clickedBgColor: Color.fromHex('#5e2121'),
      onClick: () => {
        const deleted = SaveManager.deleteSlot(this.selectedSlot);
        if (!deleted) {
          return;
        }
        this.render(engine);
      },
    });
    if (!canDeleteSelectedSlot) {
      deleteButton.toggle(false);
    }
    this.add(deleteButton);

    this.add(
      new ScreenButton({
        x: 20,
        y: engine.drawHeight - 66,
        width: 190,
        height: 46,
        title: 'Back to Menu [Esc]',
        onClick: () => {
          engine.goToScene('main-menu');
        },
      })
    );
  }

  private addPanelChrome(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    accentHex: string
  ): void {
    const panel = new ScreenElement({ x, y });
    panel.anchor = vec(0, 0);
    panel.graphics.use(
      new Rectangle({
        width,
        height,
        color: Color.fromHex('#182430'),
      })
    );
    this.add(panel);

    const header = new ScreenElement({ x, y });
    header.anchor = vec(0, 0);
    header.graphics.use(
      new Rectangle({
        width,
        height: 40,
        color: Color.fromHex(accentHex),
      })
    );
    this.add(header);

    const border = new ScreenElement({ x: x - 1, y: y - 1 });
    border.anchor = vec(0, 0);
    border.graphics.use(
      new Rectangle({
        width: width + 2,
        height: height + 2,
        color: Color.Transparent,
        strokeColor: Color.fromHex('#2b3c4d'),
        lineWidth: 2,
      })
    );
    this.add(border);

    const titleLabel = new Label({
      text: title,
      x: x + width / 2,
      y: y + 10,
      font: new Font({
        size: 18,
        color: Color.fromHex('#f8ecd8'),
        textAlign: TextAlign.Center,
        family: FONT_FAMILY,
      }),
    });
    this.add(titleLabel);
  }

  private addParagraph(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    colorHex: string,
    textAlign: TextAlign
  ): void {
    const label = new Label({
      text: wrapText(text, maxWidth, fontSize).join('\n'),
      x,
      y,
      font: new Font({
        size: fontSize,
        color: Color.fromHex(colorHex),
        textAlign,
        family: FONT_FAMILY,
      }),
    });
    this.add(label);
  }

  private syncSelectedSlot(
    summaries: ReturnType<typeof SaveManager.getSlotSummaries>
  ): void {
    const isCurrentSlotValid = summaries.some(
      (summary) => summary.slot === this.selectedSlot
    );
    if (isCurrentSlotValid) {
      return;
    }

    const latestSlot = SaveManager.getLatestUsedSlot();
    if (latestSlot) {
      this.selectedSlot = latestSlot;
      return;
    }

    this.selectedSlot = 1;
  }

  private buildSlotButtonTitle(summary: SaveSlotSummary): string {
    if (!summary.used) {
      return `Slot ${summary.slot} - Empty`;
    }

    return `Slot ${summary.slot} - ${summary.stateName ?? 'Saved Realm'}`;
  }

  private buildSelectedSlotStatus(summary?: SaveSlotSummary): string {
    if (!summary?.used) {
      return `Slot ${this.selectedSlot} is empty. Starting a new game will use the selected map, state, and ruler settings.`;
    }

    const { day, month, year } = TurnManager.turnToDate(
      summary.turnNumber ?? 1
    );
    const details = [
      summary.stateName ? `State: ${summary.stateName}` : undefined,
      summary.rulerName ? `Ruler: ${summary.rulerName}` : undefined,
      `Date: ${day} ${month}, ${year}`,
      this.formatSavedAt(summary.savedAt),
    ].filter((value): value is string => Boolean(value));

    return `Slot ${summary.slot} is occupied. ${details.join(' | ')}. Continue to load it, or delete the save to free this slot for a new campaign.`;
  }

  private formatSavedAt(savedAt?: number): string | undefined {
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) {
      return undefined;
    }

    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return `Saved ${date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  private registerTooltip(
    button: ScreenButton,
    header: string,
    descriptionLines: string[]
  ): void {
    button.on('pointerenter', () => {
      this.tooltipProvider?.show({
        owner: button,
        header,
        description: descriptionLines.join('\n\n'),
        width: 320,
        getAnchorRect: () => ({
          x: button.globalPos.x,
          y: button.globalPos.y,
          width: button.buttonWidth,
          height: button.buttonHeight,
        }),
      });
    });
    button.on('pointerleave', () => {
      this.tooltipProvider?.hide(button);
    });
    button.on('prekill', () => {
      this.tooltipProvider?.hide(button);
    });
  }

  private addTraitList(options: {
    traits: RulerTraitDefinition[];
    x: number;
    y: number;
    width: number;
    height: number;
    settingsLocked: boolean;
  }): void {
    const listBackplate = new ScreenElement({ x: options.x, y: options.y });
    listBackplate.anchor = vec(0, 0);
    listBackplate.graphics.use(
      new Rectangle({
        width: options.width,
        height: options.height,
        color: Color.fromHex('#111a22'),
        strokeColor: Color.fromHex('#2b3c4d'),
        lineWidth: 1,
      })
    );
    this.add(listBackplate);

    const list = new ScreenList<RulerTraitDefinition>({
      x: options.x + 1,
      y: options.y + 1,
      width: options.width - 2,
      height: options.height - 2,
      items: options.traits,
      itemHeight: 48,
      gap: 8,
      padding: 10,
      transparent: false,
      bgColor: Color.fromHex('#111a22'),
      textColor: '#e8edf2',
      fontCss: `14px ${FONT_FAMILY}`,
      scrollbarTrackColor: 'rgba(255,255,255,0.08)',
      scrollbarThumbColor: 'rgba(255,255,255,0.22)',
      scrollbarThumbActiveColor: 'rgba(255,255,255,0.35)',
      onItemActivate: (trait) => {
        if (options.settingsLocked) {
          return;
        }
        this.toggleRulerTrait(trait.id);
      },
      onItemHoverChange: ({ item: trait, index, anchorRect }) => {
        if (!this.tooltipProvider || options.settingsLocked) {
          this.tooltipProvider?.hide(list);
          return;
        }

        if (!trait || index === null) {
          this.tooltipProvider.hide(list);
          return;
        }

        this.tooltipProvider.show({
          owner: list,
          header: trait.name,
          description: `${trait.description}\n\nEffect: ${trait.effectSummary}`,
          width: 320,
          getAnchorRect: () =>
            anchorRect ?? {
              x: list.globalPos.x,
              y: list.globalPos.y,
              width: options.width - 2,
              height: 48,
            },
        });
      },
      isItemDisabled: (trait) =>
        options.settingsLocked ? true : this.isTraitSelectionBlocked(trait),
      renderItem: ({ ctx, item, x, y, width, height, hovered, disabled }) => {
        const selected = this.setup.rulerTraits.includes(item.id);
        const effectiveHovered = disabled ? false : hovered;
        const fillStyle = this.getTraitRowFill(
          item,
          selected,
          disabled,
          effectiveHovered
        );
        const titleColor = disabled
          ? '#9aa7b3'
          : item.polarity === 'positive'
            ? '#8de0a1'
            : '#eb9090';

        ctx.fillStyle = fillStyle;
        ctx.fillRect(x, y, width, height);

        ctx.strokeStyle = disabled
          ? 'rgba(72, 87, 101, 0.65)'
          : selected
            ? 'rgba(240, 230, 210, 0.45)'
            : 'rgba(63, 83, 101, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

        ctx.font = `700 14px ${FONT_FAMILY}`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = titleColor;
        ctx.fillText(item.name, x + 10, y + height / 2);
      },
    });

    this.add(list);
  }

  private toggleRulerTrait(traitId: string): void {
    const trait = getRulerTraitDefinition(traitId);
    if (!trait) {
      return;
    }

    const selectedTraitIds = [...this.setup.rulerTraits];
    const isSelected = selectedTraitIds.includes(traitId);

    if (isSelected) {
      if (
        trait.polarity === 'negative' &&
        countRulerTraitsByPolarity(selectedTraitIds, 'positive') >
          BASE_POSITIVE_RULER_TRAIT_LIMIT
      ) {
        return;
      }

      this.setup = {
        ...this.setup,
        rulerTraits: selectedTraitIds.filter(
          (selectedId) => selectedId !== traitId
        ),
      };
      this.render(this.engine);
      return;
    }

    if (trait.polarity === 'negative') {
      if (
        countRulerTraitsByPolarity(selectedTraitIds, 'negative') >=
        MAX_NEGATIVE_RULER_TRAITS
      ) {
        return;
      }
    } else {
      const positiveLimit =
        getPositiveRulerTraitSelectionLimit(selectedTraitIds);
      if (
        countRulerTraitsByPolarity(selectedTraitIds, 'positive') >=
        positiveLimit
      ) {
        return;
      }
    }

    this.setup = {
      ...this.setup,
      rulerTraits: [...selectedTraitIds, traitId],
    };
    this.render(this.engine);
  }

  private isTraitSelectionBlocked(trait: RulerTraitDefinition): boolean {
    if (this.setup.rulerTraits.includes(trait.id)) {
      return false;
    }

    const selectedTraitIds = this.setup.rulerTraits;
    if (trait.polarity === 'negative') {
      return (
        countRulerTraitsByPolarity(selectedTraitIds, 'negative') >=
        MAX_NEGATIVE_RULER_TRAITS
      );
    }

    return (
      countRulerTraitsByPolarity(selectedTraitIds, 'positive') >=
      getPositiveRulerTraitSelectionLimit(selectedTraitIds)
    );
  }

  private getTraitRowFill(
    trait: RulerTraitDefinition,
    selected: boolean,
    blocked: boolean,
    hovered: boolean
  ): string {
    if (trait.polarity === 'positive') {
      if (blocked) {
        return 'rgba(40, 58, 48, 0.55)';
      }
      if (selected) {
        return hovered ? 'rgba(63, 116, 83, 0.95)' : 'rgba(50, 94, 68, 0.95)';
      }
      return hovered ? 'rgba(40, 67, 51, 0.9)' : 'rgba(29, 49, 38, 0.9)';
    }

    if (blocked) {
      return 'rgba(67, 43, 43, 0.55)';
    }
    if (selected) {
      return hovered ? 'rgba(129, 64, 64, 0.95)' : 'rgba(104, 51, 51, 0.95)';
    }
    return hovered ? 'rgba(76, 45, 45, 0.9)' : 'rgba(55, 33, 33, 0.9)';
  }
}

function summariesContainUsedSlot(
  summaries: SaveSlotSummary[],
  slot: SaveSlotId
): boolean {
  return summaries.some((summary) => summary.slot === slot && summary.used);
}
