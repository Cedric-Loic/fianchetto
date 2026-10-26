import { describe, expect, it } from 'vitest';
import type { LessonMoveResponse, LessonsResponse, LessonSummary, LessonView } from '@sq/shared';
import { testServer } from './client.js';

async function server() {
  const s = await testServer();
  await s.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
  const move = async (id: string, index: number, step: number, uci: string) =>
    (await s.http('POST', `/api/lessons/${id}/exercises/${index}/move`, { step, uci }))
      .json as LessonMoveResponse;
  return { ...s, move };
}

describe('leçons', () => {
  it('liste, contenu sans solutions, réservé aux comptes', async () => {
    const anonymous = await testServer();
    expect((await anonymous.http('GET', '/api/lessons')).status).toBe(401);
    await anonymous.app.close();

    const { app, http } = await server();
    const { lessons } = (await http('GET', '/api/lessons')).json as LessonsResponse;
    expect(lessons).toHaveLength(30);
    expect(lessons[0]).toMatchObject({ id: 'routine', phase: 1, best: null, passed: false });
    const view = (await http('GET', '/api/lessons/fourchette')).json as LessonView;
    expect(view.exercises[0]).toMatchObject({ color: 'w' });
    expect(view.exercises[0]?.legalMoves.length).toBeGreaterThan(0);
    const json = JSON.stringify(view);
    expect(json).not.toContain('"solution"');
    expect(json).not.toContain('"accepted"');
    expect(json).not.toContain('"explanation"');
    expect((await http('GET', '/api/lessons/inconnue')).status).toBe(404);
    await app.close();
  });

  it('exercice exact en plusieurs coups : suite, réussite, échec avec solution', async () => {
    const { app, move } = await server();
    const first = await move('fourchette', 0, 0, 'b5c7');
    expect(first.status).toBe('continue');
    expect(first.steps.map((s) => s.san)).toEqual(['Nc7+', 'Kd7']);
    const second = await move('fourchette', 0, 2, 'c7a8');
    expect(second).toMatchObject({ status: 'solved', solution: null });
    expect(second.explanation).toContain('Cc7+');

    const wrong = await move('fourchette', 0, 0, 'b5d6');
    expect(wrong.status).toBe('failed');
    expect(wrong.solution?.map((s) => s.san)).toEqual(['Nc7+', 'Kd7', 'Nxa8']);
    expect((await move('fourchette', 0, 0, 'e1e5')).status).toBe('illegal');
    // Autre mat accepté : mat du couloir, la seule solution est Ta8#, mais un mat suffit.
    expect((await move('mat-du-couloir', 0, 0, 'a1a8')).status).toBe('solved');
    await app.close();
  });

  it('choix (principes d’ouverture) et tolérance Stockfish (parer une menace)', async () => {
    const { app, move, http } = await server();
    expect((await move('principes-ouverture', 0, 0, 'd2d4')).status).toBe('solved');
    expect((await move('principes-ouverture', 0, 0, 'a2a4')).status).toBe('failed');
    expect((await move('routine', 2, 0, 'h2h3')).status).toBe('solved');
    const trap = await move('routine', 2, 0, 'b3f7');
    expect(trap.status).toBe('failed');
    expect(trap.solution?.map((s) => s.san)).toEqual(['h3']);
    // Étape impossible : refusée.
    expect(
      (await http('POST', '/api/lessons/routine/exercises/0/move', { step: 1, uci: 'd1d5' }))
        .status,
    ).toBe(404);
    await app.close();
  }, 60_000);

  it('résultat : meilleur score gardé, validation à 80 %', async () => {
    const { app, http } = await server();
    const post = async (correct: number) =>
      (await http('POST', '/api/lessons/fourchette/result', { correct })).json as LessonSummary;
    expect(await post(1)).toMatchObject({ best: 1, passed: false });
    expect(await post(3)).toMatchObject({ best: 3, passed: true });
    expect(await post(0)).toMatchObject({ best: 3, passed: true });
    await app.close();
  });
});
