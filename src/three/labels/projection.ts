import type { ProjectedLabel } from './types';

/**
 * Frame-scoped bridge between the render loop (which has the camera) and the
 * DOM overlay (which has the layout).
 *
 * A plain module-level map keeps both sides decoupled: the projector writes,
 * the overlay reads, neither triggers a React render per frame.
 */
export const projectedLabels = new Map<string, ProjectedLabel>();

export function setProjected(id: string, x: number, y: number, visible: boolean) {
  let entry = projectedLabels.get(id);
  if (!entry) {
    entry = { x, y, visible };
    projectedLabels.set(id, entry);
  } else {
    entry.x = x;
    entry.y = y;
    entry.visible = visible;
  }
}
