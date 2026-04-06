import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  Rectangle,
  ScreenElement,
  Text,
  vec,
} from 'excalibur';
import type {
  RulerData,
  RulerHealth,
} from '../../_common/models/ruler.models';
import type { RulerTraitDefinition } from '../../_common/models/ruler-traits.models';
import { FONT_FAMILY } from '../../_common/text';
import { resolveRulerTraits } from '../../data/traits';
import type { RulerManager } from '../../managers/RulerManager';
import { UI_Z } from '../constants/ZLayers';
import { ScreenPopup } from '../elements/ScreenPopup';
import type { TooltipProvider } from '../tooltip/TooltipProvider';

export interface RulerPopupOptions {
  x: number;
  y: number;
  rulerManager: RulerManager;
  tooltipProvider: TooltipProvider;
  onClose?: () => void;
}

type StatCardDefinition = {
  label: string;
  value: string;
  accentColor: Color;
  description: string;
};

const RULER_SKILL_COLORS = {
  charisma: Color.fromHex('#d9c26b'),
  governance: Color.fromHex('#62b6cb'),
  intrigue: Color.fromHex('#8f7ae6'),
  warfare: Color.fromHex('#d96f5f'),
} as const;

export class RulerPopup extends ScreenPopup {
  private static readonly POPUP_WIDTH = 640;
  private static readonly POPUP_HEIGHT = 560;
  private static readonly COLUMN_GAP = 18;
  private static readonly LEFT_COLUMN_WIDTH = 182;
  private static readonly CARD_HEIGHT = 44;
  private static readonly CARD_GAP = 8;
  private static readonly SECTION_HEADER_HEIGHT = 28;

  private readonly tooltipProvider: TooltipProvider;
  private tooltipOwners: unknown[] = [];

