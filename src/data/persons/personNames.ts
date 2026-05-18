import type { PersonClass } from '../../_common/models/person.models';
import type { SeededRandom } from '../../_common/random';

const rulerNames = [
  'Aldric', 'Bertrand', 'Cedric', 'Dorian', 'Edmund', 'Fabian',
  'Gareth', 'Hadrian', 'Isolde', 'Juliana', 'Kasimir', 'Lavinia',
  'Magnus', 'Nadia', 'Oswald', 'Philippa', 'Quintus', 'Rowena',
  'Sigmund', 'Tatiana',
];

const nobleNames = [
  'Aldous', 'Beatrix', 'Conrad', 'Delia', 'Eustace', 'Flavia',
  'Godfrey', 'Helena', 'Ingram', 'Jessamine', 'Konrad', 'Lucia',
  'Malvin', 'Nerissa', 'Osbert', 'Petra', 'Rosamund', 'Silvain',
  'Tobias', 'Ursula', 'Valerian', 'Winifred',
];

const peasantNames = [
  'Aldwin', 'Berta', 'Cole', 'Dora', 'Edgar', 'Finn', 'Greta',
  'Hilda', 'Ivan', 'Jana', 'Karl', 'Lena', 'Marta', 'Ned',
  'Olga', 'Peter', 'Rosa', 'Stefan', 'Tilda', 'Ulrich',
  'Vera', 'Walter', 'Yda', 'Zara',
];

const beggarNames = [
  'Ash', 'Bram', 'Crix', 'Dag', 'Esk', 'Fenn', 'Grix', 'Hob',
  'Jem', 'Kip', 'Lox', 'Mab', 'Nix', 'Odo', 'Peg', 'Rix',
  'Sly', 'Tab', 'Ulf', 'Wex',
];

const namePools: Record<PersonClass, string[]> = {
  ruler: rulerNames,
  noble: nobleNames,
  peasant: peasantNames,
  beggar: beggarNames,
};

export function generateName(personClass: PersonClass, rng: SeededRandom): string {
  const pool = namePools[personClass];
  return pool[rng.randomInt(0, pool.length - 1)];
}
