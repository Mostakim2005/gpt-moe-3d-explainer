export type Chapter = 'gpt' | 'moe';

export interface CameraPose {
  /** Camera position in world units. */
  p: [number, number, number];
  /** Orbit target. */
  t: [number, number, number];
}

export interface KeyNumber {
  label: string;
  value: string;
}

/** A term this step introduces, with a one-line meaning. */
export interface Term {
  term: string;
  meaning: string;
}

/**
 * One scripted step.
 *
 * The scene is a pure function of `step`: components declare the step range
 * they belong to, so scrubbing in either direction re-derives everything.
 */
export interface Step {
  id: string;
  /** Short label for the step rail (no number — the UI adds it). */
  short: string;
  /** Step heading. */
  title: string;
  /** What is happening, in plain language. */
  body: string;
  /** Why it matters / what it implies. */
  why: string;
  /** Bullet points describing what to look at in the 3D scene. */
  see: string[];
  /** Optional "try this" prompt for the interactive control on this step. */
  tryIt?: string;
  /** Jargon this step introduces, defined in place so nobody has to leave the page. */
  terms?: Term[];
  numbers?: KeyNumber[];
  camera: CameraPose;
  /** Milliseconds to hold before autoplay advances. */
  durationMs: number;
}

export interface ChapterDef {
  id: Chapter;
  label: string;
  blurb: string;
  steps: Step[];
}
