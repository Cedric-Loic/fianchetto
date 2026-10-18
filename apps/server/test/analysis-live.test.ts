import type { AddressInfo } from 'node:net';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { UciEngine, type AnalysisStream, type UciLine } from '@sq/bot';
import { AnalysisEventSchema, type AnalysisEvent, type EngineLine } from '@sq/shared';
import { AnalysisService, type LiveEngine } from '../src/analysis/service.js';
import { testServer } from './client.js';

/** Vrai Stockfish, instrumenté : nombre d'arrêts demandés et de recherches terminées. */
function countingEngine() {
  const stats = { started: 0, stops: 0, finished: 0 };
  const create = (): LiveEngine => {
    const engine = new UciEngine();
    return {
      get alive() {
        return engine.alive;
      },
      quit: () => engine.quit(),
      analyzeStream(fen, options, onUpdate) {
        stats.started++;
        const stream = engine.analyzeStream(fen, options, onUpdate);
        void stream.done.finally(() => stats.finished++).catch(() => undefined);
        return {
          done: stream.done,
          stop: () => {
            stats.stops++;
            return stream.stop();
          },
        };
      },
    };
  };
  return { stats, create };
}

async function until(pred: () => boolean, timeoutMs = 10_000) {
  const end = Date.now() + timeoutMs;
  while (!pred()) {
    if (Date.now() > end) throw new Error('délai dépassé');
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function liveServer() {
  const engine = countingEngine();
  const server = await testServer({ createAnalysisEngine: engine.create });
  const base = `http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}`;
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cedric', password: 'motdepasse' }),
  });
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

  /** Ouvre un flux SSE et accumule ses événements. */
  const stream = async (fen: string, multipv = 3, withCookie = true) => {
    const controller = new AbortController();
    const query = new URLSearchParams({ fen, multipv: String(multipv) });
    const response = await fetch(`${base}/api/analysis/stream?${query.toString()}`, {
      headers: withCookie ? { cookie } : {},
      signal: controller.signal,
    });
    const events: AnalysisEvent[] = [];
    let ended = false;
    const reading = (async () => {
      if (!response.body || response.status !== 200) return;
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for await (const chunk of response.body) {
          buffer += decoder.decode(chunk as Uint8Array, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            if (part.startsWith('data: ')) {
              events.push(AnalysisEventSchema.parse(JSON.parse(part.slice(6))));
            }
          }
        }
      } catch {
        // Fermeture par le test (abort).
      }
      ended = true;
    })();
    return {
      response,
      events,
      ended: () => ended,
      reading,
      close: () => controller.abort(),
      lines: () => events.filter((e) => e.type === 'lines'),
    };
  };
  return { ...server, stream, stats: engine.stats };
}

// Les Noirs ont le trait, mais les Blancs ont une dame de plus.
const WHITE_UP = 'rnb1kbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';

function checkSan(fen: string, line: EngineLine) {
  expect(line.sanPv).toHaveLength(line.pv.length);
  expect(line.pv.length).toBeGreaterThan(0);
  expect(line.pv.length).toBeLessThanOrEqual(12);
  const chess = new Chess(fen);
  for (const [i, uci] of line.pv.entries()) {
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci[4] } : {}),
    });
    expect(move.san).toBe(line.sanPv[i]);
  }
}

