import { describe, expect, it } from 'vitest';
import type { BotObservation, MoveIntent, ServerMessage } from '@sq/shared';
import { WorkerBot, type BotDriver } from '../src/bot/driver.js';
import { humanPaceFromEnv } from '../src/config.js';
import { testServer } from './client.js';

/**
 * Faux bots : `script` donne, appel après appel (tous bots confondus), le comportement de
 * `chooseMove` : un coup, ou `'fail'` (rejet, comme un worker ou un Stockfish mort).
 */
function flakyBots(script: (MoveIntent | 'fail')[], fallback: MoveIntent | 'fail' = 'fail') {
  const stats = { created: 0, disposed: 0, calls: 0 };
  const create = (): BotDriver => {
    stats.created++;
    return {
      chooseSecret: () => 'h7',
      chooseMove: (_obs: BotObservation) => {
        const step = script[stats.calls++] ?? fallback;
        return step === 'fail' ? Promise.reject(new Error('h7 e2e4 boum')) : Promise.resolve(step);
      },
      shouldAcceptDraw: () => Promise.resolve(false),
      dispose: () => {
        stats.disposed++;
      },
    };
  };
  return { stats, create };
}

async function botServer(create: () => BotDriver, logs?: string[]) {
  const server = await testServer({
    createBot: create,
    ...(logs
      ? { logLevel: 'info' as const, logStream: { write: (l: string) => logs.push(l) } }
      : {}),
  });
  await server.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
  return server;
}

