/**
 * Colour helpers. Colours are CSS tokens defined in src/app.css (palette + context tokens, both themes); components never write a colour:
 * they use the Tailwind utilities generated from those tokens. These maps pick the right utility for a learning stage.
 * (Class names are written out in full so Tailwind can see them.)
 */
import type { LearningStage } from '$lib/types';

/** Tinted badge for a learning stage: translucent fill + dark ink (queue = gray, structure = red, mastering = yellow, ready = green). */
export const STAGE_BADGE: Record<LearningStage, string> = {
  queue: 'bg-stage-queue-bg text-stage-queue-ink',
  structure: 'bg-stage-structure-bg text-stage-structure-ink',
  mastering: 'bg-stage-mastering-bg text-stage-mastering-ink',
  ready: 'bg-stage-ready-bg text-stage-ready-ink',
};

const STAGE_TINT: Record<LearningStage, string> = {
  queue: 'tint-stage-queue-bg',
  structure: 'tint-stage-structure-bg',
  mastering: 'tint-stage-mastering-bg',
  ready: 'tint-stage-ready-bg',
};

/** Fill of a table cell showing a learning stage: the stage tint over the page (`bg`, catalog) or the card surface (`surface`, setlist tables). */
export const stageCellClass = (stage: LearningStage, base: 'bg' | 'surface' = 'surface'): string => (base === 'bg' ? `${STAGE_TINT[stage]} tint-on-bg` : STAGE_TINT[stage]);
