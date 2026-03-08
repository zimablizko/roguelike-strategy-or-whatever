import { ImageSource, Loader } from 'excalibur';
import type { ResourceType } from './models/resource.models';

export const Resources = {
  FoodIcon: new ImageSource('./images/food.png'),
  MoneyIcon: new ImageSource('./images/money.png'),
  PopulationIcon: new ImageSource('./images/population.png'),
  ResourcesIcon: new ImageSource('./images/resources.png'),
  GoldenOreIcon: new ImageSource('./images/golden_ore.png'),
  FocusIcon: new ImageSource('./images/focus.png'),
  LumberIcon: new ImageSource('./images/lumber.png'),
  StoneIcon: new ImageSource('./images/stone.png'),
  DummyIcon: new ImageSource('./images/dummy.png'),
};

/**
 * Create a loader with all resources
 */
export const loader = new Loader([
  Resources.FoodIcon,
  Resources.MoneyIcon,
  Resources.PopulationIcon,
  Resources.ResourcesIcon,
  Resources.GoldenOreIcon,
  Resources.FocusIcon,
  Resources.LumberIcon,
  Resources.StoneIcon,
  Resources.DummyIcon,
]);

/**
 * Centralized icon lookup for resource types.
 * New resource types without dedicated art fall back to a placeholder icon.
 */
export function getResourceIcon(
  resourceType: ResourceType
): ImageSource | undefined {
  switch (resourceType) {
    case 'gold':
      return Resources.MoneyIcon;
    case 'wood':
      return Resources.LumberIcon;
    case 'stone':
      return Resources.StoneIcon;
    case 'wheat':
      return Resources.DummyIcon; // placeholder
    case 'meat':
      return Resources.FoodIcon; // placeholder
    case 'bread':
      return Resources.DummyIcon; // placeholder
    case 'population':
      return Resources.PopulationIcon;
    default:
      return Resources.DummyIcon;
  }
}