async function until(pred: () => boolean, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs;
  while (!pred()) {
    if (Date.now() > end) throw new Error('délai dépassé');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const isError = (m: ServerMessage) => m.type === 'error';

describe('bot en échec', () => {
  it('rejet puis réussite : le bot est recréé et la partie continue', async () => {
    const bots = flakyBots(['fail', { from: 'e7', to: 'e5' }]);
    const { app, http, ws } = await botServer(bots.create);
    const { gameId } = (
      await http('POST', '/api/games', {
        mode: 'bot',
        variant: 'classic',
        level: 1,
        timeControl: 'untimed',
        color: 'w',
      })
    ).json as { gameId: string };
    const c = await ws();
    c.send({ type: 'join', gameId });
    await c.until((s) => s.phase === 'playing');
    c.send({ type: 'move', clientMoveId: '1', move: { from: 'e2', to: 'e4' } });
    const s = await c.until((x) => (x.board?.moves.length ?? 0) === 2, 5000);
    expect(s.board?.moves.map((m) => m.san)).toEqual(['e4', 'e5']);
    expect(bots.stats.created).toBe(2);
    expect(bots.stats.disposed).toBeGreaterThanOrEqual(1);
    expect(c.inbox.some(isError)).toBe(false);
    await app.close();
  });

  it('rejets répétés : erreur générique sans secret, journal sobre, nouvelle tentative ensuite', async () => {
    const logs: string[] = [];
    // 1 + 2 tentatives échouent ; la tentative suivante (relancée par le joueur) réussit.
    const bots = flakyBots(['fail', 'fail', 'fail', { from: 'e7', to: 'e5' }]);
    const { app, http, ws } = await botServer(bots.create, logs);
    const { gameId } = (
      await http('POST', '/api/games', {
        mode: 'bot',
        variant: 'secret-queen',
        level: 1,
        timeControl: 'untimed',
        color: 'w',
      })
    ).json as { gameId: string };
    const c = await ws();
    c.send({ type: 'join', gameId });
    await c.until((s) => s.phase === 'secret-selection');
    c.send({ type: 'lock-secret', square: 'd2' });
    await c.until((s) => s.phase === 'playing');
    c.send({ type: 'move', clientMoveId: '1', move: { from: 'e2', to: 'e4' } });
    await until(() => c.inbox.some(isError));

    const errors = c.inbox.filter(isError);
    expect(errors).toEqual([{ type: 'error', code: 'BOT_UNAVAILABLE' }]);
    expect(bots.stats.calls).toBe(3);
    expect(bots.stats.created).toBe(3);
    // Plus de relance d'office : pas de boucle.
    await new Promise((r) => setTimeout(r, 100));
    expect(bots.stats.calls).toBe(3);
    expect(c.state()?.board?.turn).toBe('b');

    // Journal : les échecs et l'abandon sont signalés, sans secret, sans FEN, sans l'erreur.
    const botLines = logs.filter((l) => l.includes('bot') || l.includes('Bot'));
    expect(botLines.filter((l) => l.includes('Le bot n’a pas pu jouer'))).toHaveLength(3);
    expect(botLines.some((l) => l.includes('Bot indisponible'))).toBe(true);
    const all = logs.join('\n');
    expect(all).not.toContain('h7'); // dame secrète du bot
    expect(all).not.toContain('boum'); // message d'erreur du bot
    expect(all).not.toMatch(/[1-8pnbrqkPNBRQK]+\/[1-8pnbrqkPNBRQK]+\//); // aucune FEN
    // Le joueur ne voit jamais la dame du bot (le pion h7 reste un pion).
    const pieces = c.state()?.board?.pieces ?? [];
    expect(pieces.find((p) => p.square === 'h7')?.type).toBe('p');

    // Le joueur agit (ici : un coup refusé, ce n'est pas son tour) : le bot est relancé.
    c.send({ type: 'move', clientMoveId: '2', move: { from: 'd2', to: 'd4' } });
    const s = await c.until((x) => (x.board?.moves.length ?? 0) === 2, 5000);
    expect(s.phase).toBe('playing');
    expect(s.board?.turn).toBe('w');
    await app.close();
  });

  it('rejets répétés puis reconnexion : le bot est relancé', async () => {
    const bots = flakyBots(['fail', 'fail', 'fail', { from: 'e7', to: 'e5' }]);
    const { app, http, ws } = await botServer(bots.create);
    const { gameId } = (
      await http('POST', '/api/games', {
        mode: 'bot',
        variant: 'classic',
        level: 1,
        timeControl: 'untimed',
        color: 'w',
      })
    ).json as { gameId: string };
    const c = await ws();
    c.send({ type: 'join', gameId });
    await c.until((s) => s.phase === 'playing');
    c.send({ type: 'move', clientMoveId: '1', move: { from: 'e2', to: 'e4' } });
    await until(() => c.inbox.some(isError));
    c.socket.close();
    const d = await ws();
    d.send({ type: 'join', gameId });
    const s = await d.until((x) => (x.board?.moves.length ?? 0) === 2, 5000);
    expect(s.board?.turn).toBe('w');
    await app.close();
  });
});

describe('arrêt du worker du bot', () => {
  const workerUrl = new URL('./fixtures/stop-worker.mjs', import.meta.url);

  it('attend la sortie du worker (le temps qu’il arrête son moteur)', async () => {
    const bot = new WorkerBot(1, { workerUrl, stopGraceMs: 5000 });
    await new Promise((r) => setTimeout(r, 100)); // démarrage du worker
    const t0 = Date.now();
    await bot.dispose();
    const elapsed = Date.now() - t0;
    expect(bot.exited).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(150);
    expect(elapsed).toBeLessThan(3000);
    // Plus aucune demande possible.
    await expect(bot.chooseMove({} as BotObservation)).rejects.toThrow();
  });

  it('worker qui ne s’arrête pas : arrêt forcé après le délai de grâce', async () => {
    const bot = new WorkerBot(2, { workerUrl, stopGraceMs: 150 });
    await new Promise((r) => setTimeout(r, 100));
    const t0 = Date.now();
    await bot.dispose();
    expect(bot.exited).toBe(true);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(100);
  });

  it('vrai bot : l’arrêt se termine par la sortie du worker', async () => {
    const bot = new WorkerBot(1, { humanPace: false });
    await new Promise((r) => setTimeout(r, 300));
    await bot.dispose();
    expect(bot.exited).toBe(true);
  }, 20_000);
});

describe('rythme humain du bot', () => {
  it('FIANCHETTO_HUMAN_PACE=0 ou false le désactive ; actif par défaut', () => {
    expect(humanPaceFromEnv({})).toBe(true);
    expect(humanPaceFromEnv({ FIANCHETTO_HUMAN_PACE: '1' })).toBe(true);
    expect(humanPaceFromEnv({ FIANCHETTO_HUMAN_PACE: '0' })).toBe(false);
    expect(humanPaceFromEnv({ FIANCHETTO_HUMAN_PACE: 'false' })).toBe(false);
  });
});
