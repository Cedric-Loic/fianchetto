import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { LESSONS, type Exercise } from '../src/index.js';

/*
 * Contenu des leçons : chaque position est légale (et acceptée par Stockfish : le camp qui n'a
 * pas le trait n'est jamais en échec), chaque solution est jouable. L'unicité des solutions est
 * vérifiée avec Stockfish par `pnpm test:stress` (apps/server/test/lessons.stress.ts).
 */

function legalPosition(fen: string): boolean {
  const chess = new Chess(fen);
  const parts = fen.split(' ');
  parts[1] = chess.turn() === 'w' ? 'b' : 'w';
  parts[3] = '-';
  return !new Chess(parts.join(' ')).inCheck();
}

function playable(fen: string, moves: readonly string[]): boolean {
  const chess = new Chess(fen);
  try {
    for (const uci of moves)
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return true;
  } catch {
    return false;
  }
}

const exercises: [string, Exercise][] = LESSONS.flatMap((l) =>
  l.exercises.map((e, i) => [`${l.id}#${i}`, e] as [string, Exercise]),
);

describe('leçons', () => {
  it('identifiants uniques, phases 1 et 2 complètes (10 leçons chacune), au moins 2 exercices', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    expect(LESSONS.filter((l) => l.phase === 1)).toHaveLength(10);
    expect(LESSONS.filter((l) => l.phase === 2)).toHaveLength(10);
    for (const l of LESSONS) expect(l.exercises.length, l.id).toBeGreaterThanOrEqual(2);
  });

  it('toutes les positions des exemples sont légales', () => {
    for (const l of LESSONS) {
      for (const s of l.sections)
        if (s.kind === 'example') expect(legalPosition(s.fen), s.fen).toBe(true);
    }
  });

  it.each(exercises)('%s : position légale, solution jouable', (_tag, e) => {
    expect(legalPosition(e.fen)).toBe(true);
    expect(e.solution.length).toBeGreaterThan(0);
    expect(playable(e.fen, e.solution)).toBe(true);
    for (const uci of [...(e.accepted ?? []), ...(e.traps ?? [])]) {
      expect(playable(e.fen, [uci]), uci).toBe(true);
    }
    if (e.mode === 'choice') expect(e.accepted).toContain(e.solution[0]);
    if (e.mode === 'engine') expect(e.tolerance).toBeGreaterThan(0);
    // Mode exact : la solution alterne coup du joueur et réponse adverse, et finit par le joueur.
    if (e.mode === 'exact') expect(e.solution.length % 2).toBe(1);
  });
});
