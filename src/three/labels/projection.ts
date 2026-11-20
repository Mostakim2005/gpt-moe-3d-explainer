import type { ProjectedLabel } from './types';

/**
 * Frame-scoped bridge between the render loop (which has the camera) and the
 * DOM overlay (which has the layout).
 *
 * A plain module-level map + subscriber callback lets LabelProjector push
 * frame-locked layout updates directly to AnnotationOverlay at the end of
 * each WebGL frame, eliminating 1-frame camera-to-caption lag.
 */
export const projectedLabels = new Map<string, ProjectedLabel>();

let listener: (() => void) | null = null;

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

export function clearProjected() {
  projectedLabels.clear();
}

export function subscribeProjection(fn: () => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function notifyProjected() {
  listener?.();
}
