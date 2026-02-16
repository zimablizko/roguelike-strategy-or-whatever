import type { PointerEvent, WheelEvent } from 'excalibur';
import { ScreenElement } from 'excalibur';
import type { ForegroundPointerBlockOptions } from '../../_common/models/ui.models';

/**
 * Ensures pointer events consumed by foreground UI do not leak to lower layers.
 */
export function installForegroundPointerBlocker(
  element: ScreenElement,
  options?: ForegroundPointerBlockOptions
): void {
  const config = {
    pointerDown: true,
    pointerUp: true,
    pointerMove: true,
    pointerEnter: true,
    pointerWheel: true,
    pointerCancel: true,
    pointerDrag: true,
    ...options,
  };

  const cancelPointerEvent = (evt: PointerEvent) => evt.cancel();
  const cancelWheelEvent = (evt: WheelEvent) => evt.cancel();

  element.pointer.useGraphicsBounds = true;
  element.pointer.useColliderShape = false;

  if (config.pointerEnter) {
    element.on('pointerenter', cancelPointerEvent);
  }
  if (config.pointerMove) {
    element.on('pointermove', cancelPointerEvent);
  }
  if (config.pointerDown) {
    element.on('pointerdown', cancelPointerEvent);
  }
  if (config.pointerUp) {
    element.on('pointerup', cancelPointerEvent);
  }
  if (config.pointerCancel) {
    element.on('pointercancel', cancelPointerEvent);
  }
  if (config.pointerWheel) {
    element.on('pointerwheel', cancelWheelEvent);
  }
  if (config.pointerDrag) {
    element.on('pointerdragstart', cancelPointerEvent);
    element.on('pointerdragmove', cancelPointerEvent);
    element.on('pointerdragend', cancelPointerEvent);
    element.on('pointerdragenter', cancelPointerEvent);
    element.on('pointerdragleave', cancelPointerEvent);
  }
}
