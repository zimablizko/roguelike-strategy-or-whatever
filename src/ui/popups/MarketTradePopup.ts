import { Color, Font, FontUnit, ScreenElement, Text } from 'excalibur';
import type { MarketTradePopupOptions } from '../../_common/models/ui.models';
import { FONT_FAMILY } from '../../_common/text';
import { MARKET_TRADE_OFFERS, type MarketTradeOffer } from '../../data/marketCommerce';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup } from '../elements/ScreenPopup';
import { UI_Z } from '../constants/ZLayers';

export class MarketTradePopup extends ScreenPopup {
  private readonly buildingManager: MarketTradePopupOptions['buildingManager'];
  private readonly resourceManager: MarketTradePopupOptions['resourceManager'];
  private readonly turnManager: MarketTradePopupOptions['turnManager'];
  private readonly logManager: MarketTradePopupOptions['logManager'];
  private readonly marketInstanceId: string;
  private bodyRoot?: ScreenElement;

  constructor(options: MarketTradePopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: 540,
      height: 280,
      title: 'Market Trade',
      z: UI_Z.statePopup + 2,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.bodyRoot = new ScreenElement({ x: 0, y: 0 });
        contentRoot.addChild(this.bodyRoot);
        this.renderContent();
      },
    });

    this.buildingManager = options.buildingManager;
    this.resourceManager = options.resourceManager;
    this.turnManager = options.turnManager;
    this.logManager = options.logManager;
    this.marketInstanceId = options.marketInstanceId;
  }

  private renderContent(): void {
    const root = this.bodyRoot;
    if (!root) {
      return;
    }

    if (!root.isKilled()) {
      for (const child of [...root.children]) {
        child.kill();
      }
    }

    this.buildContent(root);
  }

  private buildContent(root: ScreenElement): void {
    const actionStatus = this.buildingManager.canActivateBuildingAction(
      'market',
      'trade',
      this.marketInstanceId,
      this.resourceManager
    );

    root.addChild(
      this.createLine(
        0,
        0,
        'Buy or sell fixed bundles while the caravan remains in town.',
        14,
        Color.fromHex('#d9e2eb')
      )
    );
    root.addChild(
      this.createLine(
        0,
        22,
        `Focus available: ${this.turnManager.getTurnDataRef().focus.current}`,
        12,
        Color.fromHex('#9fb4c8')
      )
    );
    root.addChild(
      this.createLine(
        0,
        40,
        actionStatus.activatable
          ? 'Caravan is in town.'
          : (actionStatus.reason ?? 'Trading is unavailable right now.'),
        12,
        actionStatus.activatable
          ? Color.fromHex('#9fe6aa')
          : Color.fromHex('#f5c179')
      )
    );

    let y = 74;
    for (const offer of MARKET_TRADE_OFFERS) {
      root.addChild(
        this.createLine(
          0,
          y + 4,
          `${offer.label}: ${offer.amount} for ${offer.goldPrice} Gold`,
          14,
          Color.fromHex('#f0f4f8')
        )
      );

      const canBuy = this.canExecuteTrade(offer, 'buy');
      const buyButton = new ScreenButton({
        x: 250,
        y,
        width: 110,
        height: 28,
        title: `Buy ${offer.amount}`,
        onClick: () => this.executeTrade(offer, 'buy'),
      });
      if (!canBuy) {
        buyButton.toggle(false);
      }
      root.addChild(buyButton);

      const canSell = this.canExecuteTrade(offer, 'sell');
      const sellButton = new ScreenButton({
        x: 376,
        y,
        width: 110,
        height: 28,
        title: `Sell ${offer.amount}`,
        onClick: () => this.executeTrade(offer, 'sell'),
      });
      if (!canSell) {
        sellButton.toggle(false);
      }
      root.addChild(sellButton);

      y += 42;
    }
  }

  private canExecuteTrade(
    offer: MarketTradeOffer,
    mode: 'buy' | 'sell'
  ): boolean {
    if (!this.isTradingAvailable()) {
      return false;
    }
    if (this.turnManager.getTurnDataRef().focus.current < 1) {
      return false;
    }
    if (mode === 'buy') {
      return this.resourceManager.getResource('gold') >= offer.goldPrice;
    }
    return this.resourceManager.getResource(offer.resourceType) >= offer.amount;
  }

  private isTradingAvailable(): boolean {
    return this.buildingManager.canActivateBuildingAction(
      'market',
      'trade',
      this.marketInstanceId,
      this.resourceManager
    ).activatable;
  }

  private executeTrade(
    offer: MarketTradeOffer,
    mode: 'buy' | 'sell'
  ): void {
    if (!this.canExecuteTrade(offer, mode)) {
      return;
    }
    if (!this.turnManager.spendFocus(1)) {
      return;
    }

    if (mode === 'buy') {
      this.resourceManager.addResource('gold', -offer.goldPrice);
      this.resourceManager.addResource(offer.resourceType, offer.amount);
    } else {
      this.resourceManager.addResource(offer.resourceType, -offer.amount);
      this.resourceManager.addResource('gold', offer.goldPrice);
    }

    const verb = mode === 'buy' ? 'Bought' : 'Sold';
    this.logManager.addNeutral(
      `${verb} ${offer.amount} ${offer.label} for ${offer.goldPrice} Gold at the Market.`
    );
    this.renderContent();
  }

  private createLine(
    x: number,
    y: number,
    text: string,
    size: number,
    color: Color
  ): ScreenElement {
    const line = new ScreenElement({ x, y });
    line.graphics.use(
      new Text({
        text,
        font: new Font({
          size,
          unit: FontUnit.Px,
          color,
          family: FONT_FAMILY,
        }),
      })
    );
    return line;
  }
}
