import { Color, Font, FontUnit, ScreenElement, Text } from 'excalibur';
import type { Person, PersonClass } from '../../_common/models/person.models';
import type { UnitRole } from '../../_common/models/military.models';
import type { TooltipOutcome } from '../../_common/models/tooltip.models';
import { FONT_FAMILY } from '../../_common/text';
import type { BuildingManager } from '../../managers/BuildingManager';
import type { GameLogManager } from '../../managers/GameLogManager';
import type { MilitaryManager } from '../../managers/MilitaryManager';
import type { PersonManager } from '../../managers/PersonManager';
import type { ResourceManager } from '../../managers/ResourceManager';
import type { TurnManager } from '../../managers/TurnManager';
import type { SeededRandom } from '../../_common/random';
import { UI_Z } from '../constants/ZLayers';
import { ActionElement } from '../elements/ActionElement';
import { ScreenPopup } from '../elements/ScreenPopup';
import { buildTooltipResourceSection } from '../tooltip/TooltipResourceSection';
import { TooltipProvider } from '../tooltip/TooltipProvider';

export interface NpcPopupOptions {
  x: number;
  y: number;
  personId: string;
  personManager: PersonManager;
  buildingManager: BuildingManager;
  resourceManager: ResourceManager;
  turnManager: TurnManager;
  militaryManager: MilitaryManager;
  logManager: GameLogManager;
  tooltipProvider: TooltipProvider;
  rng: SeededRandom;
  onClose?: () => void;
}

const CLASS_COLORS: Record<PersonClass, string> = {
  ruler: '#f7d87c',
  noble: '#c9a0f7',
  peasant: '#9fe6aa',
  beggar: '#c07070',
};

const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 320;

export class NpcPopup extends ScreenPopup {
  private readonly opts: NpcPopupOptions;
  private bodyRoot?: ScreenElement;

  constructor(options: NpcPopupOptions) {
    const person = options.personManager.getPersonById(options.personId);
    const title = person ? `${person.name} [${capitalize(person.class)}]` : 'Unknown Person';

    super({
      x: options.x,
      y: options.y,
      anchor: 'center',
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      title,
      z: UI_Z.modalPopup,
      backplateStyle: 'gray',
      closeOnBackplateClick: true,
      onClose: options.onClose,
      contentBuilder: (contentRoot) => {
        this.buildContent(contentRoot);
      },
    });

    this.opts = options;
  }

  private buildContent(contentRoot: ScreenElement): void {
    if (this.bodyRoot && !this.bodyRoot.isKilled()) this.bodyRoot.kill();
    const body = new ScreenElement({ x: 0, y: 0 });
    contentRoot.addChild(body);
    this.bodyRoot = body;

    const person = this.opts.personManager.getPersonById(this.opts.personId);
    if (!person) {
      body.addChild(makeLine(0, 0, 'Person not found.', 14, Color.fromHex('#c07070')));
      return;
    }

    const classColor = Color.fromHex(CLASS_COLORS[person.class]);

    let y = 0;
    const addLine = (text: string, size: number, color: Color, gap = 6) => {
      body.addChild(makeLine(0, y, text, size, color));
      y += size + gap;
    };

    addLine(`Class: ${capitalize(person.class)}`, 14, classColor, 4);

    const occupation = person.occupation ? capitalize(person.occupation) : 'Unemployed';
    addLine(`Occupation: ${occupation}`, 14, Color.fromHex('#b0bcc8'), 4);

    const housingLabel = this.getHousingLabel(person);
    addLine(`Housing: ${housingLabel}`, 14, Color.fromHex('#b0bcc8'), 12);

    if (person.class === 'ruler') {
      addLine('(No ruler actions available)', 13, Color.fromHex('#8fa8c0'));
      return;
    }

    addLine('Ruler Actions:', 15, Color.fromHex('#f0f4f8'), 8);

    const btnW = POPUP_WIDTH - 28;
    const gap = 6;

    body.addChild(this.makeActionEl(0, y, btnW,
      'Rename',
      'Generate a new random name for this person.',
      [],
      () => this.doRename(person)
    ));
    y += 34 + gap;

    if (person.class === 'peasant') {
      const canAfford = this.canAffordPromote();
      const pp = this.opts.resourceManager.getResource('politicalPower');
      const focus = this.opts.turnManager.getTurnDataRef().focus.current;
      body.addChild(this.makeActionEl(0, y, btnW,
        'Promote to Noble',
        canAfford
          ? 'Elevate this person to the noble class.'
          : `Need 5 Political Power (have ${pp}) and 1 Focus (have ${focus}).`,
        buildTooltipResourceSection('Costs', [
          { resourceType: 'politicalPower', amount: 5, available: pp },
          { resourceType: 'focus', amount: 1, available: focus },
        ]),
        canAfford ? () => this.doPromote(person) : undefined
      ));
      y += 34 + gap;
    }

    if (person.class === 'noble') {
      const focus = this.opts.turnManager.getTurnDataRef().focus.current;
      const canAfford = focus >= 1;
      body.addChild(this.makeActionEl(0, y, btnW,
        'Demote to Peasant',
        canAfford
          ? 'Lower this noble to peasant class.'
          : `Need 1 Focus (have ${focus}).`,
        buildTooltipResourceSection('Costs', [
          { resourceType: 'focus', amount: 1, available: focus },
        ]),
        canAfford ? () => this.doDemote(person) : undefined
      ));
      y += 34 + gap;
    }

    const focus = this.opts.turnManager.getTurnDataRef().focus.current;
    const canExecute = focus >= 2;
    body.addChild(this.makeActionEl(0, y, btnW,
      'Execute / Exile',
      canExecute
        ? 'Permanently remove this person from the settlement.'
        : `Need 2 Focus (have ${focus}).`,
      buildTooltipResourceSection('Costs', [
        { resourceType: 'focus', amount: 2, available: focus },
      ]),
      canExecute ? () => this.doExecute(person) : undefined
    ));
  }

