import {
  Actor,
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  GraphicsGrouping,
  Rectangle,
  ScreenElement,
  Text,
  vec,
} from 'excalibur';
import { ScreenButton } from './ScreenButton';

export type ScreenPopupAnchor = 'top-left' | 'top-right' | 'center';

export type ScreenPopupContentBuilder = (
  contentRoot: ScreenElement,
  popup: ScreenPopup
) => void;

export interface ScreenPopupOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  anchor?: ScreenPopupAnchor;
  title?: string;
  padding?: number;
  headerHeight?: number;
  bgColor?: Color;
  headerColor?: Color;
  textColor?: Color;
  content?: Actor | Actor[];
  contentBuilder?: ScreenPopupContentBuilder;
  onClose?: () => void;
}

/**
 * Generic popup container UI.
 * - Closeable via an "X" button (top-right)
 * - Content is provided at initialization via `content` and/or `contentBuilder`
 */
export class ScreenPopup extends ScreenElement {
  private popupWidth: number;
  private popupHeight: number;
  private padding: number;
  private headerHeight: number;
  private anchorX: number;
  private anchorY: number;
  private popupAnchor: ScreenPopupAnchor;
  private title: string;
  private bgColor: Color;
  private headerColor: Color;
  private textColor: Color;
  private content?: Actor | Actor[];
  private contentBuilder?: ScreenPopupContentBuilder;
  private onClose?: () => void;

  private contentRoot!: ScreenElement;
  private closeButton!: ScreenButton;

  constructor(options: ScreenPopupOptions) {
    super({ x: options.x, y: options.y });

    this.anchorX = options.x;
    this.anchorY = options.y;
    this.popupAnchor = options.anchor ?? 'top-left';
    this.popupWidth = options.width ?? 520;
    this.popupHeight = options.height ?? 320;
    this.padding = options.padding ?? 14;
    this.headerHeight = options.headerHeight ?? 44;
    this.title = options.title ?? '';
    this.bgColor = options.bgColor ?? Color.fromHex('#1a252f');
    this.headerColor = options.headerColor ?? Color.fromHex('#233241');
    this.textColor = options.textColor ?? Color.White;
    this.content = options.content;
    this.contentBuilder = options.contentBuilder;
    this.onClose = options.onClose;

    // Ensure popups render above most UI
    this.z = 1000;

    this.applyAnchorPosition();
  }

  onInitialize(): void {
    this.buildBackground();
    this.buildCloseButton();
    this.buildContentRoot();
    this.populateContent();
  }

  /**
   * Close the popup (removes it from the scene)
   */
  close(): void {
    this.onClose?.();
    this.kill();
  }

  private applyAnchorPosition(): void {
    if (this.popupAnchor === 'center') {
      this.pos = vec(
        this.anchorX - this.popupWidth / 2,
        this.anchorY - this.popupHeight / 2
      );
      return;
    }

    if (this.popupAnchor === 'top-right') {
      this.pos = vec(this.anchorX - this.popupWidth, this.anchorY);
      return;
    }

    this.pos = vec(this.anchorX, this.anchorY);
  }

  private buildBackground(): void {
    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: this.popupWidth,
          height: this.popupHeight,
          color: this.bgColor,
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: this.popupWidth,
          height: this.headerHeight,
          color: this.headerColor,
        }),
        offset: vec(0, 0),
      },
    ];

    if (this.title) {
      const titleText = new Text({
        text: this.title,
        font: new Font({
          size: 16,
          unit: FontUnit.Px,
          color: this.textColor,
        }),
      });
      const titleX = this.padding;
      const titleY = (this.headerHeight - titleText.height) / 2;
      members.push({
        graphic: titleText,
        offset: vec(titleX, titleY),
      });
    }

    this.graphics.use(
      new GraphicsGroup({
        members,
      })
    );
  }

  private buildCloseButton(): void {
    const size = 28;
    this.closeButton = new ScreenButton({
      x: this.popupWidth - this.padding - size,
      y: (this.headerHeight - size) / 2,
      width: size,
      height: size,
      title: 'X',
      idleBgColor: Color.fromHex('#334a5e'),
      hoverBgColor: Color.fromHex('#3d5a73'),
      clickedBgColor: Color.fromHex('#2a3e50'),
      idleTextColor: this.textColor,
      hoverTextColor: this.textColor,
      clickedTextColor: this.textColor,
    });

    this.closeButton.z = this.z + 2;
    this.addChild(this.closeButton);
    this.closeButton.on('pointerup', () => this.close());
  }

  private buildContentRoot(): void {
    this.contentRoot = new ScreenElement({
      x: this.padding,
      y: this.headerHeight + this.padding,
    });
    this.contentRoot.z = this.z + 1;
    this.addChild(this.contentRoot);
  }

  private populateContent(): void {
    if (this.content) {
      const items = Array.isArray(this.content) ? this.content : [this.content];
      for (const item of items) {
        this.contentRoot.addChild(item);
      }
    }

    this.contentBuilder?.(this.contentRoot, this);
  }
}
