import { Color, Engine, Font, Label, Scene, TextAlign } from 'excalibur';
import type {
  SaveSlotId,
  SaveSlotSummary,
} from '../_common/models/save.models';
import { SaveManager } from '../managers/SaveManager';
import { ScreenButton } from '../ui/elements/ScreenButton';

export class InitializationScene extends Scene {
  private selectedSlot: SaveSlotId = 1;

  onInitialize(engine: Engine): void {
    this.backgroundColor = Color.fromHex('#1abc9c');
    this.render(engine);
  }

  onActivate(): void {
    this.render(this.engine);
  }

  private render(engine: Engine): void {
    this.clear();

    const title = new Label({
      text: 'Play',
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2 - 100,
      font: new Font({
        size: 32,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(title);

    const subtitle = new Label({
      text: 'Select save slot',
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2 - 62,
      font: new Font({
        size: 20,
        color: Color.White,
        textAlign: TextAlign.Center,
      }),
    });
    this.add(subtitle);

    this.addButtons(engine);
  }

  private addButtons(engine: Engine) {
    const summaries = SaveManager.getSlotSummaries();
    this.syncSelectedSlot(summaries);
    const selectedSummary = summaries.find(
      (summary) => summary.slot === this.selectedSlot
    );
    const isSelectedUsed = selectedSummary?.used ?? false;
    const slotButtonWidth = 360;
    const slotButtonHeight = 48;
    const startX = engine.drawWidth / 2 - slotButtonWidth / 2;
    const startY = engine.drawHeight / 2 - 10;

    for (const [index, summary] of summaries.entries()) {
      const selected = this.selectedSlot === summary.slot;
      const button = new ScreenButton({
        x: startX,
        y: startY + index * (slotButtonHeight + 10),
        width: slotButtonWidth,
        height: slotButtonHeight,
        title: this.buildSlotButtonTitle(summary),
        idleBgColor: selected
          ? Color.fromHex('#15806b')
          : Color.fromHex('#3b5d73'),
        hoverBgColor: selected
          ? Color.fromHex('#17947c')
          : Color.fromHex('#477392'),
        clickedBgColor: selected
          ? Color.fromHex('#116a58')
          : Color.fromHex('#2e4c60'),
        onClick: () => {
          this.selectedSlot = summary.slot;
          this.render(engine);
        },
      });
      this.add(button);
    }

    const canDeleteSelectedSlot = summaries.some(
      (summary) => summary.slot === this.selectedSlot && summary.used
    );
    const startButton = new ScreenButton({
      x: engine.drawWidth - 170,
      y: engine.drawHeight - 70,
      width: 150,
      height: 50,
      title: isSelectedUsed ? 'Continue' : 'Start New Game',
      onClick: () => {
        if (isSelectedUsed) {
          SaveManager.queueContinue(this.selectedSlot);
        } else {
          SaveManager.queueNewGame(this.selectedSlot);
        }
        engine.goToScene('gameplay');
      },
    });
    this.add(startButton);

    const deleteButton = new ScreenButton({
      x: engine.drawWidth / 2 - 75,
      y: engine.drawHeight - 70,
      width: 150,
      height: 50,
      title: 'Delete Save',
      idleBgColor: Color.fromHex('#8e2b2b'),
      hoverBgColor: Color.fromHex('#a73333'),
      clickedBgColor: Color.fromHex('#6f2020'),
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

    const backButton = new ScreenButton({
      x: 20,
      y: engine.drawHeight - 70,
      width: 150,
      height: 50,
      title: 'Back to Menu',
      onClick: () => {
        engine.goToScene('main-menu');
      },
    });
    this.add(backButton);
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

    const base = `Slot ${summary.slot} - Turn ${summary.turnNumber ?? 1}`;

    const details: string[] = [];
    if (summary.stateName) {
      details.push(summary.stateName);
    }
    if (summary.rulerName) {
      details.push(summary.rulerName);
    }

    const savedAtLabel = this.formatSavedAt(summary.savedAt);
    if (savedAtLabel) {
      details.push(savedAtLabel);
    }

    if (details.length === 0) {
      return base;
    }
    return `${base} (${details.join(' | ')})`;
  }

  private formatSavedAt(savedAt?: number): string | undefined {
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) {
      return undefined;
    }

    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
