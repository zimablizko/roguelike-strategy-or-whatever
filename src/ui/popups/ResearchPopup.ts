import {
  Color,
  Font,
  FontUnit,
  GraphicsGroup,
  Rectangle,
  ScreenElement,
  Text,
  vec,
  type GraphicsGrouping,
} from 'excalibur';
import { clamp } from '../../_common/math';
import { measureTextWidth } from '../../_common/text';
import type {
  ResearchId,
  ResearchTreeId,
  TypedResearchDefinition,
} from '../../_common/models/researches.models';
import type {
  ResearchPopupOptions,
  TreeNodeLayout,
} from '../../_common/models/ui.models';
import type { TooltipOutcome } from '../../_common/models/tooltip.models';
import {
  isResearchId,
  researchTreeInfo,
} from '../../data/researches';
import { ResearchManager } from '../../managers/ResearchManager';
import { TurnManager } from '../../managers/TurnManager';
import {
  RESEARCH_POPUP_LAYOUT,
  RESEARCH_TREE_DERIVED,
  RESEARCH_TREE_DRAW,
} from '../constants/ResearchPopupConstants';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup } from '../elements/ScreenPopup';
import { TooltipProvider } from '../tooltip/TooltipProvider';

export class ResearchPopup extends ScreenPopup {
  private readonly researchManager: ResearchManager;
  private readonly turnManager: TurnManager;
  private readonly tooltipProvider: TooltipProvider;
  private selectedTree: ResearchTreeId = 'economics';

  private contentRootRef?: ScreenElement;
  private statusRoot?: ScreenElement;
  private tabsRoot?: ScreenElement;
  private treeRoot?: ScreenElement;
  private treeScrollOffset = 0;
  private treeMaxScroll = 0;

