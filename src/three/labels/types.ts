export type Tone = 'cyan' | 'violet' | 'amber' | 'green' | 'pink' | 'muted';

/**
 * A 2D caption anchored to a point in the 3D scene.
 *
 * Captions are rendered in a DOM layer above the canvas (see AnnotationOverlay)
 * rather than as `Html` portals per mesh: one layer can de-overlap every caption
 * each frame, which is impossible when each label positions itself blindly.
 */
export interface Annotation {
  id: string;
  /** World-space anchor the caption points at. */
  at: [number, number, number];
  title: string;
  sub?: string;
  /** Step range in which this caption is shown: [from, to). */
  from: number;
  to: number;
  tone?: Tone;
}

/** Screen-space result of projecting a caption's anchor. */
export interface ProjectedLabel {
  x: number;
  y: number;
  visible: boolean;
}
