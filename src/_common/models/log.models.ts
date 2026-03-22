export type GameLogSeverity = 'good' | 'bad' | 'neutral';

export interface GameLogEntry {
  id: number;
  message: string;
  severity: GameLogSeverity;
  turnNumber: number;
  dateLabel: string;
  createdAt: number;
}

export interface GameLogSaveState {
  entries: GameLogEntry[];
  entrySerial: number;
  version: number;
}
