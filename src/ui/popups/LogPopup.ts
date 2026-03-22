import type { GameLogEntry } from '../../_common/models/log.models';
import { GameLogManager } from '../../managers/GameLogManager';
import { UI_Z } from '../constants/ZLayers';
import { ScreenList } from '../elements/ScreenList';
import { ScreenPopup } from '../elements/ScreenPopup';
import { renderGameLogListItem } from '../logs/GameLogListRenderer';

interface LogPopupOptions {
  x: number;
  y: number;
  logManager: GameLogManager;
  anchor?: 'center' | 'top-left' | 'top-right';
  onClose?: () => void;
}

export class LogPopup extends ScreenPopup {
  private readonly logManager: GameLogManager;
  private list?: ScreenList<GameLogEntry>;
  private lastLogVersion = -1;

  constructor(options: LogPopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: 760,
      height: 560,
      title: 'Log History',
      z: UI_Z.statePopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.list = new ScreenList<GameLogEntry>({
          x: 0,
          y: 0,
          width: 732,
          height: 474,
          items: [],
          itemHeight: 54,
          gap: 0,
          padding: 0,
          transparent: true,
          scrollStep: 42,
          renderItem: renderGameLogListItem,
          showScrollbar: true,
        });
        contentRoot.addChild(this.list);
        this.syncEntries(true);
      },
    });
    this.logManager = options.logManager;
  }

  onPreUpdate(): void {
    super.onPreUpdate();
    this.syncEntries(false);
  }

  private syncEntries(force: boolean): void {
    const version = this.logManager.getVersion();
    if (!force && version === this.lastLogVersion) {
      return;
    }

    this.lastLogVersion = version;
    this.list?.setItems(this.logManager.getEntries());
    this.list?.scrollToTop();
  }
}
