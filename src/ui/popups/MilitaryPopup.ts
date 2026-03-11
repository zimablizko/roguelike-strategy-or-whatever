import { Color, Font, FontUnit, ScreenElement, Sprite, Text } from 'excalibur';
import { getResourceIcon as getResourceIconFn } from '../../_common/icons';
import type {
  MilitaryTaskType,
  UnitDefinition,
  UnitRole,
} from '../../_common/models/military.models';
import type { ResourceType } from '../../_common/models/resource.models';
import type { TooltipOutcome } from '../../_common/models/tooltip.models';
import type { MilitaryPopupOptions } from '../../_common/models/ui.models';
import {
  BARRACKS_GARRISON_PER_INSTANCE,
  BARRACKS_TRAINING_SLOTS_PER_INSTANCE,
  getAllUnitDefinitions,
} from '../../data/military';
import { BuildingManager } from '../../managers/BuildingManager';
import { MilitaryManager } from '../../managers/MilitaryManager';
import { ResourceManager } from '../../managers/ResourceManager';
import { UI_Z } from '../constants/ZLayers';
import { ScreenButton } from '../elements/ScreenButton';
import { ScreenPopup } from '../elements/ScreenPopup';
import { TooltipProvider } from '../tooltip/TooltipProvider';

/**
 * Dedicated popup for military overview, training, and assignments.
 */
export class MilitaryPopup extends ScreenPopup {
  private militaryManager: MilitaryManager;
  private buildingManager: BuildingManager;
  private resourceManager: ResourceManager;
  private tooltipProvider: TooltipProvider;
  private contentRootRef?: ScreenElement;
  private bodyRoot?: ScreenElement;
  private trainButtons: ScreenButton[] = [];
  private lastVersion = -1;
  private lastResourceVersion = -1;

  constructor(options: MilitaryPopupOptions) {
    super({
      x: options.x,
      y: options.y,
      anchor: options.anchor ?? 'center',
      width: 580,
      height: 640,
      title: 'Military',
      z: UI_Z.statePopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      bgColor: Color.fromHex('#1a1f2a'),
      headerColor: Color.fromHex('#2a1520'),
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.contentRootRef = contentRoot;
        this.renderBody();
      },
    });