describe('moteur en direct (SSE)', () => {
  it('refus : non connecté, FEN invalide, camp sans le trait en échec, multipv hors bornes', async () => {
    const { app, stream } = await liveServer();
    expect((await stream(WHITE_UP, 3, false)).response.status).toBe(401);
    const invalid = await stream('rnbqkbnr/pppppppp/8/8 w KQkq - 0 1');
    expect(invalid.response.status).toBe(400);
    expect(await invalid.response.json()).toEqual({ error: 'INVALID_FEN' });
    // Les Blancs ont le trait alors que le roi noir est en échec.
    const check = await stream('4k3/8/8/8/8/8/8/4RK2 w - - 0 1');
    expect(check.response.status).toBe(400);
    expect((await stream(WHITE_UP, 9)).response.status).toBe(400);
    await app.close();
  });

  it('position finale : un seul événement « done »', async () => {
    const { app, stream, stats } = await liveServer();
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const s = await stream(fen);
    expect(s.response.headers.get('content-type')).toBe('text/event-stream');
    await s.reading;
    expect(s.events).toEqual([{ type: 'done', fen }]);
    expect(stats.started).toBe(0);
    await app.close();
  });

  it('lignes multipv du point de vue des Blancs, SAN correcte ; fermeture du client → arrêt', async () => {
    const { app, stream, stats } = await liveServer();
    const s = await stream(WHITE_UP, 3);
    expect(s.response.status).toBe(200);
    expect(s.response.headers.get('cache-control')).toBe('no-cache');
    await until(() => s.lines().length >= 2, 30_000);
    const last = s.lines().at(-1);
    if (last?.type !== 'lines') throw new Error('pas de lignes');
    expect(last.fen).toBe(WHITE_UP);
    expect(last.lines.map((l) => l.multipv)).toEqual([1, 2, 3]);
    const [first] = last.lines;
    // Gros avantage blanc, alors que les Noirs ont le trait : évaluation positive.
    expect(first?.mate ?? 0).toBeGreaterThanOrEqual(0);
    if (first?.mate === null) expect(first.evalCp ?? 0).toBeGreaterThan(300);
    for (const line of last.lines) checkSan(WHITE_UP, line);
    const depths = s.lines().map((e) => (e.type === 'lines' ? (e.lines[0]?.depth ?? 0) : 0));
    expect(depths.at(-1)).toBeGreaterThan(depths[0] ?? 0);

    s.close();
    await until(() => stats.stops >= 1 && stats.finished === 1, 5000);
    // Le moteur accepte aussitôt une nouvelle demande.
    const t0 = Date.now();
    const next = await stream('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 1);
    await until(() => next.lines().length >= 1, 5000);
    expect(Date.now() - t0).toBeLessThan(5000);
    next.close();
    await app.close();
  }, 60_000);

  it('deux demandes successives : la première est arrêtée', async () => {
    const { app, stream, stats } = await liveServer();
    const a = await stream(WHITE_UP, 3);
    await until(() => a.lines().length >= 1, 30_000);
    const b = await stream('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 2);
    await a.reading;
    expect(a.events.at(-1)).toEqual({ type: 'done', fen: WHITE_UP });
    await until(() => b.lines().length >= 1, 10_000);
    const lines = b.lines()[0];
    expect(lines?.type === 'lines' && lines.lines).toHaveLength(2);
    expect(stats.started).toBe(2);
    b.close();
    await app.close();
  }, 60_000);

  it('moteur désactivé : 503', async () => {
    const server = await testServer({ createAnalysisEngine: null });
    await server.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const q = new URLSearchParams({ fen: WHITE_UP });
    expect((await server.http('GET', `/api/analysis/stream?${q.toString()}`)).status).toBe(503);
    await server.app.close();
  });
});

describe('service d’analyse', () => {
  /** Faux moteur : chaque recherche publie une ligne puis se termine. */
  function fakeEngine() {
    const engines: { quit: number; alive: boolean }[] = [];
    const create = (): LiveEngine => {
      const state = { quit: 0, alive: true };
      engines.push(state);
      return {
        get alive() {
          return state.alive;
        },
        quit: () => {
          state.quit++;
          state.alive = false;
        },
        analyzeStream(_fen, _options, onUpdate): AnalysisStream {
          const line: UciLine = { move: 'e7e5', score: -30, mate: null, pv: ['e7e5'], depth: 5 };
          const done = Promise.resolve().then(() => {
            onUpdate([line]);
            return [line];
          });
          return { done, stop: () => done.then(() => undefined) };
        },
      };
    };
    return { engines, create };
  }

  it('point de vue des Blancs, arrêt après inactivité, moteur recréé s’il est mort', async () => {
    const fake = fakeEngine();
    const service = new AnalysisService({ createEngine: fake.create, idleMs: 30 });
    const events: AnalysisEvent[] = [];
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    service.start(fen, 1, (e) => events.push(e));
    await until(() => events.some((e) => e.type === 'done'));
    expect(events[0]).toEqual({
      type: 'lines',
      fen,
      lines: [{ multipv: 1, depth: 5, evalCp: 30, mate: null, pv: ['e7e5'], sanPv: ['e5'] }],
    });
    await until(() => fake.engines[0]?.quit === 1, 2000);
    expect(service.busy).toBe(false);
    service.start(fen, 1, () => undefined);
    expect(fake.engines).toHaveLength(2);
    await service.dispose();
    expect(fake.engines[1]?.quit).toBe(1);
  });
});
