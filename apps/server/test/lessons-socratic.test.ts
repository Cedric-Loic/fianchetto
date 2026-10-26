import { describe, expect, it } from 'vitest';
import type { Lesson } from '@sq/coach';
import { LessonSquaresResponseSchema, LessonViewSchema } from '@sq/shared';
import { LearningService } from '../src/coach/learning.js';
import { LessonService } from '../src/lessons/service.js';
import { GameStore } from '../src/persistence/db.js';
import { testServer } from './client.js';

const DAY = 86_400_000;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const fake: Lesson = {
  id: 'fake',
  phase: 1,
  title: 'Factice',
  summary: 's',
  minutes: 1,
  sections: [
    {
      kind: 'walkthrough',
      fen: START,
      moves: [
        { uci: 'e2e4', comment: 'Centre.' },
        { uci: 'e7e5', comment: 'Symétrie.' },
      ],
    },
  ],
  exercises: [
    {
      fen: '4k3/8/8/8/8/8/3r4/4K2R w K - 0 1',
      prompt: 'Quelle pièce est en prise ?',
      mode: 'squares',
      squares: ['d2', 'h1'],
      hints: ['Regarde le roi.', 'Une tour.', 'Deux cases.'],
      solution: [],
      explanation: 'Les deux tours.',
    },
    {
      fen: START,
      prompt: 'Ouvre.',
      mode: 'choice',
      accepted: ['e2e4'],
      solution: ['e2e4'],
      explanation: 'Centre.',
    },
  ],
};

function setup() {
  const store = new GameStore(':memory:', { initialRating: 1500 });
  store.createUser({ id: 'u1', username: 'u1', passwordHash: 'x' });
  let now = 1_800_000_000_000;
  const lookup = (id: string) => (id === 'fake' ? fake : undefined);
  const learning = new LearningService(store, {
    phaseOf: () => 1,
    now: () => now,
    lesson: lookup,
  });
  const lessons = new LessonService(
    store,
    () => Promise.resolve(null),
    (u, id, i, ok, h) => learning.recordExercise(u, id, i, ok, h),
    lookup,
  );
  return { store, learning, lessons, advance: (ms: number) => (now += ms) };
}

describe('leçons socratiques', () => {
  it('walkthrough converti, exercice squares sans fuite', () => {
    const { lessons } = setup();
    const view = LessonViewSchema.parse(lessons.view('u1', 'fake'));
    const section = view.sections[0];
    expect(section?.kind).toBe('walkthrough');
    if (section?.kind !== 'walkthrough') return;
    expect(section.steps.map((s) => [s.from, s.to, s.san])).toEqual([
      ['e2', 'e4', 'e4'],
      ['e7', 'e5', 'e5'],
    ]);
    expect(section.steps[0]?.fen).toContain('4P3');
    expect(view.exercises[0]).toMatchObject({ kind: 'squares', hints: 3, legalMoves: [] });
    expect(view.exercises[1]).toMatchObject({ kind: 'move', hints: 0 });
    const json = JSON.stringify(view);
    for (const leak of ['"squares":', 'Regarde le roi', 'Les deux tours', '"solution"']) {
      expect(json).not.toContain(leak);
    }
  });

  it('squares : réussite sans fuite, échec avec la correction', () => {
    const { lessons } = setup();
    const ok = LessonSquaresResponseSchema.parse(lessons.squares('fake', 0, ['h1', 'd2'], 0, 'u1'));
    expect(ok).toMatchObject({ status: 'solved', correct: null });
    expect(lessons.squares('fake', 0, ['d2'], 0, 'u1')).toMatchObject({
      status: 'failed',
      correct: ['d2', 'h1'],
      explanation: 'Les deux tours.',
    });
    expect(lessons.squares('fake', 1, ['d2'], 0, 'u1')).toBeNull();
    expect(lessons.squares('fake', 5, ['d2'], 0, 'u1')).toBeNull();
    expect(lessons.hint('fake', 0, 2)).toBe('Une tour.');
    expect(lessons.hint('fake', 1, 1)).toBeNull();
  });

  it('exercice squares : tentative et carte ; réussite avec indice ne fait pas avancer', () => {
    const { lessons, learning, store, advance } = setup();
    lessons.squares('fake', 0, ['d2', 'h1'], 0, 'u1');
    advance(DAY + 1000);
    expect(learning.cards('u1').due[0]).toMatchObject({
      source: 'exercise',
      ref: 'fake:0',
      step: 0,
    });
    expect(learning.cards('u1').due[0]?.fen).toContain('4k3');
    // Due : réussite sans indice -> étape 1 ; avec indice -> reste à l'étape 0, demain.
    lessons.squares('fake', 0, ['d2', 'h1'], 1, 'u1');
    advance(DAY + 1000);
    expect(learning.cards('u1').due[0]?.step).toBe(0);
    lessons.squares('fake', 0, ['d2', 'h1'], 0, 'u1');
    advance(3 * DAY + 1000);
    expect(learning.cards('u1').due[0]?.step).toBe(1);
    expect(store.exerciseAttempts('u1').map((a) => a.hints)).toEqual([0, 1, 0]);
  });
});

describe('leçons socratiques : routes', () => {
  it('401, 400, 404', async () => {
    const anonymous = await testServer();
    const body = { squares: ['a1'] };
    expect(
      (await anonymous.http('POST', '/api/lessons/routine/exercises/0/squares', body)).status,
    ).toBe(401);
    expect(
      (await anonymous.http('POST', '/api/lessons/routine/exercises/0/hint', { level: 1 })).status,
    ).toBe(401);
    await anonymous.app.close();

    const { app, http } = await testServer();
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const squares = (b: unknown) => http('POST', '/api/lessons/routine/exercises/0/squares', b);
    expect((await squares({ squares: [] })).status).toBe(400);
    expect((await squares({ squares: ['z9'] })).status).toBe(400);
    expect((await squares(body)).status).toBe(404); // exercice de coup
    const hint = (b: unknown) => http('POST', '/api/lessons/routine/exercises/0/hint', b);
    expect((await hint({ level: 9 })).status).toBe(400);
    expect((await hint({ level: 1 })).status).toBe(404);
    await app.close();
  });
});

describe('tableau de bord : compétences clés', () => {
  it('le critère de phase apparaît', async () => {
    const { app, http } = await testServer();
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const d = (await http('GET', '/api/coach/dashboard')).json as {
      phase: { criteria: { label: string }[] };
    };
    expect(d.phase.criteria.some((c) => c.label.startsWith('Compétences clés'))).toBe(true);
    await app.close();
  });
});
