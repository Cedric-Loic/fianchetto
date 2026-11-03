import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/index.js';
import { CURRICULUM, computeSkills, nextStep, planToday, stepDone } from '../src/index.js';
import { endgameById, openingLineById } from '../src/index.js';

const none = {
  lessons: new Set<string>(),
  endgames: new Set<string>(),
  openings: new Set<string>(),
};
const skills = computeSkills([], Date.now());

describe('parcours', () => {
  it('toutes les étapes référencent un contenu existant', () => {
    for (const m of CURRICULUM) {
      for (const s of m.steps) {
        if (s.type === 'lesson')
          expect(
            LESSONS.some((l) => l.id === s.id),
            s.id,
          ).toBe(true);
        if (s.type === 'endgame') expect(endgameById(s.id), s.id).toBeTruthy();
        if (s.type === 'opening') expect(openingLineById(s.id), s.id).toBeTruthy();
      }
    }
  });

  it('commence par la méthode, puis avance quand les étapes sont faites', () => {
    const first = nextStep(none, skills, 1)!;
    expect(first.module.id).toBe('m-method');
    const done = { ...none, lessons: new Set(['routine']) };
    expect(stepDone(first.step, done)).toBe(true);
    expect(nextStep(done, skills, 1)!.module.id).not.toBe('m-method');
  });

  it('ne propose pas les modules des phases suivantes', () => {
    const all = new Set(
      CURRICULUM.filter((m) => m.phase === 1).flatMap((m) => m.steps.map((s) => s.id)),
    );
    expect(nextStep({ ...none, lessons: all, endgames: all }, skills, 1)).toBeNull();
  });
});

describe('séance du jour', () => {
  const next = nextStep(none, skills, 1);
  it('dure environ 28 minutes avec révisions, parcours, puzzles et bilan', () => {
    const s = planToday({
      day: '2026-10-26',
      dueCards: 4,
      next,
      focus: 'forks',
      done: new Set(),
      followUp: null,
    });
    expect(s.steps.map((x) => x.kind)).toEqual(['reviews', 'curriculum', 'puzzles', 'summary']);
    expect(s.minutes).toBe(28);
  });

  it('sans carte due, le temps passe aux puzzles', () => {
    const s = planToday({
      day: '2026-10-26',
      dueCards: 0,
      next,
      focus: null,
      done: new Set(['curriculum']),
      followUp: null,
    });
    expect(s.steps.map((x) => x.kind)).toEqual(['curriculum', 'puzzles', 'summary']);
    expect(s.minutes).toBe(28);
    expect(s.steps[0]!.done).toBe(true);
  });
});
