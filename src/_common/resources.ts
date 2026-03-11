import { Loader } from 'excalibur';
import { BuildingsSpritesheet } from './buildings-sprites';
import { IconsSpritesheet } from './icons';

/** All Excalibur ImageSource assets. Add new assets here and to the loader below. */
export const Resources = {
  IconsSpritesheet,
  BuildingsSpritesheet,
};

/** Loader that pre-loads all assets before the game starts. */
export const loader = new Loader([
  Resources.IconsSpritesheet,
  Resources.BuildingsSpritesheet,
]);

// Re-export icon helpers for convenience.
export { getIconSprite, getResourceIcon } from './icons';
