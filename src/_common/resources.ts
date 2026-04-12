import { ImageSource, Loader } from 'excalibur';
import { BuildingsSpritesheet } from './buildings-sprites';
import { IconsSpritesheet } from './icons';
import { TilesSpritesheet } from './tiles-sprites';

/** All Excalibur ImageSource assets. Add new assets here and to the loader below. */
export const MainMenuLogo = new ImageSource(
  './images/one-more-realm-logo-pixel.png'
);

export const Resources = {
  IconsSpritesheet,
  BuildingsSpritesheet,
  TilesSpritesheet,
  MainMenuLogo,
};

/** Loader that pre-loads all assets before the game starts. */
export const loader = new Loader([
  Resources.IconsSpritesheet,
  Resources.BuildingsSpritesheet,
  Resources.TilesSpritesheet,
  Resources.MainMenuLogo,
]);

// Re-export icon helpers for convenience.
export { getIconSprite, getResourceIcon } from './icons';
