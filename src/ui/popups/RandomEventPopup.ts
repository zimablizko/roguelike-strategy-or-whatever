import { Color, Font, FontUnit, ScreenElement, Text } from 'excalibur';
import type {
  RandomEventOption,
  RandomEventPopupOptions,
} from '../../_common/models/ui.models';
import { FONT_FAMILY } from '../../_common/text';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup } from '../elements/ScreenPopup';

export class RandomEventPopup extends ScreenPopup {
  private readonly tooltipProvider: RandomEventPopupOptions['tooltipProvider'];
  private tooltipOwners: unknown[] = [];

  constructor(options: RandomEventPopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: 640,
      height: 500,
      title: options.title,
      z: UI_Z.statePopup + 3,
      backplateStyle: 'gray',
      closeOnBackplateClick: false,
      showCloseButton: false,
      bgColor: Color.fromHex('#171d25'),
      headerColor: Color.fromHex('#3a2b1f'),
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        const root = new ScreenElement({ x: 0, y: 0 });
        contentRoot.addChild(root);
        const visibleOptions = options.options.slice(0, 4);

        root.addChild(
          this.createWrappedText(
            0,
            0,
            options.description,
            612,
            16,
            Color.fromHex('#d9e2eb')
          )
        );

        const gap = 12;
        const optionCount = Math.max(1, visibleOptions.length);
        const buttonWidth =
          optionCount === 1
            ? 320
            : optionCount === 2
              ? 240
              : optionCount === 3
                ? 184
                : 138;
        const totalWidth = buttonWidth * optionCount + gap * (optionCount - 1);
        let x = Math.floor((612 - totalWidth) / 2);
        const y = 340;

        for (const option of visibleOptions) {
          root.addChild(this.createOptionButton(x, y, buttonWidth, option));
          x += buttonWidth + gap;
        }
      },
    });

    this.tooltipProvider = options.tooltipProvider;
  }

  override onPreKill(_scene: import('excalibur').Scene): void {
    for (const owner of this.tooltipOwners) {
      this.tooltipProvider.hide(owner);
    }
    this.tooltipOwners = [];
    super.onPreKill(_scene);
  }

  private createOptionButton(
    x: number,
    y: number,
    width: number,
    option: RandomEventOption
  ): ScreenElement {
    const row = new ScreenElement({ x, y });
    const button = new ScreenButton({
      x: 0,
      y: 0,
      width,
      height: 60,
      title: option.title,
      idleBgColor: option.disabled
        ? Color.fromHex('#4b5563')
        : Color.fromHex('#6d4a28'),
      hoverBgColor: option.disabled
        ? Color.fromHex('#4b5563')
        : Color.fromHex('#8b6137'),
      clickedBgColor: option.disabled
        ? Color.fromHex('#4b5563')
        : Color.fromHex('#56381d'),
      idleTextColor: option.disabled
        ? Color.fromHex('#c4ccd6')
        : Color.fromHex('#f7efe2'),
      hoverTextColor: option.disabled
        ? Color.fromHex('#c4ccd6')
        : Color.fromHex('#ffffff'),
      clickedTextColor: option.disabled
        ? Color.fromHex('#c4ccd6')
        : Color.fromHex('#eddcc6'),
      onClick: () => {
        if (option.disabled) return;
        this.close();
        option.onSelect();
      },
    });
    row.addChild(button);
    this.bindTooltip(button, option.title, option.outcomeDescription);
    return row;
  }

  private bindTooltip(
    button: ScreenButton,
    header: string,
    description: string
  ): void {
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
        width: 280,
        placement: 'top',
      });
    });
    button.on('pointerleave', () => this.tooltipProvider.hide(button));
    button.on('prekill', () => this.tooltipProvider.hide(button));
    this.tooltipOwners.push(button);
  }

  private createLine(
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
    const roughChars = Math.max(18, Math.floor(maxWidth / (size * 0.48)));
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
    return this.createLine(x, y, lines.slice(0, 6).join('\n'), size, color);
  }
}
