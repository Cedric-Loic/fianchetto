import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';

/*
 * Validation de chess.js (docs/SPEC.md §3.2, docs/RULES.md §1) sur des positions où une dame
 * remplace un pion. Ces propriétés du moteur standard suffisent à appliquer les règles du
 * Secret Queen sans rien recoder (H2, pas de promotion, compteur des 50 coups, roque).
 */

describe('chess.js — dame à la place d’un pion', () => {
  it('charge une FEN avec une dame sur une case de pion', () => {
    const chess = new Chess('rnbqkbnr/pppqpppp/8/8/8/8/PPPPQPPP/RNBQKBNR w KQkq - 0 1');
    expect(chess.get('e2')).toEqual({ type: 'q', color: 'w' });
    expect(chess.get('d7')).toEqual({ type: 'q', color: 'b' });
    expect(chess.fen()).toBe('rnbqkbnr/pppqpppp/8/8/8/8/PPPPQPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('génère les coups de dame depuis la case du pion (perft 1 calculé à la main : 30)', () => {
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPQPPP/RNBQKBNR w KQkq - 0 1');
    // 18 coups ordinaires (20 moins les 2 coups du pion e2) + 12 coups de dame.
    expect(chess.perft(1)).toBe(30);
    expect(chess.moves({ square: 'e2' }).sort()).toEqual(
      ['Qa6', 'Qb5', 'Qc4', 'Qd3', 'Qe3', 'Qe4', 'Qe5', 'Qe6', 'Qf3', 'Qg4', 'Qh5', 'Qxe7+'].sort(),
    );
  });

  it('refuse le roque si une case traversée est attaquée par la dame', () => {
    // Dame noire en a6 : elle attaque f1 (a6-b5-c4-d3-e2-f1).
    const attacked = new Chess('4k3/8/q7/8/8/8/8/4K2R w K - 0 1');
    expect(attacked.moves({ square: 'e1' })).not.toContain('O-O');
    expect(() => attacked.move('O-O')).toThrow();
    // Témoin : dame en b7, qui n'attaque ni e1, ni f1, ni g1 (seulement h1).
    const free = new Chess('4k3/1q6/8/8/8/8/8/4K2R w K - 0 1');
    expect(free.moves({ square: 'e1' })).toContain('O-O');
  });

  it('une dame qui avance de deux cases ne crée pas de case de prise en passant', () => {
    const queen = new Chess('7k/8/8/8/3p4/8/4Q3/4K3 w - - 0 1');
    queen.move({ from: 'e2', to: 'e4' });
    expect(queen.fen().split(' ')[3]).toBe('-');
    expect(queen.moves({ square: 'd4' })).toEqual(['d3']);
    // Témoin : un vrai pion crée la case e3 et la prise dxe3 est légale.
    const pawn = new Chess('7k/8/8/8/3p4/8/4P3/4K3 w - - 0 1');
    pawn.move({ from: 'e2', to: 'e4' });
    expect(pawn.fen().split(' ')[3]).toBe('e3');
    expect(pawn.moves({ square: 'd4' })).toEqual(['d3', 'dxe3']);
  });

  it('une dame ne prend jamais en passant : la diagonale vers la case vide laisse le pion', () => {
    const chess = new Chess('4k3/8/8/8/3q4/8/4P3/4K3 w - - 0 1');
    chess.move({ from: 'e2', to: 'e4' });
    const move = chess.move({ from: 'd4', to: 'e3' });
    expect(move.isEnPassant()).toBe(false);
    expect(move.isCapture()).toBe(false);
    expect(chess.get('e4')).toEqual({ type: 'p', color: 'w' });
  });

  it('une dame arrivée en dernière rangée reste une dame (aucune promotion)', () => {
    const chess = new Chess('k7/4Q3/8/8/8/8/8/4K3 w - - 0 1');
    const toE8 = chess.moves({ square: 'e7', verbose: true }).filter((m) => m.to === 'e8');
    expect(toE8).toHaveLength(1);
    expect(toE8[0]?.isPromotion()).toBe(false);
    chess.move({ from: 'e7', to: 'e8', promotion: 'n' }); // promotion ignorée
    expect(chess.get('e8')).toEqual({ type: 'q', color: 'w' });
  });

  it('un coup de dame sans prise ne remet pas le compteur des 50 coups à zéro', () => {
    const chess = new Chess('7k/8/8/8/8/8/4Q3/4K3 w - - 98 50');
    chess.move({ from: 'e2', to: 'e3' });
    expect(chess.fen().split(' ')[4]).toBe('99');
    expect(chess.isDrawByFiftyMoves()).toBe(false);
    chess.move({ from: 'h8', to: 'h7' });
    expect(chess.isDrawByFiftyMoves()).toBe(true);
    // Témoins : un coup de vrai pion ou une prise remettent le compteur à zéro.
    const pawn = new Chess('7k/8/8/8/8/8/3PQ3/4K3 w - - 98 50');
    pawn.move({ from: 'd2', to: 'd3' });
    expect(pawn.fen().split(' ')[4]).toBe('0');
    const capture = new Chess('7k/8/8/8/8/4p3/4Q3/4K3 w - - 98 50');
    capture.move({ from: 'e2', to: 'e3' });
    expect(capture.fen().split(' ')[4]).toBe('0');
  });
});