  private getHousingLabel(person: Person): string {
    if (!person.housingInstanceId) return 'Homeless';
    const instances = this.opts.buildingManager.getBuildingInstances();
    const inst = instances.find((i) => i.instanceId === person.housingInstanceId);
    if (!inst) return 'Unknown';
    return capitalize(inst.buildingId);
  }

  private canAffordPromote(): boolean {
    const pp = this.opts.resourceManager.getResource('politicalPower');
    const focus = this.opts.turnManager.getTurnDataRef().focus.current;
    return pp >= 5 && focus >= 1;
  }

  private doRename(person: Person): void {
    this.opts.personManager.rename(person.id, this.opts.rng);
    this.opts.logManager.addNeutral(`${person.name} was renamed.`);
    this.close();
  }

  private doPromote(person: Person): void {
    this.opts.resourceManager.addResource('politicalPower', -5);
    this.opts.turnManager.spendFocus(1);
    this.opts.personManager.setClass(person.id, 'noble');
    this.opts.personManager.reallocateHousing(
      this.opts.buildingManager.getBuildingInstances()
    );
    this.opts.logManager.addGood(`${person.name} promoted to Noble.`);
    this.close();
  }

  private doDemote(person: Person): void {
    this.opts.turnManager.spendFocus(1);
    this.opts.personManager.setClass(person.id, 'peasant');
    this.opts.personManager.reallocateHousing(
      this.opts.buildingManager.getBuildingInstances()
    );
    this.opts.logManager.addNeutral(`${person.name} demoted to Peasant.`);
    this.close();
  }

  private doExecute(person: Person): void {
    this.opts.turnManager.spendFocus(2);

    if (person.buildingInstanceId) {
      this.opts.buildingManager.removeWorker(person.buildingInstanceId);
    }
    if (person.unitRole) {
      this.opts.militaryManager.removeUnits(person.unitRole as UnitRole, 1);
    }

    this.opts.personManager.removePerson(person.id);
    this.opts.personManager.reallocateHousing(
      this.opts.buildingManager.getBuildingInstances()
    );
    this.opts.logManager.addBad(`${person.name} was executed/exiled.`);
    this.close();
  }

  private makeActionEl(
    x: number,
    y: number,
    width: number,
    title: string,
    description: string,
    outcomes: TooltipOutcome[],
    onClick?: () => void
  ): ActionElement {
    const enabled = !!onClick;
    return new ActionElement({
      x, y, width, height: 34,
      title, description, outcomes,
      tooltipProvider: this.opts.tooltipProvider,
      bgColor: enabled ? Color.fromHex('#274158') : Color.fromHex('#2a2f35'),
      hoverBgColor: enabled ? Color.fromHex('#356083') : Color.fromHex('#2a2f35'),
      pressedBgColor: enabled ? Color.fromHex('#2e5270') : Color.fromHex('#2a2f35'),
      hoverBorderColor: enabled ? Color.fromHex('#f1c40f') : Color.fromHex('#555d66'),
      textColor: enabled ? Color.White : Color.fromHex('#8b97a3'),
      tooltipWidth: 240,
      onClick,
    });
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function makeLine(x: number, y: number, text: string, size: number, color: Color): ScreenElement {
  const el = new ScreenElement({ x, y });
  el.graphics.use(new Text({
    text,
    font: new Font({ size, unit: FontUnit.Px, color, family: FONT_FAMILY }),
  }));
  return el;
}
