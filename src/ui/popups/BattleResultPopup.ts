import { Color, Font, FontUnit, ScreenElement, Text } from 'excalibur';
import type { BattleResultPopupOptions } from '../../_common/models/ui.models';
import { FONT_FAMILY } from '../../_common/text';
import { getResourceIcon } from '../../_common/icons';
import { getUnitDefinition } from '../../data/military';
import type { UnitRole } from '../../_common/models/military.models';
import type { ResourceType } from '../../_common/models/resource.models';
import { UI_Z } from '../constants/ZLayers';
import { ScreenPopup } from '../elements/ScreenPopup';

export class BattleResultPopup extends ScreenPopup {
  constructor(options: BattleResultPopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: 560,
      height: 470,
      title: 'Battle Result',
      z: UI_Z.statePopup + 3,
      backplateStyle: 'gray',
      closeOnBackplateClick: false,
      bgColor: Color.fromHex('#171d25'),
      headerColor: Color.fromHex('#2f2020'),
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        const result = options.result;
        const root = new ScreenElement({ x: 0, y: 0 });
        contentRoot.addChild(root);

        const winnerText =
          result.winner === 'player'
            ? 'Victory'
            : result.winner === 'enemy'
              ? 'Defeat'
              : 'Stalemate';
        const winnerColor =
          result.winner === 'player'
            ? Color.fromHex('#9fe6aa')
            : result.winner === 'enemy'
              ? Color.fromHex('#f2a7a0')
              : Color.fromHex('#f0d48a');

        let y = 0;
        root.addChild(this.createLine(0, y, result.name, 22, Color.fromHex('#f4e7d0')));
        y += 34;
        root.addChild(this.createLine(0, y, winnerText, 28, winnerColor));
        y += 38;
        root.addChild(
          this.createLine(
            0,
            y,
            `Turns: ${result.turns}  |  Morale ${result.playerMorale} / ${result.enemyMorale}`,
            15,
            Color.fromHex('#d7e1ea')
          )
        );
        y += 36;

        root.addChild(this.createLine(0, y, 'Casualties', 18, Color.fromHex('#f4e7d0')));
        y += 28;
        root.addChild(
          this.createLine(
            0,
            y,
            `Player killed: ${this.formatCounts(result.playerKilled)}`,
            14,
            Color.fromHex('#d7e1ea')
          )
        );
        y += 22;
        root.addChild(
          this.createLine(
            0,
            y,
            `Enemy killed: ${this.formatCounts(result.enemyKilled)}`,
            14,
            Color.fromHex('#d7e1ea')
          )
        );
        y += 22;
        root.addChild(
          this.createLine(
            0,
            y,
            `Player routed: ${this.formatCounts(result.playerRouted)}`,
            14,
            Color.fromHex('#c7d1db')
          )
        );
        y += 22;
        root.addChild(
          this.createLine(
            0,
            y,
            `Enemy routed: ${this.formatCounts(result.enemyRouted)}`,
            14,
            Color.fromHex('#c7d1db')
          )
        );
        y += 36;

        root.addChild(this.createLine(0, y, 'Rewards', 18, Color.fromHex('#f4e7d0')));
        y += 30;
        const rewardEntries = Object.entries(result.rewards).filter(
          ([, amount]) => (amount ?? 0) > 0
        );
        if (rewardEntries.length === 0) {
          root.addChild(this.createLine(0, y, 'None', 14, Color.fromHex('#d7e1ea')));
          y += 24;
        } else {
          let rewardX = 0;
          for (const [resource, amount] of rewardEntries) {
            const icon = new ScreenElement({ x: rewardX, y: y - 2 });
            icon.graphics.use(getResourceIcon(resource as ResourceType, 18));
            root.addChild(icon);
            root.addChild(
              this.createLine(
                rewardX + 24,
                y,
                `${amount}`,
                14,
                Color.fromHex('#9fe6aa')
              )
            );
            rewardX += 76;
          }
          y += 30;
        }

        root.addChild(this.createLine(0, y, 'Summary', 18, Color.fromHex('#f4e7d0')));
        y += 30;
        for (const line of result.summaryLines.slice(0, 5)) {
          root.addChild(this.createLine(0, y, line, 14, Color.fromHex('#d7e1ea')));
          y += 22;
        }
      },
    });
  }

  private formatCounts(counts: Partial<Record<string, number>>): string {
    const parts = Object.entries(counts)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([unitId, count]) => {
        const name = getUnitDefinition(unitId as UnitRole)?.name ?? unitId;
        return `${count} ${name}`;
      });
    return parts.length > 0 ? parts.join(', ') : 'None';
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
}
