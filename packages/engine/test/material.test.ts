import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Color, PieceType, Square } from '@sq/shared';
import { cannotMate, type RealPiece } from '../src/internal/material.js';

/*
 * Matériel insuffisant (docs/RULES.md §5), calculé sur les pièces RÉELLES.
 * - fin automatique : chess.js `isInsufficientMaterial` (validé ici) ;
 * - chute du drapeau : `cannotMate` (règle de lichess, par camp).
 * Les tests sur parties réelles sont dans edge-cases.test.ts.
 */

/** « wK e1, wN b1, bK e8 » → liste de pièces réelles. */
function pieces(spec: string): RealPiece[] {
  return spec.split(',').map((token) => {
    const [code, square] = token.trim().split(' ') as [string, Square];
    return { color: code[0] as Color, type: code[1]!.toLowerCase() as PieceType, square };
  });
}

describe('fin automatique — chess.js isInsufficientMaterial', () => {
  it.each([
    ['R/R', '4k3/8/8/8/8/8/8/4K3 w - - 0 1', true],
    ['R+F/R', '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', true],
    ['R+C/R', '4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', true],
    // c1 et d8 sont des cases sombres, c8 une case claire.
    ['R+F/R+F, fous de même couleur', '3bk3/8/8/8/8/8/8/2B1K3 w - - 0 1', true],
    ['R+F/R+F, fous de couleurs opposées', '2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1', false],
    ['R+C/R+C', '1n2k3/8/8/8/8/8/8/1N2K3 w - - 0 1', false],
    ['R+C/R+F', '2b1k3/8/8/8/8/8/8/1N2K3 w - - 0 1', false],
    ['R+CC/R', '4k3/8/8/8/8/8/8/1N2K1N1 w - - 0 1', false],
    ['R+P/R', '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', false],
    ['R+dame (secrète ou non)/R', '4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1', false],
  ])('%s → %s', (_label, fen, expected) => {
    expect(new Chess(fen).isInsufficientMaterial()).toBe(expected);
  });
});

describe('chute du drapeau — cannotMate (camp qui a encore du temps)', () => {
  it('roi seul : ne peut pas mater', () => {
    expect(cannotMate(pieces('wK e1, bK e8, bQ d8'), 'w')).toBe(true);
  });

  it('roi + cavalier : ne mate que si l’adversaire a de quoi bloquer son roi', () => {
    expect(cannotMate(pieces('wK e1, wN b1, bK e8'), 'w')).toBe(true);
    expect(cannotMate(pieces('wK e1, wN b1, bK e8, bQ h2'), 'w')).toBe(true);
    expect(cannotMate(pieces('wK e1, wN b1, bK e8, bP a6'), 'w')).toBe(false);
    expect(cannotMate(pieces('wK e1, wN b1, bK e8, bR a8'), 'w')).toBe(false);
    expect(cannotMate(pieces('wK e1, wN b1, bK e8, bB c8'), 'w')).toBe(false);
    expect(cannotMate(pieces('wK e1, wN b1, bK e8, bN b8'), 'w')).toBe(false);
    expect(cannotMate(pieces('wK e1, wN b1, wN g1, bK e8'), 'w')).toBe(false);
  });

  it('roi + fou(s) : dépend des couleurs de cases et des pièces adverses', () => {
    expect(cannotMate(pieces('bK e8, bB f5, wK g2'), 'b')).toBe(true);
    expect(cannotMate(pieces('bK e8, bB f5, wK g2, wQ f8'), 'b')).toBe(true);
    expect(cannotMate(pieces('bK e8, bB f5, wK g2, wR a1'), 'b')).toBe(true);
    expect(cannotMate(pieces('bK e8, bB f5, wK g2, wP a2'), 'b')).toBe(false);
    expect(cannotMate(pieces('bK e8, bB f5, wK g2, wN b1'), 'b')).toBe(false);
    // f5 est une case claire ; c1 est sombre, f1 est claire.
    expect(cannotMate(pieces('bK e8, bB f5, wK g2, wB c1'), 'b')).toBe(false);
    expect(cannotMate(pieces('bK e8, bB f5, wK g2, wB f1'), 'b')).toBe(true);
    expect(cannotMate(pieces('bK e8, bB f5, bB e5, wK g2'), 'b')).toBe(false);
    expect(cannotMate(pieces('bK e8, bB f5, bB e4, wK g2'), 'b')).toBe(true);
  });

  it('pion, tour, dame, pièces mineures mixtes : peut mater', () => {
    expect(cannotMate(pieces('wK e1, wP a2, bK e8'), 'w')).toBe(false);
    expect(cannotMate(pieces('wK e1, wR a1, bK e8'), 'w')).toBe(false);
    expect(cannotMate(pieces('wK e1, wQ e4, bK e8'), 'w')).toBe(false);
    expect(cannotMate(pieces('wK e1, wB c1, wN b1, bK e8'), 'w')).toBe(false);
  });
});