  constructor(options: RulerPopupOptions) {
    const ruler = options.rulerManager.getRulerRef();

    super({
      x: options.x,
      y: options.y,
      anchor: 'center',
      width: RulerPopup.POPUP_WIDTH,
      height: RulerPopup.POPUP_HEIGHT,
      title: `Ruler: ${ruler.name}`,
      z: UI_Z.statePopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.buildContent(contentRoot, ruler);
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

  private buildContent(
    contentRoot: ScreenElement,
    ruler: Readonly<RulerData>
  ): void {
    const contentWidth = RulerPopup.POPUP_WIDTH - 28;
    const leftX = 0;
    const rightX = RulerPopup.LEFT_COLUMN_WIDTH + RulerPopup.COLUMN_GAP;
    const rightWidth = contentWidth - rightX;

    const topBottom = Math.max(
      this.buildStatusColumn(
        contentRoot,
        leftX,
        0,
        RulerPopup.LEFT_COLUMN_WIDTH,
        ruler
      ),
      this.buildSkillsColumn(contentRoot, rightX, 0, rightWidth, ruler)
    );

    const lowerY = topBottom + 18;
    const traitsWidth = 352;
    const actionsX = traitsWidth + RulerPopup.COLUMN_GAP;
    const actionsWidth = contentWidth - actionsX;

    this.buildTraitsSection(contentRoot, 0, lowerY, traitsWidth, ruler);
    this.buildActionsSection(contentRoot, actionsX, lowerY, actionsWidth);
  }

  private buildStatusColumn(
    root: ScreenElement,
    x: number,
    y: number,
    width: number,
    ruler: Readonly<RulerData>
  ): number {
    root.addChild(this.createSectionHeader(x, y, 'Status'));
    let nextY = y + RulerPopup.SECTION_HEADER_HEIGHT;

    const cards: StatCardDefinition[] = [
      {
        label: 'Age',
        value: String(ruler.age),
        accentColor: Color.fromHex('#92a9bd'),
        description:
          'Represents the ruler age. It is mostly informational for now, but it is a natural hook for future succession, mortality, and dynasty systems.',
      },
      {
        label: 'Health',
        value: ruler.health,
        accentColor: this.getHealthColor(ruler.health),
        description:
          'Represents overall physical condition. Better health makes the ruler more resilient and supports future long-term character risk.',
      },
      {
        label: 'Focus',
        value: String(ruler.focus),
        accentColor: Color.fromHex('#e4c166'),
        description:
          'Determines how much direct personal attention the ruler can spend each turn. Construction, decrees, and other hands-on actions consume Focus.',
      },
    ];

    for (const card of cards) {
      root.addChild(
        this.createStatCard(x, nextY, width, RulerPopup.CARD_HEIGHT, card)
      );
      nextY += RulerPopup.CARD_HEIGHT + RulerPopup.CARD_GAP;
    }

    return nextY - RulerPopup.CARD_GAP;
  }

  private buildSkillsColumn(
    root: ScreenElement,
    x: number,
    y: number,
    width: number,
    ruler: Readonly<RulerData>
  ): number {
    root.addChild(this.createSectionHeader(x, y, 'Ruler Skills'));

    const cardGap = 10;
    const cardWidth = Math.floor((width - cardGap) / 2);
    const startY = y + RulerPopup.SECTION_HEADER_HEIGHT;
    const secondRowY = startY + RulerPopup.CARD_HEIGHT + cardGap;

    const cards: Array<StatCardDefinition & { x: number; y: number }> = [
      {
        x,
        y: startY,
        label: 'Charisma',
        value: String(ruler.charisma),
        accentColor: RULER_SKILL_COLORS.charisma,
        description:
          'Used for persuasion, diplomacy, public speeches, negotiation, and any event where personal presence matters.',
      },
      {
        x: x + cardWidth + cardGap,
        y: startY,
        label: 'Governance',
        value: String(ruler.governance),
        accentColor: RULER_SKILL_COLORS.governance,
        description:
          'Used for administration, taxation, logistics, provisioning, and keeping the realm machinery running efficiently.',
      },
      {
        x,
        y: secondRowY,
        label: 'Intrigue',
        value: String(ruler.intrigue),
        accentColor: RULER_SKILL_COLORS.intrigue,
        description:
          'Used for schemes, hidden dealings, intelligence work, blackmail, and situations where secrecy matters.',
      },
      {
        x: x + cardWidth + cardGap,
        y: secondRowY,
        label: 'Warfare',
        value: String(ruler.warfare),
        accentColor: RULER_SKILL_COLORS.warfare,
        description:
          'Used for army discipline, battlefield judgment, frontier crises, and moments that reward military leadership.',
      },
    ];

    for (const card of cards) {
      root.addChild(
        this.createStatCard(
          card.x,
          card.y,
          cardWidth,
          RulerPopup.CARD_HEIGHT,
          card
        )
      );
    }

    return secondRowY + RulerPopup.CARD_HEIGHT;
  }

  private buildTraitsSection(
    root: ScreenElement,
    x: number,
    y: number,
    width: number,
    ruler: Readonly<RulerData>
  ): void {
    root.addChild(this.createSectionHeader(x, y, 'Traits'));

    const traits = resolveRulerTraits(ruler.traits);
    if (traits.length === 0) {
      root.addChild(
        this.createText(
          x,
          y + 30,
          'No traits selected.',
          13,
          Color.fromHex('#8fa8c0')
        )
      );
      return;
    }

    const gap = 10;
    const blockWidth = Math.floor((width - gap) / 2);
    const startY = y + 30;

    for (let i = 0; i < traits.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      root.addChild(
        this.createTraitBlock(
          x + col * (blockWidth + gap),
          startY + row * 38,
          blockWidth,
          traits[i]
        )
      );
    }
  }

  private buildActionsSection(
    root: ScreenElement,
    x: number,
    y: number,
    width: number
  ): void {
    root.addChild(this.createSectionHeader(x, y, 'Actions'));

    const panelY = y + 30;
    const panelHeight = 112;
    root.addChild(
      this.createPanelBlock(
        x,
        panelY,
        width,
        panelHeight,
        Color.fromHex('#17232d')
      )
    );

    root.addChild(
      this.createText(
        x + 14,
        panelY + 16,
        'No personal actions available yet.',
        14,
        Color.fromHex('#d4e6f1')
      )
    );
    root.addChild(
      this.createWrappedText(
        x + 14,
        panelY + 44,
        'This section is reserved for direct ruler actions, court decisions, and future character abilities.',
        width - 28,
        12,
        Color.fromHex('#8fa8c0')
      )
    );
  }

  private createSectionHeader(
    x: number,
    y: number,
    text: string
  ): ScreenElement {
    const root = new ScreenElement({ x, y });
    root.addChild(this.createText(0, 0, text, 16, Color.fromHex('#d4e6f1')));
    root.addChild(
      this.createRect(0, 22, 120, 1, Color.fromHex('#324453'))
    );
    return root;
  }

  private createStatCard(
    x: number,
    y: number,
    width: number,
    height: number,
    card: StatCardDefinition
  ): ScreenElement {
    const root = new ScreenElement({ x, y });
    root.pointer.useGraphicsBounds = true;
    root.pointer.useColliderShape = false;

    root.graphics.use(
      new GraphicsGroup({
        members: [
          {
            graphic: new Rectangle({
              width,
              height,
              color: Color.fromHex('#17232d'),
              strokeColor: Color.fromHex('#324453'),
              lineWidth: 1,
            }),
            offset: vec(0, 0),
          },
          {
            graphic: new Rectangle({
              width: 4,
              height,
              color: card.accentColor,
            }),
            offset: vec(0, 0),
          },
          {
            graphic: new Text({
              text: card.label.toUpperCase(),
              font: new Font({
                size: 10,
                unit: FontUnit.Px,
                color: Color.fromHex('#8fa8c0'),
                family: FONT_FAMILY,
              }),
            }),
            offset: vec(12, 7),
          },
          {
            graphic: new Text({
              text: card.value,
              font: new Font({
                size: 18,
                unit: FontUnit.Px,
                color: card.accentColor,
                family: FONT_FAMILY,
              }),
            }),
            offset: vec(12, 20),
          },
        ],
      })
    );

    this.bindTooltip(root, card.label, card.description, width, height);
    return root;
  }

  private createTraitBlock(
    x: number,
    y: number,
    width: number,
    trait: RulerTraitDefinition
  ): ScreenElement {
    const height = 30;
    const block = new ScreenElement({ x, y });
    const titleColor =
      trait.polarity === 'positive'
        ? Color.fromHex('#76d98f')
        : Color.fromHex('#e08484');

    block.pointer.useGraphicsBounds = true;
    block.pointer.useColliderShape = false;
    block.graphics.use(
      new GraphicsGroup({
        members: [
          {
            graphic: new Rectangle({
              width,
              height,
              color: Color.fromHex('#17232d'),
              strokeColor: Color.fromHex('#324453'),
              lineWidth: 1,
            }),
            offset: vec(0, 0),
          },
          {
            graphic: new Text({
              text: trait.name,
              font: new Font({
                size: 14,
                unit: FontUnit.Px,
                color: titleColor,
                family: FONT_FAMILY,
              }),
            }),
            offset: vec(10, 7),
          },
        ],
      })
    );

    this.bindTooltip(
      block,
      trait.name,
      `${trait.description}\n\nEffect: ${trait.effectSummary}`,
      width,
      height
    );

    return block;
  }

  private bindTooltip(
    owner: ScreenElement,
    header: string,
    description: string,
    width: number,
    height: number
  ): void {
    owner.on('pointerenter', () => {
      this.tooltipProvider.show({
        owner,
        getAnchorRect: () => ({
          x: owner.globalPos.x,
          y: owner.globalPos.y,
          width,
          height,
        }),
        header,
        description,
        width: 320,
      });
    });
    owner.on('pointerleave', () => {
      this.tooltipProvider.hide(owner);
    });
    owner.on('prekill', () => {
      this.tooltipProvider.hide(owner);
    });
    this.tooltipOwners.push(owner);
  }

  private createText(
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
    const roughChars = Math.max(16, Math.floor(maxWidth / (size * 0.52)));
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

    return this.createText(x, y, lines.join('\n'), size, color);
  }

  private createRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color
  ): ScreenElement {
    const el = new ScreenElement({ x, y });
    el.graphics.use(
      new Rectangle({
        width,
        height,
        color,
      })
    );
    return el;
  }

  private createPanelBlock(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color
  ): ScreenElement {
    const el = new ScreenElement({ x, y });
    el.graphics.use(
      new Rectangle({
        width,
        height,
        color,
        strokeColor: Color.fromHex('#324453'),
        lineWidth: 1,
      })
    );
    return el;
  }

  private getHealthColor(health: RulerHealth): Color {
    switch (health) {
      case 'Poor':
        return Color.fromHex('#e74c3c');
      case 'Fair':
        return Color.fromHex('#e67e22');
      case 'Good':
        return Color.fromHex('#f1c40f');
      case 'Strong':
        return Color.fromHex('#2ecc71');
      case 'Excellent':
        return Color.fromHex('#27ae60');
      default:
        return Color.White;
    }
  }
}
