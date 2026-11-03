import { Chess } from 'chess.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UciEngine } from '../src/uci.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Milieu de partie chargé : la recherche ne finit pas d'elle-même en quelques millisecondes.
const HEAVY = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP1B1PPP/R2QKB1R w KQ - 0 9';
// Roi blanc seul en h1 (g1 battue par la dame noire) : seuls Kg2 et Kh2 sont légaux.
const KING_ONLY = '6k1/q7/8/8/8/8/8/7K w - - 0 1';

const uncaught: unknown[] = [];
const onUncaught = (error: unknown) => uncaught.push(error);
beforeEach(() => {
  uncaught.length = 0;
  process.on('uncaughtException', onUncaught);
  process.on('unhandledRejection', onUncaught);
});
afterEach(() => {
  process.off('uncaughtException', onUncaught);
  process.off('unhandledRejection', onUncaught);
});

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function legalUci(fen: string): Set<string> {
  return new Set(
    new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? '')),
  );
}

describe('UciEngine : robustesse', () => {
  it('attend uciok avant la première recherche', async () => {
    const engine = new UciEngine();
    try {
      // Recherche demandée immédiatement : elle doit aboutir (file amorcée par uciok).
      const lines = await engine.analyze(START, { movetimeMs: 50, multipv: 1, skill: 20 });
      expect(lines).toHaveLength(1);
      expect(legalUci(START).has(lines[0]?.move ?? '')).toBe(true);
    } finally {
      engine.quit();
    }
  });

  it('processus tué en pleine recherche : rejet propre, écriture après mort sans plantage', async () => {
    const engine = new UciEngine();
    // Flux en cours de calcul : son stop() écrit vers le processus.
    let started!: () => void;
    const firstUpdate = new Promise<void>((r) => (started = r));
    const stream = engine.analyzeStream(HEAVY, { multipv: 1 }, () => started());
    await firstUpdate;
    process.kill(engine.pid ?? -1, 'SIGKILL');
    // Écriture immédiate, avant même que la mort soit constatée (EPIPE possible).
    const stopped = stream.stop();
    await expect(stream.done).rejects.toThrow();
    await stopped;
    expect(engine.alive).toBe(false);
    // Toute utilisation ultérieure échoue proprement.
    await expect(
      engine.analyze(START, { movetimeMs: 50, multipv: 1, skill: 20 }),
    ).rejects.toThrow();
    await engine.analyzeStream(START, { multipv: 1 }, () => {}).stop();
    engine.quit();
    engine.quit();
    await pause(200);
    expect(uncaught).toEqual([]);
  });

  it('processus tué pendant analyze : rejet propre', async () => {
    const engine = new UciEngine();
    // Moteur initialisé d'abord, pour que le SIGKILL tombe bien pendant la recherche.
    await engine.analyze(START, { movetimeMs: 20, multipv: 1, skill: 20 });
    const search = engine.analyze(HEAVY, { movetimeMs: 5000, multipv: 1, skill: 20 });
    await pause(300);
    process.kill(engine.pid ?? -1, 'SIGKILL');
    await expect(search).rejects.toThrow('Moteur arrêté.');
    expect(engine.alive).toBe(false);
    await pause(100);
    expect(uncaught).toEqual([]);
  });

  it('délai dépassé puis nouvelle recherche : la seconde reçoit SA réponse', async () => {
    const engine = new UciEngine();
    try {
      // Délai de réponse bien plus court que le temps de réflexion : dépassement garanti.
      const late = engine.analyze(HEAVY, {
        movetimeMs: 5000,
        multipv: 3,
        skill: 20,
        timeoutMs: 100,
      });
      const next = engine.analyze(KING_ONLY, { movetimeMs: 100, multipv: 1, skill: 20 });
      await expect(late).rejects.toThrow('Moteur sans réponse.');
      const lines = await next;
      expect(engine.alive).toBe(true);
      expect(lines).toHaveLength(1);
      const legal = legalUci(KING_ONLY);
      for (const l of lines) expect(legal.has(l.move)).toBe(true);
      // Et la suivante encore, sur une autre position.
      const third = await engine.analyze(START, { movetimeMs: 50, multipv: 2, skill: 20 });
      for (const l of third) expect(legalUci(START).has(l.move)).toBe(true);
    } finally {
      engine.quit();
    }
    expect(uncaught).toEqual([]);
  });

  it('quit() est idempotent et termine le processus', async () => {
    const engine = new UciEngine();
    await engine.analyze(START, { movetimeMs: 20, multipv: 1, skill: 20 });
    const pid = engine.pid ?? -1;
    engine.quit();
    engine.quit();
    expect(engine.alive).toBe(false);
    await pause(1500);
    expect(() => process.kill(pid, 0)).toThrow();
    expect(uncaught).toEqual([]);
  });
});
