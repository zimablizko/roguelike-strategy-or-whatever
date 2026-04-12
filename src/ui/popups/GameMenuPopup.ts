import { Engine } from 'excalibur';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup } from '../elements/ScreenPopup';

export interface GameMenuPopupOptions {
  engine: Engine;
  onClose: () => void;
  onSaveAndExit: () => void;
}

/**
 * In-game menu popup with an Exit button.
 */
export class GameMenuPopup extends ScreenPopup {
  constructor(options: GameMenuPopupOptions) {
    const { engine, onClose, onSaveAndExit } = options;

    const exitButton = new ScreenButton({
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      title: 'Save & Exit to Menu',
      onClick: () => {
        onSaveAndExit();
      },
    });

    super({
      x: engine.drawWidth / 2,
      y: engine.drawHeight / 2,
      anchor: 'center',
      width: 300,
      height: 150,
      title: 'Game Menu',
      z: UI_Z.modalPopup,
      backplateStyle: 'gray-full',
      closeOnBackplateClick: true,
      content: [exitButton],
      onClose,
      contentBuilder: () => {},
    });
  }
}