  constructor(options: ResearchPopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: RESEARCH_POPUP_LAYOUT.width,
      height: RESEARCH_POPUP_LAYOUT.height,
      title: 'Research',
      z: UI_Z.statePopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.contentRootRef = contentRoot;
        this.renderAll();
      },
    });
    this.researchManager = options.researchManager;
    this.turnManager = options.turnManager;
    this.tooltipProvider = options.tooltipProvider;
  }

  private renderAll(): void {
    const contentRoot = this.contentRootRef;
    if (!contentRoot) {
      return;
    }

    if (this.statusRoot && !this.statusRoot.isKilled()) {
      this.statusRoot.kill();
    }
    if (this.tabsRoot && !this.tabsRoot.isKilled()) {
      this.tabsRoot.kill();
    }

    this.statusRoot = new ScreenElement({ x: 0, y: RESEARCH_POPUP_LAYOUT.statusOffsetY });
    this.tabsRoot = new ScreenElement({ x: 0, y: RESEARCH_POPUP_LAYOUT.tabOffsetY });
    contentRoot.addChild(this.statusRoot);
    contentRoot.addChild(this.tabsRoot);

    this.populateStatus(this.statusRoot);
    this.populateTabs(this.tabsRoot);
    this.rebuildTreeRoot();
  }

  private rebuildTreeRoot(): void {
    const contentRoot = this.contentRootRef;
    if (!contentRoot) {
      return;
    }

    if (this.treeRoot && !this.treeRoot.isKilled()) {
      this.treeRoot.kill();
    }

    this.treeRoot = new ScreenElement({ x: 0, y: RESEARCH_POPUP_LAYOUT.treeOffsetY });
    contentRoot.addChild(this.treeRoot);
    this.populateTree(this.treeRoot);
  }

  private populateStatus(root: ScreenElement): void {
    const active = this.researchManager.getActiveResearch();
    const latestCompletion = this.researchManager.getLatestCompletion();
    const completed = this.researchManager.getCompletedCount();
    const total = this.researchManager.getTotalCount();
    const currentTurn = this.turnManager.getTurnDataRef().turnNumber;
    const lineColor = Color.fromHex('#dce6ef');
    const titleColor = Color.fromHex('#f0f4f8');
    const warnColor = Color.fromHex('#f5c179');
    const okColor = Color.fromHex('#9fe6aa');

    let y = 0;
    const addLine = (text: string, size: number, color: Color, gapAfter = 4) => {
      root.addChild(ResearchPopup.createTextLine(0, y, text, size, color));
      y += size + gapAfter;
    };

    addLine(`Completed: ${completed}/${total}`, 16, titleColor, 8);
    if (active) {
      const treeInfo = researchTreeInfo[active.tree];
      const etaTurn = currentTurn + active.remainingTurns;
      addLine(
        `Current: ${active.name} (${treeInfo.name})`,
        14,
        Color.fromHex(treeInfo.colorHex),
        4
      );
      addLine(
        `Progress: ${active.totalTurns - active.remainingTurns}/${active.totalTurns} turns`,
        13,
        lineColor,
        4
      );
      addLine(`Estimated completion: Turn ${etaTurn}`, 13, lineColor, 4);
      return;
    }

    addLine('No research in progress.', 14, warnColor, 4);
    if (this.researchManager.hasAnyStartableResearch()) {
      addLine('Reminder: start a research project.', 13, warnColor, 4);
    } else if (completed === total) {
      addLine('All available research is complete.', 13, okColor, 4);
    } else {
      addLine('No available projects right now.', 13, lineColor, 4);
    }

    if (latestCompletion) {
      addLine(
        `Last completed: ${latestCompletion.name} (Turn ${latestCompletion.completedOnTurn})`,
        13,
        okColor,
        4
      );
    }
  }

  private populateTabs(root: ScreenElement): void {
    const tabOrder = this.researchManager.getTreeOrder();
    const tabWidth = 180;
    const tabHeight = 36;
    const tabGap = 10;

    for (const [index, treeId] of tabOrder.entries()) {
      const info = researchTreeInfo[treeId];
      const selected = this.selectedTree === treeId;
      const button = new ScreenButton({
        x: index * (tabWidth + tabGap),
        y: 0,
        width: tabWidth,
        height: tabHeight,
        title: info.name,
        idleBgColor: selected
          ? Color.fromHex(info.colorHex)
          : Color.fromHex('#30455c'),
        hoverBgColor: selected
          ? Color.fromHex(info.colorHex).lighten(0.1)
          : Color.fromHex('#3a5773'),
        clickedBgColor: selected
          ? Color.fromHex(info.colorHex).darken(0.1)
          : Color.fromHex('#2d4358'),
        onClick: () => {
          if (this.selectedTree === treeId) {
            return;
          }
          this.selectedTree = treeId;
          this.treeScrollOffset = 0;
          this.renderAll();
        },
      });
      root.addChild(button);
    }
  }

  private populateTree(root: ScreenElement): void {
    root.pointer.useGraphicsBounds = true;
    root.pointer.useColliderShape = false;
    root.on('pointerwheel', (evt) => {
      const direction = Math.sign(evt.deltaY);
      if (direction === 0) {
        return;
      }
      this.adjustTreeScroll(direction * RESEARCH_POPUP_LAYOUT.treeScrollStep);
      evt.cancel();
    });

    root.graphics.use(
      new GraphicsGroup({
        members: [
          {
            graphic: new Rectangle({
              width: RESEARCH_TREE_DERIVED.viewportWidth,
              height: RESEARCH_TREE_DERIVED.viewportHeight,
              color: Color.fromRGB(12, 20, 28, 0.64),
            }),
            offset: vec(0, 0),
          },
          {
            graphic: new Rectangle({
              width: RESEARCH_TREE_DERIVED.viewportWidth,
              height: 1,
              color: Color.fromRGB(170, 196, 220, 0.5),
            }),
            offset: vec(0, 0),
          },
          {
            graphic: new Rectangle({
              width: RESEARCH_TREE_DERIVED.viewportWidth,
              height: 1,
              color: Color.fromRGB(170, 196, 220, 0.5),
            }),
            offset: vec(0, RESEARCH_TREE_DERIVED.viewportHeight - 1),
          },
          {
            graphic: new Rectangle({
              width: 1,
              height: RESEARCH_TREE_DERIVED.viewportHeight,
              color: Color.fromRGB(170, 196, 220, 0.5),
            }),
            offset: vec(0, 0),
          },
          {
            graphic: new Rectangle({
              width: 1,
              height: RESEARCH_TREE_DERIVED.viewportHeight,
              color: Color.fromRGB(170, 196, 220, 0.5),
            }),
            offset: vec(RESEARCH_TREE_DERIVED.viewportWidth - 1, 0),
          },
        ],
      })
    );

    const definitions = this.researchManager.getTreeResearchDefinitions(
      this.selectedTree
    );
    if (definitions.length === 0) {
      root.addChild(
        ResearchPopup.createTextLine(
          10,
          10,
          'No research defined for this tree.',
          14,
          Color.fromHex('#f5c179')
        )
      );
      return;
    }

    const treeAreaWidth = RESEARCH_TREE_DERIVED.viewportWidth - RESEARCH_POPUP_LAYOUT.treeControlColumnWidth;
    const layouts = this.buildTreeLayout(definitions, treeAreaWidth);
    const treeContentHeight =
      layouts.reduce((maxY, layout) => Math.max(maxY, layout.y + RESEARCH_POPUP_LAYOUT.nodeHeight), 0) + 8;
    this.treeMaxScroll = Math.max(0, treeContentHeight - RESEARCH_TREE_DRAW.height);
    this.treeScrollOffset = clamp(this.treeScrollOffset, 0, this.treeMaxScroll);

    const layoutById = new Map<ResearchId, TreeNodeLayout>();
    for (const layout of layouts) {
      layoutById.set(layout.definition.id, layout);
    }

    root.addChild(
      ResearchPopup.createTextLine(
        RESEARCH_TREE_DERIVED.viewportWidth - RESEARCH_POPUP_LAYOUT.treeControlColumnWidth + 3,
        8,
        'Scroll',
        11,
        Color.fromHex('#9fb4c8')
      )
    );

    const scrollUpButton = new ScreenButton({
      x: RESEARCH_TREE_DERIVED.viewportWidth - RESEARCH_POPUP_LAYOUT.treeControlColumnWidth + 6,
      y: 26,
      width: 32,
      height: 22,
      title: '^',
      onClick: () => this.adjustTreeScroll(-RESEARCH_POPUP_LAYOUT.treeScrollStep),
    });
    if (this.treeScrollOffset <= 0) {
      scrollUpButton.toggle(false);
    }
    root.addChild(scrollUpButton);

    const scrollDownButton = new ScreenButton({
      x: RESEARCH_TREE_DERIVED.viewportWidth - RESEARCH_POPUP_LAYOUT.treeControlColumnWidth + 6,
      y: RESEARCH_TREE_DERIVED.viewportHeight - 30,
      width: 32,
      height: 22,
      title: 'v',
      onClick: () => this.adjustTreeScroll(RESEARCH_POPUP_LAYOUT.treeScrollStep),
    });
    if (this.treeScrollOffset >= this.treeMaxScroll) {
      scrollDownButton.toggle(false);
    }
    root.addChild(scrollDownButton);

    const connectorColor = Color.fromHex(
      researchTreeInfo[this.selectedTree].colorHex
    );
    const clipTop = RESEARCH_POPUP_LAYOUT.treeDrawTop;
    const clipBottom = RESEARCH_POPUP_LAYOUT.treeDrawTop + RESEARCH_TREE_DRAW.height;
    for (const layout of layouts) {
      for (const requiredId of layout.definition.requiredResearches) {
        if (!isResearchId(requiredId)) {
          continue;
        }
        const prerequisite = layoutById.get(requiredId);
        if (!prerequisite) {
          continue;
        }
        this.addConnector(
          root,
          prerequisite,
          layout,
          connectorColor,
          this.treeScrollOffset,
          clipTop,
          clipBottom
        );
      }
    }

    const active = this.researchManager.getActiveResearch();
    for (const layout of layouts) {
      const renderY = layout.y - this.treeScrollOffset + RESEARCH_POPUP_LAYOUT.treeDrawTop;
      if (!this.isVisibleY(renderY, RESEARCH_POPUP_LAYOUT.nodeHeight, clipTop, RESEARCH_TREE_DRAW.height)) {
        continue;
      }

      const definition = layout.definition;
      const completed = this.researchManager.isCompleted(definition.id);
      const activeThis = this.researchManager.isActive(definition.id);
      const startStatus = this.researchManager.canStartResearch(definition.id);
      const startable = startStatus.startable;
      const shortDescription = this.getShortNodeDescription(definition.description);

      let statusText = `Turns: ${definition.turns}`;
      let statusColor = Color.fromHex('#cfd9e2');
      let backgroundColor = Color.fromHex('#2a3440');
      let borderColor = Color.fromHex('#667483');

      if (completed) {
        statusText = 'Completed';
        statusColor = Color.fromHex('#9fe6aa');
        backgroundColor = Color.fromHex('#203427');
        borderColor = Color.fromHex('#52b66f');
      } else if (activeThis && active) {
        statusText = `In progress: ${active.remainingTurns} turns left`;
        statusColor = Color.fromHex('#f7dc84');
        backgroundColor = Color.fromHex('#374455');
        borderColor = Color.fromHex('#f1c40f');
      } else if (startable) {
        statusText = 'Ready to start';
        statusColor = Color.fromHex('#9fd3ff');
        backgroundColor = Color.fromHex('#273a4d');
        borderColor = Color.fromHex(researchTreeInfo[this.selectedTree].colorHex);
      } else {
        statusText = active
          ? 'Locked: another research is active'
          : 'Locked';
        statusColor = Color.fromHex('#f5c179');
        backgroundColor = Color.fromHex('#2f343b');
        borderColor = Color.fromHex('#5a6572');
      }

      const card = this.createNodeCard({
        x: layout.x,
        y: renderY,
        title: definition.name,
        subtitle: statusText,
        shortDescription,
        statusColor,
        backgroundColor,
        borderColor,
      });
      this.attachResearchTooltip(card, definition, statusText, statusColor);
      root.addChild(card);

      if (startable) {
        const startButton = new ScreenButton({
          x: layout.x + RESEARCH_POPUP_LAYOUT.nodeWidth - 68,
          y: renderY + 8,
          width: 60,
          height: 22,
          title: 'Start',
          onClick: () => this.startResearch(definition.id),
        });
        root.addChild(startButton);
      }
    }
  }

  private startResearch(id: ResearchId): void {
    const currentTurn = this.turnManager.getTurnDataRef().turnNumber;
    const started = this.researchManager.startResearch(id, currentTurn);
    if (!started) {
      return;
    }
    this.renderAll();
  }

  private adjustTreeScroll(delta: number): void {
    this.tooltipProvider.hide();

    if (this.treeMaxScroll <= 0) {
      return;
    }

    const nextOffset = clamp(this.treeScrollOffset + delta, 0, this.treeMaxScroll);
    if (nextOffset === this.treeScrollOffset) {
      return;
    }

    this.treeScrollOffset = nextOffset;
    this.rebuildTreeRoot();
  }

  private isVisibleY(
    y: number,
    height: number,
    clipTop: number,
    clipHeight: number
  ): boolean {
    const clipBottom = clipTop + clipHeight;
    const yBottom = y + height;
    return y >= clipTop && yBottom <= clipBottom;
  }

  private buildTreeLayout(
    definitions: TypedResearchDefinition[],
    contentWidth: number
  ): TreeNodeLayout[] {
    const definitionsById = new Map<ResearchId, TypedResearchDefinition>();
    for (const definition of definitions) {
      definitionsById.set(definition.id, definition);
    }

    const depthCache = new Map<ResearchId, number>();
    const depthOf = (id: ResearchId): number => {
      const cached = depthCache.get(id);
      if (cached !== undefined) {
        return cached;
      }

      const definition = definitionsById.get(id);
      if (!definition) {
        depthCache.set(id, 0);
        return 0;
      }

      const parentIds = definition.requiredResearches.filter(
        (required) => isResearchId(required) && definitionsById.has(required)
      ) as ResearchId[];
      if (parentIds.length === 0) {
        depthCache.set(id, 0);
        return 0;
      }

      let maxDepth = 0;
      for (const parentId of parentIds) {
        maxDepth = Math.max(maxDepth, depthOf(parentId) + 1);
      }
      depthCache.set(id, maxDepth);
      return maxDepth;
    };

    const grouped = new Map<number, TypedResearchDefinition[]>();
    for (const definition of definitions) {
      const depth = depthOf(definition.id);
      const list = grouped.get(depth) ?? [];
      list.push(definition);
      grouped.set(depth, list);
    }

    const layouts: TreeNodeLayout[] = [];
    const depthLevels = Array.from(grouped.keys()).sort((a, b) => a - b);
    for (const depth of depthLevels) {
      const depthDefinitions = grouped.get(depth) ?? [];
      depthDefinitions.sort((a, b) => a.name.localeCompare(b.name));
      const rowWidth =
        depthDefinitions.length * RESEARCH_POPUP_LAYOUT.nodeWidth +
        Math.max(0, depthDefinitions.length - 1) * RESEARCH_POPUP_LAYOUT.nodeHorizontalGap;
      const startX = Math.max(0, (contentWidth - rowWidth) / 2);
      for (const [index, definition] of depthDefinitions.entries()) {
        layouts.push({
          definition,
          depth,
          x: startX + index * (RESEARCH_POPUP_LAYOUT.nodeWidth + RESEARCH_POPUP_LAYOUT.nodeHorizontalGap),
          y: depth * (RESEARCH_POPUP_LAYOUT.nodeHeight + RESEARCH_POPUP_LAYOUT.nodeVerticalGap),
        });
      }
    }

    return layouts;
  }

  private addConnector(
    root: ScreenElement,
    parent: TreeNodeLayout,
    child: TreeNodeLayout,
    color: Color,
    scrollOffset: number,
    clipTop: number,
    clipBottom: number
  ): void {
    const thickness = 2;
    const parentX = parent.x + RESEARCH_POPUP_LAYOUT.nodeWidth / 2;
    const parentY = parent.y + RESEARCH_POPUP_LAYOUT.nodeHeight - scrollOffset + RESEARCH_POPUP_LAYOUT.treeDrawTop;
    const childX = child.x + RESEARCH_POPUP_LAYOUT.nodeWidth / 2;
    const childY = child.y - scrollOffset + RESEARCH_POPUP_LAYOUT.treeDrawTop;
    const gap = Math.max(1, childY - parentY);
    const preferredEntryStem = 14;
    const maxEntryStem = Math.max(4, gap - 4);
    const entryStem = Math.min(preferredEntryStem, maxEntryStem);

    // Force every connector to enter the child from the top using a
    // dedicated vertical stem near the child node.
    const minTurnY = parentY + 6;
    const maxTurnY = childY - entryStem;
    let turnY = parentY + gap / 2;
    if (maxTurnY >= minTurnY) {
      turnY = clamp(turnY, minTurnY, maxTurnY);
    }

    const verticalTopHeight = Math.max(0, turnY - parentY);
    if (verticalTopHeight > 0) {
      this.addClippedRect(
        root,
        parentX - thickness / 2,
        parentY,
        thickness,
        verticalTopHeight,
        color,
        clipTop,
        clipBottom
      );
    }

    const horizontalWidth = Math.max(0, Math.abs(childX - parentX));
    if (horizontalWidth > 0) {
      this.addClippedRect(
        root,
        Math.min(parentX, childX),
        turnY,
        horizontalWidth,
        thickness,
        color,
        clipTop,
        clipBottom
      );
    }

    const verticalBottomHeight = Math.max(0, childY - turnY);
    if (verticalBottomHeight > 0) {
      this.addClippedRect(
        root,
        childX - thickness / 2,
        turnY,
        thickness,
        verticalBottomHeight,
        color,
        clipTop,
        clipBottom
      );
    }
  }

  private addClippedRect(
    root: ScreenElement,
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    clipTop: number,
    clipBottom: number
  ): void {
    if (height <= 0 || width <= 0) {
      return;
    }

    const top = Math.max(y, clipTop);
    const bottom = Math.min(y + height, clipBottom);
    const clippedHeight = bottom - top;
    if (clippedHeight <= 0) {
      return;
    }

    root.addChild(this.createRectElement(x, top, width, clippedHeight, color));
  }

  private createNodeCard(options: {
    x: number;
    y: number;
    title: string;
    subtitle: string;
    shortDescription: string[];
    statusColor: Color;
    backgroundColor: Color;
    borderColor: Color;
  }): ScreenElement {
    const card = new ScreenElement({ x: options.x, y: options.y });
    const members: GraphicsGrouping[] = [
      {
        graphic: new Rectangle({
          width: RESEARCH_POPUP_LAYOUT.nodeWidth,
          height: RESEARCH_POPUP_LAYOUT.nodeHeight,
          color: options.backgroundColor,
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: RESEARCH_POPUP_LAYOUT.nodeWidth,
          height: 2,
          color: options.borderColor,
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: RESEARCH_POPUP_LAYOUT.nodeWidth,
          height: 2,
          color: options.borderColor,
        }),
        offset: vec(0, RESEARCH_POPUP_LAYOUT.nodeHeight - 2),
      },
      {
        graphic: new Rectangle({
          width: 2,
          height: RESEARCH_POPUP_LAYOUT.nodeHeight,
          color: options.borderColor,
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: 2,
          height: RESEARCH_POPUP_LAYOUT.nodeHeight,
          color: options.borderColor,
        }),
        offset: vec(RESEARCH_POPUP_LAYOUT.nodeWidth - 2, 0),
      },
      {
        graphic: new Text({
          text: options.title,
          font: new Font({
            size: 13,
            unit: FontUnit.Px,
            color: Color.fromHex('#f0f4f8'),
          }),
        }),
        offset: vec(8, 8),
      },
      {
        graphic: new Text({
          text: options.subtitle,
          font: new Font({
            size: 12,
            unit: FontUnit.Px,
            color: options.statusColor,
          }),
        }),
        offset: vec(8, 27),
      },
    ];

    if (options.shortDescription[0]) {
      members.push({
        graphic: new Text({
          text: options.shortDescription[0],
          font: new Font({
            size: 11,
            unit: FontUnit.Px,
            color: Color.fromHex('#b9c9d8'),
          }),
        }),
        offset: vec(8, 45),
      });
    }
    if (options.shortDescription[1]) {
      members.push({
        graphic: new Text({
          text: options.shortDescription[1],
          font: new Font({
            size: 11,
            unit: FontUnit.Px,
            color: Color.fromHex('#9fb4c8'),
          }),
        }),
        offset: vec(8, 59),
      });
    }

    card.graphics.use(new GraphicsGroup({ members }));
    return card;
  }

  private getShortNodeDescription(text: string): string[] {
    const maxWidth = RESEARCH_POPUP_LAYOUT.nodeWidth - 16;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return ['', ''];
    }

    const firstLine = this.fitLineByWidth(words, maxWidth, 11);
    if (firstLine.usedWords >= words.length) {
      return [firstLine.text, ''];
    }

    const secondLineSource = words.slice(firstLine.usedWords).join(' ');
    return [firstLine.text, this.ellipsis(secondLineSource, maxWidth, 11)];
  }

  private fitLineByWidth(
    words: string[],
    maxWidth: number,
    fontSize: number
  ): { text: string; usedWords: number } {
    let line = '';
    let usedWords = 0;

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (
        measureTextWidth(next, fontSize) <= maxWidth ||
        (line.length === 0 && usedWords === 0)
      ) {
        line = next;
        usedWords++;
        continue;
      }
      break;
    }

    return { text: line, usedWords };
  }

  private ellipsis(text: string, width: number, fontSize: number): string {
    const suffix = '...';
    if (measureTextWidth(text, fontSize) <= width) {
      return text;
    }

    let candidate = text.trim();
    while (candidate.length > 1) {
      const next = `${candidate}${suffix}`;
      if (measureTextWidth(next, fontSize) <= width) {
        return next;
      }
      candidate = candidate.slice(0, -1).trimEnd();
    }
    return suffix;
  }

  private attachResearchTooltip(
    card: ScreenElement,
    definition: TypedResearchDefinition,
    statusText: string,
    statusColor: Color
  ): void {
    card.pointer.useGraphicsBounds = true;
    card.pointer.useColliderShape = false;
    card.on('pointerenter', () => {
      this.tooltipProvider.show({
        owner: card,
        getAnchorRect: () => ({
          x: card.globalPos.x,
          y: card.globalPos.y,
          width: RESEARCH_POPUP_LAYOUT.nodeWidth,
          height: RESEARCH_POPUP_LAYOUT.nodeHeight,
        }),
        header: definition.name,
        description: definition.description,
        outcomes: this.getResearchTooltipOutcomes(
          definition,
          statusText,
          statusColor
        ),
        width: 360,
        placement: 'right',
      });
    });
    card.on('pointerleave', () => {
      this.tooltipProvider.hide(card);
    });
    card.on('prekill', () => {
      this.tooltipProvider.hide(card);
    });
  }

  private getResearchTooltipOutcomes(
    definition: TypedResearchDefinition,
    statusText: string,
    statusColor: Color
  ): TooltipOutcome[] {
    const prerequisiteNames = definition.requiredResearches
      .filter((id) => isResearchId(id))
      .map(
        (id) => this.researchManager.getResearchDefinitionById(id)?.name ?? id
      );
    return [
      {
        label: 'Duration',
        value: `${definition.turns} turns`,
      },
      {
        label: 'Prerequisites',
        value:
          prerequisiteNames.length > 0
            ? prerequisiteNames.join(', ')
            : 'None',
      },
      {
        label: '',
        value: statusText,
        color: statusColor,
      },
    ];
  }

  private createRectElement(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color
  ): ScreenElement {
    const line = new ScreenElement({ x, y });
    line.graphics.use(
      new Rectangle({
        width,
        height,
        color,
      })
    );
    return line;
  }

  private static createTextLine(
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

