import {
  Color,
  Font,
  FontUnit,
  Rectangle,
  ScreenElement,
  Text,
} from 'excalibur';
import type {
  PoliticalEntity,
  PoliticalEntityId,
  PoliticalRequestInstance,
  ReputationTierInfo,
} from '../../_common/models/politics.models';
import { reputationTierFromValue } from '../../_common/models/politics.models';
import type { ResourceType } from '../../_common/models/resource.models';
import type { StatePopupOptions } from '../../_common/models/ui.models';
import { getPoliticalRequestDefinition } from '../../data/politicalRequests';
import { BuildingManager } from '../../managers/BuildingManager';
import { PoliticsManager } from '../../managers/PoliticsManager';
import { ResourceManager } from '../../managers/ResourceManager';
import { StateManager } from '../../managers/StateManager';
import { TurnManager } from '../../managers/TurnManager';
import { STATE_POPUP_LAYOUT } from '../constants/StatePopupConstants';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup } from '../elements/ScreenPopup';
import { TooltipProvider } from '../tooltip/TooltipProvider';

type TabId = 'town-hall' | 'storage' | 'statistics';

/**
 * Dedicated popup for state details.
 * Features a tab bar with Town Hall (politics) and Statistics tabs.
 */
export class StatePopup extends ScreenPopup {
  private stateManager: StateManager;
  private buildingManager: BuildingManager;
  private resourceManager: ResourceManager;
  private turnManager: TurnManager;
  private politicsManager: PoliticsManager;
  private tooltipProvider: TooltipProvider;
  private contentRootRef?: ScreenElement;
  private bodyRoot?: ScreenElement;
  private activeTab: TabId = 'town-hall';
  private tabButtons: ScreenButton[] = [];
  private requestButtons: ScreenButton[] = [];
  private lastPoliticsVersion = -1;
  private lastResourceVersion = -1;

