import { describe, expect, it } from 'vitest';
import {
  CardsResponseSchema,
  CurriculumResponseSchema,
  DailySessionResponseSchema,
  SkillsResponseSchema,
} from '@sq/shared';
import { LearningService } from '../src/coach/learning.js';
import { GameStore } from '../src/persistence/db.js';
import { testServer } from './client.js';

const DAY = 86_400_000;

describe('coach pédagogique : routes', () => {
  it('réservées aux comptes (401)', async () => {
    const { app, http } = await testServer();
    for (const path of [
      '/api/coach/skills',
      '/api/coach/curriculum',
      '/api/coach/session',
      '/api/reviews/cards',
    ]) {
      expect((await http('GET', path)).status).toBe(401);
    }
    expect((await http('POST', '/api/coach/session/progress', { kind: 'puzzles' })).status).toBe(
      401,
    );
    await app.close();
  });

  it('exercice raté puis réussi : tentatives, carte, compétence, séance', async () => {
    const { app, http } = await testServer();
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const move = (step: number, uci: string) =>
      http('POST', '/api/lessons/fourchette/exercises/0/move', { step, uci });

    let skills = SkillsResponseSchema.parse((await http('GET', '/api/coach/skills')).json);
    expect(skills.skills.find((s) => s.id === 'forks')?.evidence).toBe(0);

    expect((await move(0, 'b5d6')).json).toMatchObject({ status: 'failed' });
    skills = SkillsResponseSchema.parse((await http('GET', '/api/coach/skills')).json);
    const forks = skills.skills.find((s) => s.id === 'forks');
    expect(forks?.evidence).toBe(1);
    expect(forks?.level).toBeLessThan(50);

    // Réussite après échec : déjà compté, pas de double preuve.
    await move(0, 'b5c7');
    await move(2, 'c7a8');
    skills = SkillsResponseSchema.parse((await http('GET', '/api/coach/skills')).json);
    expect(skills.skills.find((s) => s.id === 'forks')?.evidence).toBe(1);

    // La carte est due demain : rien à réviser maintenant.
    const cards = CardsResponseSchema.parse((await http('GET', '/api/reviews/cards')).json);
    expect(cards).toEqual({ due: [], total: 1, mastered: 0 });

    const curriculum = CurriculumResponseSchema.parse(
      (await http('GET', '/api/coach/curriculum')).json,
    );
    expect(curriculum.phase).toBe(1);
    expect(curriculum.modules[0]?.steps[0]?.href).toBe('#/lessons/routine');
    expect(curriculum.next).not.toBeNull();

    const session = DailySessionResponseSchema.parse(
      (await http('GET', '/api/coach/session')).json,
    ).session;
    // Un exercice fait aujourd'hui coche l'étape du parcours.
    expect(session.steps.find((s) => s.kind === 'curriculum')?.done).toBe(true);
    expect(session.steps.find((s) => s.kind === 'summary')?.done).toBe(false);

    const marked = DailySessionResponseSchema.parse(
      (await http('POST', '/api/coach/session/progress', { kind: 'summary' })).json,
    ).session;
    expect(marked.steps.find((s) => s.kind === 'summary')?.done).toBe(true);
    expect((await http('POST', '/api/coach/session/progress', { kind: 'x' })).status).toBe(400);
    await app.close();
  });
});

describe('cartes de révision', () => {
  function setup() {
    const store = new GameStore(':memory:', { initialRating: 1500 });
    store.createUser({ id: 'u1', username: 'u1', passwordHash: 'x' });
    let now = 1_800_000_000_000;
    const learning = new LearningService(store, { phaseOf: () => 1, now: () => now });
    return { store, learning, advance: (ms: number) => (now += ms) };
  }

  it('échec : carte à J+1 ; réussite quand elle est due : étape suivante', () => {
    const { learning, advance } = setup();
    learning.recordExercise('u1', 'fourchette', 0, false);
    expect(learning.cards('u1')).toMatchObject({ due: [], total: 1 });

    advance(DAY + 1000);
    let cards = learning.cards('u1');
    expect(cards.due).toHaveLength(1);
    expect(cards.due[0]).toMatchObject({ source: 'exercise', skill: 'forks', step: 0 });
    expect(cards.due[0]?.fen).toContain(' ');
    expect(learning.session('u1').steps[0]?.kind).toBe('reviews');

    learning.recordExercise('u1', 'fourchette', 0, true);
    cards = learning.cards('u1');
    expect(cards.due).toEqual([]);
    // Étape 1 : prochaine échéance à J+3.
    advance(2 * DAY);
    expect(learning.cards('u1').due).toHaveLength(0);
    advance(DAY + 1000);
    expect(learning.cards('u1').due[0]?.step).toBe(1);
  });

  it('première réussite : carte créée à J+1 ; un nouvel échec la remet à zéro', () => {
    const { learning, advance } = setup();
    learning.recordExercise('u1', 'routine', 1, true);
    advance(DAY + 1000);
    learning.recordExercise('u1', 'routine', 1, true);
    advance(3 * DAY + 1000);
    expect(learning.cards('u1').due[0]?.step).toBe(1);
    learning.recordExercise('u1', 'routine', 1, false);
    advance(DAY + 1000);
    expect(learning.cards('u1').due[0]?.step).toBe(0);
  });

  it('cartes dont la source a disparu ignorées', () => {
    const { store, learning, advance } = setup();
    store.saveCard(
      'u1',
      { source: 'mistake', ref: 'absent', skill: 'method', step: 0, dueAt: 1, mastered: false },
      1,
      false,
    );
    advance(DAY);
    expect(learning.cards('u1')).toEqual({ due: [], total: 1, mastered: 0 });
  });
});
