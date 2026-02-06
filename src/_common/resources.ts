import { ImageSource, Loader } from 'excalibur';

export const Resources = {
  FoodIcon: new ImageSource('./images/food.svg'),
  MoneyIcon: new ImageSource('./images/money.svg'),
  PopulationIcon: new ImageSource('./images/population.svg'),
  ResourcesIcon: new ImageSource('./images/resources.svg'),
};

/**
 * Create a loader with all resources
 */
export const loader = new Loader([
  Resources.FoodIcon,
  Resources.MoneyIcon,
  Resources.PopulationIcon,
  Resources.ResourcesIcon,
]);
