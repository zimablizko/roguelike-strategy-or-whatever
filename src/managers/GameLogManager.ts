import type {
  GameLogEntry,
  GameLogSaveState,
  GameLogSeverity,
} from '../_common/models/log.models';

export class GameLogManager {
  private entries: GameLogEntry[] = [];
  private entrySerial = 0;
  private version = 0;
  private currentTurnNumber = 1;
  private currentDateLabel = '1 January, 1000';

  constructor(initial?: GameLogSaveState) {
    if (!initial) {
      return;
    }

    this.entries = initial.entries.map((entry) => ({ ...entry }));
    this.entrySerial = Math.max(
      initial.entrySerial,
      ...this.entries.map((entry) => entry.id),
      0
    );
    this.version = Math.max(0, initial.version);

    const latestEntry = this.entries[0];
    if (latestEntry) {
      this.currentTurnNumber = Math.max(1, latestEntry.turnNumber);
      this.currentDateLabel = latestEntry.dateLabel;
    }
  }

  setCurrentDate(turnNumber: number, dateLabel: string): void {
    this.currentTurnNumber = Math.max(1, Math.floor(turnNumber));
    this.currentDateLabel = dateLabel;
  }

  getVersion(): number {
    return this.version;
  }

  getEntries(): GameLogEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  getEntriesRef(): readonly GameLogEntry[] {
    return this.entries;
  }

  addEntry(message: string, severity: GameLogSeverity = 'neutral'): GameLogEntry {
    const entry: GameLogEntry = {
      id: ++this.entrySerial,
      message,
      severity,
      turnNumber: this.currentTurnNumber,
      dateLabel: this.currentDateLabel,
      createdAt: Date.now(),
    };
    this.entries.unshift(entry);
    this.version++;
    return entry;
  }

  addGood(message: string): GameLogEntry {
    return this.addEntry(message, 'good');
  }

  addBad(message: string): GameLogEntry {
    return this.addEntry(message, 'bad');
  }

  addNeutral(message: string): GameLogEntry {
    return this.addEntry(message, 'neutral');
  }

  getSaveState(): GameLogSaveState {
    return {
      entries: this.getEntries(),
      entrySerial: this.entrySerial,
      version: this.version,
    };
  }
}
