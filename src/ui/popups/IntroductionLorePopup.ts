import { Color, Font, FontUnit, Label, TextAlign } from 'excalibur';
import { FONT_FAMILY, wrapText } from '../../_common/text';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup } from '../elements/ScreenPopup';

export interface IntroductionLorePopupOptions {
  x: number;
  y: number;
  title: string;
  body: string;
  onClose?: () => void;
}

export class IntroductionLorePopup extends ScreenPopup {
  constructor(options: IntroductionLorePopupOptions) {
    const continueButton = new ScreenButton({
      x: 206,
      y: 272,
      width: 220,
      height: 44,
      title: 'Begin Reign',
      idleBgColor: Color.fromHex('#6d4a28'),
      hoverBgColor: Color.fromHex('#8b6137'),
      clickedBgColor: Color.fromHex('#56381d'),
      idleTextColor: Color.fromHex('#f7efe2'),
      hoverTextColor: Color.White,
      clickedTextColor: Color.fromHex('#eddcc6'),
      onClick: () => {
        this.close();
      },
    });

    const bodyLabel = new Label({
      text: wrapText(options.body, 600, 18).join('\n'),
      x: 316,
      y: 0,
      font: new Font({
        size: 18,
        unit: FontUnit.Px,
        color: Color.fromHex('#d8e1ea'),
        family: FONT_FAMILY,
        textAlign: TextAlign.Center,
      }),
    });

    super({
      x: options.x,
      y: options.y,
      anchor: 'center',
      width: 660,
      height: 390,
      title: options.title,
      z: UI_Z.modalPopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: false,
      showCloseButton: false,
      bgColor: Color.fromHex('#171d25'),
      headerColor: Color.fromHex('#3a2b1f'),
      content: [bodyLabel, continueButton],
      onClose: options.onClose,
      contentBuilder: () => {},
    });
  }
}
