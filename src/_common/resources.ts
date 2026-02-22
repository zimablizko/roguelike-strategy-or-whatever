import { ImageSource, Loader } from 'excalibur';

export const Resources = {
  FoodIcon: new ImageSource('./images/food.png'),
  MoneyIcon: new ImageSource('./images/money.png'),
  PopulationIcon: new ImageSource('./images/population.png'),
  ResourcesIcon: new ImageSource('./images/resources.png'),
  GoldenOreIcon: new ImageSource('./images/golden_ore.png'),
  FocusIcon: new ImageSource('./images/focus.png'),
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
]);
