import type {
  MapSizeDefinition,
  MapSizeId,
} from '../../_common/models/game-setup.models';

export const mapSizeOrder: MapSizeId[] = ['small', 'medium', 'large'];

export const mapSizeDefinitions = {
  small: {
    id: 'small',
    label: 'Small',
    width: 80,
    height: 48,
    description: 'A tighter frontier for a faster opening and earlier contact.',
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    width: 100,
    height: 60,
    description: 'Balanced territory with room to expand in several directions.',
  },
  large: {
    id: 'large',
    label: 'Large',
    width: 128,
    height: 76,
    description: 'A broad province with slower expansion and more distant opportunities.',
  },
} as const satisfies Record<MapSizeId, MapSizeDefinition>;
