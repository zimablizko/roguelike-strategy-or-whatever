export type PersonClass = 'ruler' | 'noble' | 'peasant' | 'beggar';

export type PersonOccupation =
  | 'farmer'
  | 'woodcutter'
  | 'miner'
  | 'fisherman'
  | 'hunter'
  | 'baker'
  | 'merchant'
  | 'militia'
  | 'footman'
  | 'archer'
  | 'spy'
  | 'engineer'
  | null;

export interface Person {
  id: string;
  name: string;
  class: PersonClass;
  occupation: PersonOccupation;
  buildingInstanceId?: string;
  housingInstanceId?: string;
  unitRole?: string;
}

export interface PersonSaveState {
  people: Person[];
  serial: number;
}
