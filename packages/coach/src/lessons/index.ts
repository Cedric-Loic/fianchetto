import { PHASE_1 } from './phase1.js';
import { PHASE_2 } from './phase2.js';
import { PHASE_3 } from './phase3.js';
import type { Lesson } from './types.js';

export { PASS_RATIO, type Exercise, type Lesson, type Section } from './types.js';

/** Toutes les leçons, dans l'ordre du programme. */
export const LESSONS: readonly Lesson[] = [...PHASE_1, ...PHASE_2, ...PHASE_3];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
