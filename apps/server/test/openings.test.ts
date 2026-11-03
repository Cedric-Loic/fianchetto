import { describe, expect, it } from 'vitest';
import type {
  OpeningDeviationResponse,
  OpeningDrill,
  OpeningLineSummary,
  OpeningNextResponse,
  OpeningsResponse,
} from '@sq/shared';
import { OpeningService } from '../src/openings/service.js';
import { GameStore } from '../src/persistence/db.js';
import { testServer } from './client.js';

const DAY = 24 * 3600 * 1000;

describe('répertoire d’ouvertures : service', () => {
  /** Service avec une horloge réglable et un utilisateur en base. */
  function setup() {
    const store = new GameStore(':memory:', { initialRating: 800 });
    store.createUser({ id: 'u1', username: 'cedric', passwordHash: 'x' });
    let now = 1_700_000_000_000;
    const service = new OpeningService(store, () => now);
    return { store, service, advance: (days: number) => (now += days * DAY) };
  }

  it('lignes nouvelles d’abord, puis répétition espacée 1/3/7/21 jours', () => {
    const { store, service, advance } = setup();
    const first = service.next('u1');
    expect(first.reason).toBe('new');
    const id = first.drill?.line.id as string;
    expect(service.list('u1').due).toBe(0);

    service.result('u1', id, true);
    const line = () => service.list('u1').lines.find((l) => l.id === id) as OpeningLineSummary;
    expect(line()).toMatchObject({ status: 'learning', due: false });
    // Une autre ligne nouvelle est proposée tant que rien n'est dû.
    expect(service.next('u1').drill?.line.id).not.toBe(id);

    advance(1);
    expect(service.list('u1').due).toBe(1);
    expect(service.next('u1')).toMatchObject({ reason: 'due', drill: { line: { id } } });
    service.result('u1', id, true); // → 3 jours
    advance(2);
    expect(line().due).toBe(false);
    advance(1);
    expect(line().due).toBe(true);
    service.result('u1', id, true); // → 7 jours
    advance(7);
    service.result('u1', id, true); // → 21 jours
    expect(line().status).toBe('learned');

    // Un échec renvoie au lendemain.
    advance(21);
    service.result('u1', id, false);
    expect(line()).toMatchObject({ status: 'learning', due: false });
    expect(store.openingProgress('u1')[0]).toMatchObject({ successes: 4, failures: 1, step: 0 });
    advance(1);
    expect(line().due).toBe(true);
    store.close();
  });

  it('entraînement : coups légaux seulement avant les coups du joueur ; filtre par camp', () => {
    const { service } = setup();
    const drill = service.next('u1', 'b').drill as OpeningDrill;
    expect(drill.line.color).toBe('b');
    expect(drill.steps[0]?.legalMoves).toEqual([]);
    expect(drill.steps[1]?.legalMoves.length).toBe(20);
    expect(service.drill('u1', 'inconnue')).toBeNull();
    expect(service.result('u1', 'inconnue', true)).toBeNull();
  });
});

describe('répertoire d’ouvertures : routes', () => {
  it('réservées aux comptes ; liste, ligne due, résultat, écart de revue', async () => {
    const anonymous = await testServer();
    expect((await anonymous.http('GET', '/api/openings')).status).toBe(401);
    expect((await anonymous.http('GET', '/api/openings/next')).status).toBe(401);
    await anonymous.app.close();

    const { app, http } = await testServer();
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const list = (await http('GET', '/api/openings')).json as OpeningsResponse;
    expect(list.due).toBe(0);
    expect(list.lines.filter((l) => l.color === 'w').length).toBeGreaterThanOrEqual(6);
    expect(list.lines.every((l) => l.status === 'new')).toBe(true);

    const next = (await http('GET', '/api/openings/next?color=w')).json as OpeningNextResponse;
    expect(next.reason).toBe('new');
    const id = next.drill?.line.id as string;
    expect(((await http('GET', `/api/openings/${id}`)).json as OpeningDrill).steps.length).toBe(
      next.drill?.steps.length,
    );
    expect((await http('GET', '/api/openings/inconnue')).status).toBe(404);

    expect((await http('POST', `/api/openings/${id}/result`, { success: 'oui' })).status).toBe(400);
    const after = await http('POST', `/api/openings/${id}/result`, { success: true });
    expect(after.json).toMatchObject({ id, status: 'learning', due: false });

    const deviation = await http('POST', '/api/openings/deviation', {
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
      color: 'w',
    });
    expect((deviation.json as OpeningDeviationResponse).deviation).toMatchObject({
      moveNumber: 3,
      by: 'player',
      expected: ['Bc4'],
    });
    expect((await http('POST', '/api/openings/deviation', { moves: 'e4' })).status).toBe(400);
    await app.close();
  });
});