  constructor(options: StatePopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: STATE_POPUP_LAYOUT.width,
      height: STATE_POPUP_LAYOUT.height,
      title: `State: ${options.stateManager.getStateRef().name}`,
      z: UI_Z.statePopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.contentRootRef = contentRoot;
        this.buildTabBar();
        this.renderActiveTab();
      },
    });

    this.stateManager = options.stateManager;
    this.buildingManager = options.buildingManager;
    this.resourceManager = options.resourceManager;
    this.turnManager = options.turnManager;
    this.politicsManager = options.politicsManager;
    this.tooltipProvider = options.tooltipProvider;
  }

  onPreUpdate(): void {
    super.onPreUpdate();

    // Dirty-check for Town Hall / Storage tab live updates
    if (this.activeTab === 'town-hall' || this.activeTab === 'storage') {
      const polVer = this.politicsManager.getVersion();
      const resVer = this.resourceManager.getResourcesVersion();
      if (
        polVer !== this.lastPoliticsVersion ||
        resVer !== this.lastResourceVersion
      ) {
        this.lastPoliticsVersion = polVer;
        this.lastResourceVersion = resVer;
        this.renderActiveTab();
      }
    }
  }

  // ─── Tab Bar ─────────────────────────────────────────────────────

  private buildTabBar(): void {
    const contentRoot = this.contentRootRef;
    if (!contentRoot) return;

    const L = STATE_POPUP_LAYOUT;
    const tabs: { id: TabId; label: string }[] = [
      { id: 'town-hall', label: 'Town Hall' },
      { id: 'storage', label: 'Storage' },
      { id: 'statistics', label: 'Statistics' },
    ];

    let tabX = 0;
    for (const tab of tabs) {
      const isActive = tab.id === this.activeTab;
      const btn = new ScreenButton({
        x: tabX,
        y: 0,
        width: L.tabButtonWidth,
        height: L.tabButtonHeight,
        title: tab.label,
        idleBgColor: isActive
          ? Color.fromHex('#2d6a9f')
          : Color.fromHex('#233241'),
        hoverBgColor: Color.fromHex('#3a7cc0'),
        clickedBgColor: Color.fromHex('#1f5c8a'),
        idleTextColor: isActive ? Color.White : Color.fromHex('#8fa8c0'),
        hoverTextColor: Color.White,
        clickedTextColor: Color.White,
        onClick: () => this.switchTab(tab.id),
      });
      contentRoot.addChild(btn);
      this.tabButtons.push(btn);
      tabX += L.tabButtonWidth + L.tabButtonGap;
    }
  }

  private switchTab(tabId: TabId): void {
    if (this.activeTab === tabId) return;
    this.activeTab = tabId;

    // Rebuild tabs + content
    this.cleanupTabs();
    this.buildTabBar();
    this.renderActiveTab();
  }

  private cleanupTabs(): void {
    for (const btn of this.tabButtons) {
      if (!btn.isKilled()) btn.kill();
    }
    this.tabButtons = [];
  }

  // ─── Tab Content ─────────────────────────────────────────────────

  private renderActiveTab(): void {
    const contentRoot = this.contentRootRef;
    if (!contentRoot) return;

    // Clean up tooltip registrations from request buttons
    for (const btn of this.requestButtons) {
      this.tooltipProvider.hide(btn);
    }
    this.requestButtons = [];

    if (this.bodyRoot && !this.bodyRoot.isKilled()) {
      this.bodyRoot.kill();
    }

    const L = STATE_POPUP_LAYOUT;
    const bodyY = L.tabBarHeight + L.tabContentGap;
    const body = new ScreenElement({ x: 0, y: bodyY });
    contentRoot.addChild(body);
    this.bodyRoot = body;

    if (this.activeTab === 'town-hall') {
      this.populateTownHall(body);
    } else if (this.activeTab === 'storage') {
      this.populateStorage(body);
    } else {
      this.populateStatistics(body);
    }
  }

  // ─── Town Hall Tab ───────────────────────────────────────────────

  private populateTownHall(root: ScreenElement): void {
    const L = STATE_POPUP_LAYOUT;
    const entities = this.politicsManager.getEntities();
    const hasTownHall =
      this.buildingManager.isTechnologyUnlocked('pol-clan-council');

    if (!hasTownHall) {
      root.addChild(
        StatePopup.createLine(
          0,
          20,
          'Research "Clan Council" to unlock the Town Hall.',
          16,
          Color.fromHex('#8fa8c0')
        )
      );
      return;
    }

    // ─ Entity portraits row ─
    const contentWidth = L.width - L.padding * 2;
    const entityCount = entities.length;
    const totalEntityWidth =
      entityCount * L.entityIconSize + (entityCount - 1) * L.entityGap;
    let entityX = Math.max(0, (contentWidth - totalEntityWidth) / 2);

    for (const entity of entities) {
      this.renderEntityCard(root, entity, entityX, 0);
      entityX += L.entityIconSize + L.entityGap;
    }

    // ─ Separator ─
    const separatorY = L.entityRowHeight + 4;
    const separator = new ScreenElement({ x: 0, y: separatorY });
    separator.graphics.use(
      new Rectangle({
        width: contentWidth,
        height: 1,
        color: Color.fromHex('#334a5e'),
      })
    );
    root.addChild(separator);

    // ─ Requests header ─
    const requestsHeaderY = separatorY + 10;
    root.addChild(
      StatePopup.createLine(
        0,
        requestsHeaderY,
        'Requests',
        16,
        Color.fromHex('#f0f4f8')
      )
    );

    // ─ Request list ─
    const requests = this.politicsManager.getActiveRequests();
    const listStartY = requestsHeaderY + 28;

    if (requests.length === 0) {
      root.addChild(
        StatePopup.createLine(
          10,
          listStartY,
          'No active requests at this time.',
          13,
          Color.fromHex('#6b7b8d')
        )
      );
      return;
    }

    let cardY = listStartY;
    for (const req of requests) {
      this.renderRequestCard(root, req, 0, cardY, contentWidth);
      cardY += L.requestCardHeight + L.requestCardGap;
    }
  }

  private renderEntityCard(
    root: ScreenElement,
    entity: PoliticalEntity,
    x: number,
    y: number
  ): void {
    const L = STATE_POPUP_LAYOUT;
    const tierInfo: ReputationTierInfo = reputationTierFromValue(
      entity.reputation
    );

    // Icon background (colored square as placeholder portrait)
    const iconBg = new ScreenElement({ x, y });
    iconBg.graphics.use(
      new Rectangle({
        width: L.entityIconSize,
        height: L.entityIconSize,
        color: Color.fromHex('#233241'),
      })
    );
    root.addChild(iconBg);

    // Entity initial letter as portrait placeholder
    const initial = entity.name.charAt(0).toUpperCase();
    const initialEl = new ScreenElement({
      x: x + L.entityIconSize / 2 - 8,
      y: y + L.entityIconSize / 2 - 10,
    });
    initialEl.graphics.use(
      new Text({
        text: initial,
        font: new Font({
          size: 20,
          unit: FontUnit.Px,
          color: Color.fromHex(tierInfo.colorHex),
        }),
      })
    );
    root.addChild(initialEl);

    // Entity name (short label)
    const shortName = this.getShortEntityName(entity.id);
    const nameEl = new ScreenElement({
      x: x - 8,
      y: y + L.entityIconSize + 4,
    });
    nameEl.graphics.use(
      new Text({
        text: shortName,
        font: new Font({
          size: 11,
          unit: FontUnit.Px,
          color: Color.fromHex('#b0bcc8'),
        }),
      })
    );
    root.addChild(nameEl);

    // Reputation tier word
    const tierEl = new ScreenElement({
      x: x - 4,
      y: y + L.entityIconSize + 18,
    });
    tierEl.graphics.use(
      new Text({
        text: tierInfo.label,
        font: new Font({
          size: 12,
          unit: FontUnit.Px,
          color: Color.fromHex(tierInfo.colorHex),
        }),
      })
    );
    root.addChild(tierEl);
  }

  private renderRequestCard(
    root: ScreenElement,
    request: PoliticalRequestInstance,
    x: number,
    y: number,
    width: number
  ): void {
    const def = getPoliticalRequestDefinition(request.definitionId);
    if (!def) return;

    const cardBg = new ScreenElement({ x, y });
    cardBg.graphics.use(
      new Rectangle({
        width,
        height: STATE_POPUP_LAYOUT.requestCardHeight,
        color: Color.fromHex('#1e2d3d'),
      })
    );
    root.addChild(cardBg);

    // Entity icon + title
    const entityName = this.getShortEntityName(request.entityId);
    root.addChild(
      StatePopup.createLine(
        x + 10,
        y + 8,
        `[${entityName}] ${def.title}`,
        14,
        Color.fromHex('#f0f4f8')
      )
    );

    // Description
    const descText =
      def.description.length > 80
        ? def.description.substring(0, 77) + '...'
        : def.description;
    root.addChild(
      StatePopup.createLine(
        x + 10,
        y + 26,
        descText,
        11,
        Color.fromHex('#8fa8c0')
      )
    );

    // Approve button
    const btnWidth = 72;
    const btnHeight = 24;
    const btnY = y + 42;
    const approveBtn = new ScreenButton({
      x: width - btnWidth * 2 - 20,
      y: btnY,
      width: btnWidth,
      height: btnHeight,
      title: 'Approve',
      idleBgColor: Color.fromHex('#2d6a3f'),
      hoverBgColor: Color.fromHex('#3a8f52'),
      clickedBgColor: Color.fromHex('#1f5a30'),
      onClick: () => {
        this.politicsManager.approveRequest(request.instanceId, (effects) => {
          for (const [res, amount] of Object.entries(effects)) {
            if (amount) {
              this.resourceManager.addResource(res as ResourceType, amount);
            }
          }
        });
      },
    });
    root.addChild(approveBtn);
    this.requestButtons.push(approveBtn);

    // Deny button
    const denyBtn = new ScreenButton({
      x: width - btnWidth - 10,
      y: btnY,
      width: btnWidth,
      height: btnHeight,
      title: 'Deny',
      idleBgColor: Color.fromHex('#6a2d2d'),
      hoverBgColor: Color.fromHex('#8f3a3a'),
      clickedBgColor: Color.fromHex('#5a1f1f'),
      onClick: () => {
        this.politicsManager.denyRequest(request.instanceId);
      },
    });
    root.addChild(denyBtn);
    this.requestButtons.push(denyBtn);
  }

  // ─── Storage Tab ─────────────────────────────────────────────────

  private populateStorage(root: ScreenElement): void {
    const resources = this.resourceManager.getAllResources();
    const titleColor = Color.fromHex('#f0f4f8');
    const labelColor = Color.fromHex('#b0bcc8');

    const resourceEntries: {
      label: string;
      key: ResourceType;
      color: string;
    }[] = [
      { label: 'Gold', key: 'gold', color: '#f5dd90' },
      { label: 'Wood', key: 'wood', color: '#c8a86e' },
      { label: 'Stone', key: 'stone', color: '#d2d5db' },
      { label: 'Wheat', key: 'wheat', color: '#e8d44d' },
      { label: 'Meat', key: 'meat', color: '#e87461' },
      { label: 'Bread', key: 'bread', color: '#d4a358' },
      { label: 'Population', key: 'population', color: '#e0c6f5' },
    ];

    let y = 0;
    root.addChild(
      StatePopup.createLine(0, y, 'Resource Storage', 18, titleColor)
    );
    y += 30;

    for (const entry of resourceEntries) {
      // Label
      root.addChild(StatePopup.createLine(10, y, entry.label, 14, labelColor));
      // Value (right-aligned via fixed x)
      root.addChild(
        StatePopup.createLine(
          160,
          y,
          `${resources[entry.key]}`,
          14,
          Color.fromHex(entry.color)
        )
      );
      y += 22;
    }
  }

  // ─── Statistics Tab ──────────────────────────────────────────────

  private populateStatistics(root: ScreenElement): void {
    const state = this.stateManager.getStateRef();
    const titleColor = Color.fromHex('#f0f4f8');
    const popColor = Color.fromHex('#e0c6f5');
    const warnColor = Color.fromHex('#f5c179');
    const costColor = Color.fromHex('#f2b0a6');
    const okColor = Color.fromHex('#9fe6aa');

    let y = 0;
    const addLine = (
      text: string,
      size: number,
      color: Color,
      gapAfter = 5
    ) => {
      root.addChild(StatePopup.createLine(0, y, text, size, color));
      y += size + gapAfter;
    };

    addLine(`Total Size: ${state.size}`, 18, titleColor, 12);
    addLine(`Forest: ${state.tiles.forest}`, 14, Color.fromHex('#a8e6a1'));
    addLine(`Stone: ${state.tiles.stone}`, 14, Color.fromHex('#d2d5db'));
    addLine(`Plains: ${state.tiles.plains}`, 14, Color.fromHex('#f5dd90'));
    addLine(`River: ${state.tiles.river}`, 14, Color.fromHex('#9fd3ff'));
    addLine(`Ocean border: ${state.ocean}`, 14, Color.fromHex('#7fb7ff'), 12);

    const totalPop = this.buildingManager.getTotalPopulation();
    const occupiedPop = this.buildingManager.getOccupiedPopulation();
    const freePop = this.buildingManager.getFreePopulation();
    addLine('Population', 16, titleColor, 8);
    addLine(
      `Total: ${totalPop}  |  Occupied: ${occupiedPop}  |  Free: ${freePop}`,
      14,
      freePop > 0 ? popColor : warnColor,
      12
    );

    const upkeep = this.turnManager.getUpkeepBreakdown();
    addLine('Upkeep (per turn)', 16, titleColor, 8);
    if (upkeep.totalGold > 0) {
      addLine(`Gold: ${upkeep.totalGold}`, 14, costColor);
    }
    addLine(
      `Food: ${upkeep.populationFood} (1 per 2 pop) — any food type`,
      14,
      costColor
    );
    addLine(
      `Food available: ${upkeep.totalFoodAvailable}`,
      14,
      upkeep.totalFoodAvailable >= upkeep.populationFood ? okColor : warnColor
    );

    const currentGold = this.resourceManager.getResource('gold');
    if (
      upkeep.totalFoodAvailable < upkeep.populationFood ||
      currentGold < upkeep.totalGold
    ) {
      addLine(
        'Warning: insufficient resources for next upkeep!',
        13,
        warnColor,
        4
      );
      return;
    }

    addLine('Upkeep is affordable.', 13, okColor, 4);
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private getShortEntityName(entityId: PoliticalEntityId): string {
    switch (entityId) {
      case 'common-folk':
        return 'Folk';
      case 'economy-advisor':
        return 'Economy';
      case 'military-advisor':
        return 'Military';
      case 'politics-advisor':
        return 'Politics';
    }
  }

  private static createLine(
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
        }),
      })
    );
    return line;
  }
}
