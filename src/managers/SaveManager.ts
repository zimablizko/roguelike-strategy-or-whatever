import type { GameSaveData, PendingGameLaunch, SaveSlotId, SaveSlotSummary } from '../_common/models/save.models';
import { GameManager } from './GameManager';
import { TurnManager } from './TurnManager';

interface SaveStorageEnvelope {
  version: 1;
  slots: Partial<Record<SaveSlotId, GameSaveData>>;
}

const STORAGE_KEY = 'roguelike_strategy_save_slots_v1';
const SLOT_IDS: SaveSlotId[] = [1, 2, 3];
let pendingLaunch: PendingGameLaunch | undefined;

export class SaveManager {
  static readonly SLOT_IDS = SLOT_IDS;

  static queueNewGame(slot: SaveSlotId): void {
    pendingLaunch = { slot, mode: 'new' };
  }

  static queueContinue(slot: SaveSlotId): void {
    pendingLaunch = { slot, mode: 'continue' };
  }

  static queueContinueLatest(): boolean {
    const slot = this.getLatestUsedSlot();
    if (!slot) {
      return false;
    }
    this.queueContinue(slot);
    return true;
  }

  static consumePendingLaunch(): PendingGameLaunch | undefined {
    const launch = pendingLaunch;
    pendingLaunch = undefined;
    return launch;
  }

  static captureGameState(
    gameManager: GameManager,
    turnManager: TurnManager
  ): GameSaveData {
    return gameManager.getSnapshot({
      data: turnManager.getTurnData(),
      version: turnManager.getTurnVersion(),
    });
  }

  static saveToSlot(slot: SaveSlotId, save: GameSaveData): void {
    const envelope = this.readEnvelope();
    envelope.slots[slot] = {
      ...save,
      version: 1,
      savedAt: Date.now(),
    };
    this.writeEnvelope(envelope);
  }

  static loadFromSlot(slot: SaveSlotId): GameSaveData | undefined {
    const envelope = this.readEnvelope();
    return envelope.slots[slot];
  }

  static deleteSlot(slot: SaveSlotId): boolean {
    const envelope = this.readEnvelope();
    if (envelope.slots[slot] === undefined) {
      return false;
    }

    delete envelope.slots[slot];
    this.writeEnvelope(envelope);

    if (pendingLaunch?.slot === slot) {
      pendingLaunch = undefined;
    }

    return true;
  }

  static hasAnyUsedSlots(): boolean {
    const envelope = this.readEnvelope();
    return SLOT_IDS.some((slot) => envelope.slots[slot] !== undefined);
  }

  static getLatestUsedSlot(): SaveSlotId | undefined {
    const envelope = this.readEnvelope();
    let latestSlot: SaveSlotId | undefined;
    let latestTimestamp = -1;

    for (const slot of SLOT_IDS) {
      const save = envelope.slots[slot];
      if (!save) {
        continue;
      }
      if (save.savedAt > latestTimestamp) {
        latestTimestamp = save.savedAt;
        latestSlot = slot;
      }
    }

    return latestSlot;
  }

  static getSlotSummaries(): SaveSlotSummary[] {
    const envelope = this.readEnvelope();
    return SLOT_IDS.map((slot) => {
      const save = envelope.slots[slot];
      if (!save) {
        return { slot, used: false };
      }
      return {
        slot,
        used: true,
        savedAt: save.savedAt,
        turnNumber: save.turn.data.turnNumber,
        rulerName: save.ruler.name,
        stateName: save.state.name,
      };
    });
  }

  private static readEnvelope(): SaveStorageEnvelope {
    const storage = this.getStorage();
    if (!storage) {
      return { version: 1, slots: {} };
    }

    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: 1, slots: {} };
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!this.isRecord(parsed)) {
        return { version: 1, slots: {} };
      }

      const rawSlots = this.isRecord(parsed.slots) ? parsed.slots : {};
      const slots: Partial<Record<SaveSlotId, GameSaveData>> = {};
      for (const slot of SLOT_IDS) {
        const candidate = rawSlots[String(slot)];
        if (this.isGameSaveData(candidate)) {
          slots[slot] = candidate;
        }
      }
      return { version: 1, slots };
    } catch (error) {
      console.warn('Failed to parse save data from localStorage.', error);
      return { version: 1, slots: {} };
    }
  }

  private static writeEnvelope(envelope: SaveStorageEnvelope): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch (error) {
      console.warn('Failed to write save data to localStorage.', error);
    }
  }

  private static getStorage(): Storage | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  }

  private static isRecord(
    value: unknown
  ): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private static isGameSaveData(value: unknown): value is GameSaveData {
    if (!this.isRecord(value)) {
      return false;
    }
    if (value.version !== 1) {
      return false;
    }

    if (typeof value.savedAt !== 'number') {
      return false;
    }

    if (!this.isRecord(value.turn) || !this.isRecord(value.turn.data)) {
      return false;
    }
    if (typeof value.turn.data.turnNumber !== 'number') {
      return false;
    }

    if (!this.isRecord(value.ruler) || typeof value.ruler.name !== 'string') {
      return false;
    }
    if (!this.isRecord(value.state) || typeof value.state.name !== 'string') {
      return false;
    }
    if (typeof value.rngState !== 'number') {
      return false;
    }
    if (!this.isRecord(value.playerData) || typeof value.playerData.race !== 'string') {
      return false;
    }
    if (
      !this.isRecord(value.resources) ||
      typeof value.resources.gold !== 'number' ||
      typeof value.resources.materials !== 'number' ||
      typeof value.resources.food !== 'number' ||
      typeof value.resources.population !== 'number'
    ) {
      return false;
    }
    if (
      !this.isRecord(value.map) ||
      typeof value.map.width !== 'number' ||
      typeof value.map.height !== 'number' ||
      !Array.isArray(value.map.tiles) ||
      !Array.isArray(value.map.zones)
    ) {
      return false;
    }
    if (
      !this.isRecord(value.turn.data.actionPoints) ||
      typeof value.turn.data.actionPoints.current !== 'number' ||
      typeof value.turn.data.actionPoints.max !== 'number' ||
      typeof value.turn.version !== 'number'
    ) {
      return false;
    }
    if (
      !this.isRecord(value.buildings) ||
      !Array.isArray(value.buildings.instances) ||
      !Array.isArray(value.buildings.technologies) ||
      typeof value.buildings.instanceSerial !== 'number' ||
      !this.isRecord(value.buildings.counts)
    ) {
      return false;
    }
    if (
      !this.isRecord(value.research) ||
      !Array.isArray(value.research.completedResearches) ||
      typeof value.research.researchVersion !== 'number'
    ) {
      return false;
    }

    return true;
  }
}
