import { afterAll, describe, expect, it } from 'vitest';
import { UciEngine, type UciLine } from '../src/uci.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';

const engine = new UciEngine();
afterAll(() => engine.quit());

describe('UciEngine.analyzeStream', () => {
  it('analyze renseigne la profondeur', async () => {
    const lines = await engine.analyze(START, { movetimeMs: 200, multipv: 2, skill: 20 });
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l.depth).toBeGreaterThan(0);
  });

  it('publie des profondeurs croissantes avec 3 lignes en multipv 3, s’arrête à maxDepth', async () => {
    const updates: UciLine[][] = [];
    const stream = engine.analyzeStream(START, { multipv: 3, maxDepth: 6 }, (lines) =>
      updates.push(lines),
    );
    const final = await stream.done;
    expect(updates.length).toBeGreaterThanOrEqual(2);
    const depths = updates.map((u) => u[0]?.depth ?? 0);
    for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeGreaterThan(depths[i - 1] ?? 0);
    for (const u of updates) {
      expect(u).toHaveLength(3);
      // Toutes les lignes d'une mise à jour sont de la même profondeur, coups distincts.
      expect(new Set(u.map((l) => l.depth)).size).toBe(1);
      expect(new Set(u.map((l) => l.move)).size).toBe(3);
      for (const l of u) expect(l.pv[0]).toBe(l.move);
    }
    expect(depths.at(-1)).toBe(6);
    expect(final).toEqual(updates.at(-1));
    await stream.stop(); // après la fin : sans effet
  });

  it('stop() rend la main vite et la file accepte une analyse juste après', async () => {
    const updates: UciLine[][] = [];
    const stream = engine.analyzeStream(ITALIAN, { multipv: 3 }, (lines) => updates.push(lines));
    await new Promise((r) => setTimeout(r, 500));
    const t0 = Date.now();
    await stream.stop();
    expect(Date.now() - t0).toBeLessThan(1000);
    const final = await stream.done;
    expect(final.length).toBe(3);
    expect(updates.length).toBeGreaterThanOrEqual(2);
    await stream.stop(); // second appel : sans effet
    const lines = await engine.analyze(START, { movetimeMs: 100, multipv: 1, skill: 20 });
    expect(lines).toHaveLength(1);
  });

  it('attend son tour dans la file et s’arrête seul après maxMs', async () => {
    const first = engine.analyze(START, { movetimeMs: 300, multipv: 1, skill: 20 });
    const t0 = Date.now();
    const stream = engine.analyzeStream(START, { multipv: 1, maxDepth: 99, maxMs: 400 }, () => {});
    expect(await first).toHaveLength(1);
    expect((await stream.done).length).toBe(1);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(650);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it('stop() avant le démarrage annule la recherche', async () => {
    const first = engine.analyze(START, { movetimeMs: 200, multipv: 1, skill: 20 });
    let called = false;
    const stream = engine.analyzeStream(START, { multipv: 1 }, () => (called = true));
    await stream.stop();
    expect(await stream.done).toEqual([]);
    expect(called).toBe(false);
    expect(await first).toHaveLength(1);
  });

  it('moins de coups légaux que de multipv : lignes disponibles seulement', async () => {
    // Roi contre roi, roi blanc en a1 : trois coups légaux au plus.
    const fen = '8/8/8/8/8/2k5/8/K7 w - - 0 1';
    const final = await engine.analyzeStream(fen, { multipv: 5, maxDepth: 5 }, () => {}).done;
    expect(final.length).toBeGreaterThan(0);
    expect(final.length).toBeLessThan(5);
  });

  it('processus mort : done rejette', async () => {
    const local = new UciEngine();
    const stream = local.analyzeStream(START, { multipv: 1 }, () => {});
    await new Promise((r) => setTimeout(r, 300));
    local.quit();
    await expect(stream.done).rejects.toThrow();
    await stream.stop();
    expect(local.alive).toBe(false);
  });
});
