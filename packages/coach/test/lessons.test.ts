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
  it('identifiants uniques, phases 1 à 3 complètes (leçons de base, chapitres de finales des trois paliers, parties classiques), au moins 2 exercices', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    expect(LESSONS.filter((l) => l.phase === 1)).toHaveLength(21);
    expect(LESSONS.filter((l) => l.phase === 2)).toHaveLength(22);
    expect(LESSONS.filter((l) => l.phase === 3)).toHaveLength(21);
    for (const l of LESSONS) expect(l.exercises.length, l.id).toBeGreaterThanOrEqual(2);
    for (const l of LESSONS.filter((x) => x.phase === 3))
      expect(l.exercises.length, l.id).toBeGreaterThanOrEqual(5);
  });

  it('toutes les positions des exemples sont légales', () => {
    for (const l of LESSONS) {
      for (const s of l.sections)
        if (s.kind === 'example') expect(legalPosition(s.fen), s.fen).toBe(true);
    }
  });

  it('les parties commentées sont légales, un commentaire par coup', () => {
    for (const l of LESSONS)
      for (const s of l.sections)
        if (s.kind === 'walkthrough') {
          expect(legalPosition(s.fen), l.id).toBe(true);
          expect(
            playable(
              s.fen,
              s.moves.map((m) => m.uci),
            ),
            l.id,
          ).toBe(true);
          for (const m of s.moves) expect(m.comment.length, l.id).toBeGreaterThan(5);
        }
  });

  it('parties classiques : 3 à 6 questions à 3 indices, bilan « ce que je retiens »', () => {
    const classics = LESSONS.filter((l) => l.id.startsWith('classique-'));
    expect(classics.length).toBeGreaterThanOrEqual(10);
    for (const l of classics) {
      expect(l.exercises.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.exercises.length, l.id).toBeLessThanOrEqual(6);
      for (const e of l.exercises) expect(e.hints?.length, l.id).toBe(3);
      const bilan = l.sections.find((s) => s.kind === 'text' && s.title === 'Bilan');
      expect(bilan?.kind === 'text' ? bilan.body : '', l.id).toContain('Ce que je retiens');
      // Les parties ajoutées au lot 4 ont un bilan en trois points numérotés.
      const lot4 = [
        'classique-lazard',
        'classique-shilling',
        'classique-berger',
        'classique-lasker-thomas',
        'classique-rotlewi-rubinstein',
      ];
      if (lot4.includes(l.id))
        for (const n of ['(1)', '(2)', '(3)'])
          expect(bilan?.kind === 'text' ? bilan.body : '', l.id).toContain(n);
      expect(
        l.sections.some((s) => s.kind === 'walkthrough'),
        l.id,
      ).toBe(true);
    }
  });

  it('parties classiques : celles qui finissent par un mat finissent bien par un mat', () => {
    const matees = [
      'classique-opera',
      'classique-legal',
      'classique-reti',
      'classique-lazard',
      'classique-shilling',
      'classique-berger',
      'classique-lasker-thomas',
    ];
    for (const id of matees) {
      const lesson = LESSONS.find((l) => l.id === id);
      const walk = lesson?.sections.find((s) => s.kind === 'walkthrough');
      expect(walk, id).toBeTruthy();
      if (walk?.kind !== 'walkthrough') continue;
      const chess = new Chess(walk.fen);
      for (const m of walk.moves)
        chess.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] });
      expect(chess.isCheckmate(), id).toBe(true);
    }
  });

  it.each(exercises)('%s : position légale, solution jouable', (_tag, e) => {
    expect(legalPosition(e.fen)).toBe(true);
    expect(e.hints?.length ?? 0).toBeLessThanOrEqual(3);
    if (e.mode === 'squares') {
      // Cases attendues : non vides, valides (occupées ou non : « cases clés », « cases libres »),
      // pas de coup à jouer.
      expect(e.solution).toHaveLength(0);
      expect(e.squares?.length).toBeGreaterThan(0);
      for (const sq of e.squares ?? []) expect(sq, sq).toMatch(/^[a-h][1-8]$/);
      expect(new Set(e.squares).size).toBe(e.squares?.length);
      return;
    }
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