    this.militaryManager = options.militaryManager;
    this.buildingManager = options.buildingManager;
    this.resourceManager = options.resourceManager;
    this.tooltipProvider = options.tooltipProvider;
  }

  onPreUpdate(): void {
    super.onPreUpdate();
    const milVer = this.militaryManager.getMilitaryVersion();
    const resVer = this.resourceManager.getResourcesVersion();
    if (milVer !== this.lastVersion || resVer !== this.lastResourceVersion) {
      this.lastVersion = milVer;
      this.lastResourceVersion = resVer;
      this.renderBody();
    }
  }

  private renderBody(): void {
    const contentRoot = this.contentRootRef;
    if (!contentRoot) return;

    // Clean up old tooltip registrations
    for (const btn of this.trainButtons) {
      this.tooltipProvider.hide(btn);
    }
    this.trainButtons = [];

    if (this.bodyRoot && !this.bodyRoot.isKilled()) {
      this.bodyRoot.kill();
    }

    const body = new ScreenElement({ x: 0, y: 0 });
    contentRoot.addChild(body);
    this.bodyRoot = body;

    const snapshot = this.militaryManager.getSnapshot();
    const titleColor = Color.fromHex('#f0f4f8');
    const muted = Color.fromHex('#b0bcc8');
    const warnColor = Color.fromHex('#f5c179');

    let y = 0;
    const addLine = (
      text: string,
      size: number,
      color: Color,
      gapAfter = 5
    ) => {
      body.addChild(MilitaryPopup.createLine(0, y, text, size, color));
      y += size + gapAfter;
    };

    // ─── Overview ──────────────────────────────────────────────
    addLine(`Total Military Power: ${snapshot.totalPower}`, 18, titleColor, 10);

    const barracksCount = this.buildingManager.getBuildingCount('barracks');
    const trainingCap = barracksCount * BARRACKS_TRAINING_SLOTS_PER_INSTANCE;
    const usedSlots = this.militaryManager.getTrainingSlotUsage();
    const garrisonCap = barracksCount * BARRACKS_GARRISON_PER_INSTANCE;
    const garrisonUsed = this.militaryManager.getGarrisonUsage();
    addLine(
      `Barracks: ${barracksCount}  |  Training Slots: ${usedSlots}/${trainingCap}  |  Garrison: ${garrisonUsed}/${garrisonCap}`,
      13,
      muted,
      6
    );
    addLine(
      `Available: ${snapshot.availableCount}  |  Assigned: ${snapshot.assignedCount}  |  Training: ${snapshot.trainingCount}`,
      13,
      muted,
      12
    );

    // ─── Roster composition ────────────────────────────────────
    addLine('Unit Roster', 16, titleColor, 8);

    const allDefs = getAllUnitDefinitions();
    let hasAny = false;
    for (const def of allDefs) {
      const count = this.militaryManager.getUnitCount(def.id);
      if (count === 0) continue;
      hasAny = true;
      const available = this.militaryManager.getUnitCount(def.id, 'available');
      const assigned = this.militaryManager.getUnitCount(def.id, 'assigned');
      const training = this.militaryManager.getUnitCount(def.id, 'training');
      const parts: string[] = [];
      if (available > 0) parts.push(`${available} avail`);
      if (assigned > 0) parts.push(`${assigned} assigned`);
      if (training > 0) parts.push(`${training} training`);
      addLine(
        `  ${def.name}: ${count}  (${parts.join(', ')})`,
        13,
        Color.fromHex('#dce6ef'),
        4
      );
    }
    if (!hasAny) {
      addLine('  No units yet.', 13, muted, 4);
    }
    y += 8;

    // ─── Training queue ────────────────────────────────────────
    addLine('Training Queue', 16, titleColor, 8);

    const queue = this.militaryManager.getTrainingQueue();
    if (queue.length === 0) {
      addLine('  Queue empty.', 13, muted, 4);
    } else {
      for (const order of queue) {
        const def = allDefs.find((d) => d.id === order.unitId);
        const name = def?.name ?? order.unitId;
        addLine(
          `  ${order.count}x ${name} — ${order.turnsLeft} turn${order.turnsLeft !== 1 ? 's' : ''} left`,
          13,
          Color.fromHex('#dce6ef'),
          4
        );
      }
    }
    y += 8;

    // ─── Assignments summary ───────────────────────────────────
    addLine('Active Assignments', 16, titleColor, 8);

    const assignments = this.militaryManager.getAssignments();
    if (assignments.length === 0) {
      addLine('  No active assignments.', 13, muted, 4);
    } else {
      for (const assignment of assignments) {
        const totalAllocated = Object.values(assignment.allocatedUnits).reduce(
          (sum, n) => sum + (n ?? 0),
          0
        );
        const label = MilitaryPopup.formatTaskType(assignment.taskType);

        // Assignment text + inline recall button
        body.addChild(
          MilitaryPopup.createLine(
            0,
            y,
            `  ${label} — ${totalAllocated} units  (risk: ${assignment.risk})`,
            13,
            Color.fromHex('#dce6ef')
          )
        );

        const recallBtn = new ScreenButton({
          x: 420,
          y,
          width: 80,
          height: 20,
          title: 'Recall',
          idleBgColor: Color.fromHex('#6b4040'),
          onClick: () => {
            this.militaryManager.removeAssignment(assignment.assignmentId);
          },
        });
        body.addChild(recallBtn);
        this.trainButtons.push(recallBtn);

        recallBtn.on('pointerenter', () => {
          this.tooltipProvider.show({
            owner: recallBtn,
            getAnchorRect: () => ({
              x: recallBtn.globalPos.x,
              y: recallBtn.globalPos.y,
              width: recallBtn.buttonWidth,
              height: recallBtn.buttonHeight,
            }),
            description:
              'Recall units back to available pool. They will not engage threats this turn.',
            width: 240,
          });
        });
        recallBtn.on('pointerleave', () => {
          this.tooltipProvider.hide(recallBtn);
        });
        recallBtn.on('prekill', () => {
          this.tooltipProvider.hide(recallBtn);
        });

        y += 22;
      }
    }
    y += 12;

    // ─── Train buttons ─────────────────────────────────────────
    if (barracksCount > 0) {
      addLine('Train Units', 16, titleColor, 8);

      const freeSlots = this.militaryManager.getAvailableTrainingSlots();
      const freeGarrison = this.militaryManager.getAvailableGarrisonSlots();
      let btnX = 0;
      const BTN_W = 125;
      const BTN_H = 32;
      const BTN_GAP = 8;

      for (const def of allDefs) {
        // Check tech prerequisite
        const techsMet = def.requiredTechnologies.every((t) =>
          this.buildingManager.isTechnologyUnlocked(t)
        );
        if (!techsMet) continue;

        const cost = this.militaryManager.getTrainingCost(def.id, 1);
        const canAfford = cost ? this.resourceManager.canAfford(cost) : false;
        const hasSlot = freeSlots >= 1;
        const hasGarrison = freeGarrison >= 1;
        const enabled = canAfford && hasSlot && hasGarrison;

        const btn = new ScreenButton({
          x: btnX,
          y,
          width: BTN_W,
          height: BTN_H,
          title: `${def.name}`,
          idleBgColor: enabled
            ? Color.fromHex('#4a6fa5')
            : Color.fromHex('#3a3a4a'),
          onClick: () => {
            if (!enabled) return;
            this.trainUnit(def.id);
          },
        });
        if (!enabled) {
          btn.toggle(false);
        }
        body.addChild(btn);

        // Tooltip with description, stats, and costs
        const tooltipOutcomes = this.buildUnitTooltipOutcomes(
          def,
          cost,
          hasSlot,
          hasGarrison
        );
        const tooltipDesc = this.buildUnitTooltipDescription(
          def,
          hasSlot,
          hasGarrison
        );
        btn.on('pointerenter', () => {
          this.tooltipProvider.show({
            owner: btn,
            getAnchorRect: () => ({
              x: btn.globalPos.x,
              y: btn.globalPos.y,
              width: btn.buttonWidth,
              height: btn.buttonHeight,
            }),
            header: def.name,
            description: tooltipDesc,
            outcomes: tooltipOutcomes,
            width: 300,
            placement: 'right',
          });
        });
        btn.on('pointerleave', () => {
          this.tooltipProvider.hide(btn);
        });
        btn.on('prekill', () => {
          this.tooltipProvider.hide(btn);
        });
        this.trainButtons.push(btn);

        btnX += BTN_W + BTN_GAP;
        // Wrap to next row if past panel width
        if (btnX + BTN_W > 540) {
          btnX = 0;
          y += BTN_H + BTN_GAP;
        }
      }
    } else {
      addLine(
        'Build a Barracks to train units (requires Drill Doctrine).',
        13,
        warnColor,
        4
      );
    }
    y += 12;

    // ─── Active Threats ────────────────────────────────────────
    const threats = this.militaryManager.getThreats();
    addLine('Active Threats', 16, titleColor, 8);

    if (threats.length === 0) {
      addLine('  No threats detected.', 13, muted, 4);
    } else {
      for (const threat of threats) {
        const counterLabel = MilitaryPopup.formatTaskType(threat.counterTask);
        const hasAssignment = this.militaryManager
          .getAssignments()
          .some((a) => a.taskType === threat.counterTask);

        addLine(
          `  ${threat.name}  —  Power: ${threat.enemyPower}  |  ${threat.turnsLeft} turn${threat.turnsLeft !== 1 ? 's' : ''} left`,
          13,
          Color.fromHex('#f5a0a0'),
          2
        );

        if (hasAssignment) {
          addLine(
            `    Response deployed (${counterLabel})`,
            12,
            Color.fromHex('#9fe6aa'),
            6
          );
        } else {
          const snapshot = this.militaryManager.getSnapshot();
          const canDeploy = snapshot.availableCount > 0;
          const btn = new ScreenButton({
            x: 20,
            y,
            width: 130,
            height: 26,
            title: `Deploy ${counterLabel}`,
            idleBgColor: canDeploy
              ? Color.fromHex('#8b5c3e')
              : Color.fromHex('#3a3a4a'),
            onClick: () => {
              if (!canDeploy) return;
              this.deployAgainstThreat(threat.counterTask);
            },
          });
          if (!canDeploy) {
            btn.toggle(false);
          }
          body.addChild(btn);
          this.trainButtons.push(btn); // reuse array for cleanup

          btn.on('pointerenter', () => {
            this.tooltipProvider.show({
              owner: btn,
              getAnchorRect: () => ({
                x: btn.globalPos.x,
                y: btn.globalPos.y,
                width: btn.buttonWidth,
                height: btn.buttonHeight,
              }),
              description: canDeploy
                ? `Assign all available units to ${counterLabel}. Units will engage the threat at end of turn.`
                : 'No available units to deploy.',
              width: 260,
            });
          });
          btn.on('pointerleave', () => {
            this.tooltipProvider.hide(btn);
          });
          btn.on('prekill', () => {
            this.tooltipProvider.hide(btn);
          });

          y += 32;
        }
      }
    }
    y += 8;

    // ─── Last Turn Outcomes ────────────────────────────────────
    const outcomes = this.militaryManager.getLastOutcomes();
    if (outcomes.length > 0) {
      y += 4;
      addLine('Last Turn Results', 16, titleColor, 8);

      for (const outcome of outcomes) {
        const resultText = outcome.victory ? 'VICTORY' : 'DEFEAT';
        const resultColor = outcome.victory
          ? Color.fromHex('#9fe6aa')
          : Color.fromHex('#f5a0a0');

        addLine(`  ${outcome.threatName}: ${resultText}`, 14, resultColor, 2);
        addLine(
          `    Power: ${outcome.playerPower} vs ${outcome.enemyPower}`,
          12,
          muted,
          2
        );

        // Casualties
        const casualtyParts: string[] = [];
        for (const [unitId, count] of Object.entries(outcome.casualties)) {
          if (count && count > 0) casualtyParts.push(`${count}x ${unitId}`);
        }
        if (casualtyParts.length > 0) {
          addLine(
            `    Casualties: ${casualtyParts.join(', ')}`,
            12,
            Color.fromHex('#f5c179'),
            2
          );
        }

        // Resource losses
        const lossParts: string[] = [];
        for (const [res, amount] of Object.entries(outcome.resourceLosses)) {
          if (amount && amount > 0) lossParts.push(`${amount} ${res}`);
        }
        if (lossParts.length > 0) {
          addLine(
            `    Losses: ${lossParts.join(', ')}`,
            12,
            Color.fromHex('#f5a0a0'),
            2
          );
        }

        // Specialist bonuses
        if (outcome.specialistBonuses.length > 0) {
          addLine(
            `    Bonuses: ${outcome.specialistBonuses.join('; ')}`,
            12,
            Color.fromHex('#a0c4f5'),
            2
          );
        }

        y += 4;
      }
    }
  }

  private trainUnit(unitId: UnitRole): void {
    const cost = this.militaryManager.getTrainingCost(unitId, 1);
    if (!cost || !this.resourceManager.canAfford(cost)) return;
    this.resourceManager.spendResources(cost);
    this.militaryManager.enqueueTraining(unitId, 1);
  }

  /**
   * Auto-allocate all available units to a counter-task assignment.
   */
  private deployAgainstThreat(taskType: MilitaryTaskType): void {
    const allDefs = getAllUnitDefinitions();
    const allocatedUnits: Partial<Record<UnitRole, number>> = {};
    let anyAllocated = false;

    for (const def of allDefs) {
      const available = this.militaryManager.getUnitCount(def.id, 'available');
      if (available > 0) {
        allocatedUnits[def.id] = available;
        anyAllocated = true;
      }
    }

    if (!anyAllocated) return;
    this.militaryManager.createAssignment(taskType, allocatedUnits);
  }

  private buildUnitTooltipDescription(
    def: UnitDefinition,
    hasSlot: boolean,
    hasGarrison: boolean
  ): string {
    const warnings: string[] = [];
    if (!hasSlot) {
      warnings.push('No free training slots.');
    }
    if (!hasGarrison) {
      warnings.push('Garrison full — build more Barracks.');
    }
    return warnings.length > 0
      ? `${def.description}\n\n${warnings.join('\n')}`
      : def.description;
  }

  private buildUnitTooltipOutcomes(
    def: UnitDefinition,
    cost: Partial<Record<ResourceType, number>> | undefined,
    hasSlot: boolean,
    hasGarrison: boolean
  ): TooltipOutcome[] {
    const okColor = Color.fromHex('#9fe6aa');
    const badColor = Color.fromHex('#f2b0a6');
    const neutralColor = Color.fromHex('#dce6ef');
    const outcomes: TooltipOutcome[] = [];

    // Stats
    outcomes.push({
      label: 'Power',
      value: `${def.power}`,
      color: neutralColor,
    });
    outcomes.push({
      label: 'Training',
      value: `${def.trainingTime} turn${def.trainingTime !== 1 ? 's' : ''}`,
      color: neutralColor,
    });

    // Upkeep (with resource icons)
    const upkeepKeys: ResourceType[] = [
      'gold',
      'wood',
      'stone',
      'wheat',
      'meat',
      'bread',
      'population',
    ];
    const upkeepOutcomes: TooltipOutcome[] = [];
    for (const key of upkeepKeys) {
      const amount = (def.upkeep as Record<string, number>)[key];
      if (amount === undefined || amount <= 0) continue;
      upkeepOutcomes.push({
        label: '',
        icon: MilitaryPopup.getResourceIcon(key),
        value: `${amount}`,
        color: neutralColor,
        inline: true,
        iconAfter: true,
      });
    }
    if (upkeepOutcomes.length > 0) {
      upkeepOutcomes[0].label = 'Upkeep/turn';
      outcomes.push(...upkeepOutcomes);
    }

    // Costs (with resource icons, inline group)
    const costOutcomes: TooltipOutcome[] = [];
    const keys: ResourceType[] = [
      'gold',
      'wood',
      'stone',
      'wheat',
      'meat',
      'bread',
      'population',
    ];
    if (cost) {
      for (const key of keys) {
        const amount = cost[key];
        if (amount === undefined || amount <= 0) continue;
        const have = this.resourceManager.getResource(key);
        const missing = Math.max(0, amount - have);
        costOutcomes.push({
          label: '',
          icon: MilitaryPopup.getResourceIcon(key),
          value: missing > 0 ? `${amount} (-${missing})` : `${amount}`,
          color: missing > 0 ? badColor : okColor,
          inline: true,
        });
      }
    }
    if (costOutcomes.length === 0) {
      outcomes.push({ label: 'Costs', value: 'Free', color: okColor });
    } else {
      costOutcomes[0].label = 'Costs';
      outcomes.push(...costOutcomes);
    }

    // Slot / garrison warnings
    if (!hasSlot) {
      outcomes.push({
        label: 'Slots',
        value: 'No free training slots',
        color: badColor,
      });
    }
    if (!hasGarrison) {
      outcomes.push({
        label: 'Garrison',
        value: 'Garrison full',
        color: badColor,
      });
    }

    return outcomes;
  }

  private static getResourceIcon(
    resourceType: ResourceType
  ): Sprite | undefined {
    return getResourceIconFn(resourceType);
  }

  private static formatTaskType(type: string): string {
    switch (type) {
      case 'border-defense':
        return 'Border Defense';
      case 'anti-raid':
        return 'Anti-Raid';
      case 'campaign':
        return 'Campaign';
      case 'suppress-revolt':
        return 'Suppress Revolt';
      default:
        return type;
    }
  }

  private static createLine(
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
        font: new Font({ size, unit: FontUnit.Px, color }),
      })
    );
    return el;
  }
}
