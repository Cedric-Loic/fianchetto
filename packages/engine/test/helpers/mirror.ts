import { Chess } from 'chess.js';
import type { Color, MoveIntent, PieceType, PromotionPiece, Square } from '@sq/shared';
import type { SecretChoice } from '../../src/index.js';

/*
 * Miroir de la position réelle tenu par les tests, indépendamment du moteur : une instance
 * chess.js chargée avec la FEN réelle (pions secrets remplacés par des dames).
 *
 * Pour tirer des coups au hasard rapidement, on utilise la génération interne de chess.js
 * (`_moves`) : la méthode publique `moves({ verbose: true })` construit pour chaque coup un objet
 * `Move` qui recalcule la SAN et deux FEN, ce qui rend les tests de propriétés 10 fois plus lents.
 */

interface RawMove {
  from: number;
  to: number;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PromotionPiece;
  flags: number;
}

interface ChessInternals {
  _moves(options: { legal: boolean }): RawMove[];
  _makeMove(move: RawMove): void;
}

export interface MirrorMove {
  intent: MoveIntent;
  raw: RawMove;
}

/** FEN réelle de départ : position standard où chaque pion secret est une dame. */
export function realStartFen(secrets: SecretChoice): string {
  const start = new Chess();
  for (const color of ['w', 'b'] as const) {
    start.remove(secrets[color]);
    start.put({ type: 'q', color }, secrets[color]);
  }
  return start.fen();
}

function algebraic(index: number): Square {
  return `${'abcdefgh'[index & 7]}${8 - (index >> 4)}` as Square;
}

export class Mirror {
  readonly chess: Chess;
  /** Case actuelle des dames secrètes, suivie par le miroir lui-même. */
  readonly secretSquares: Record<Color, Square | null>;

  constructor(secrets: SecretChoice) {
    this.chess = new Chess(realStartFen(secrets));
    this.secretSquares = { w: secrets.w, b: secrets.b };
  }

  legalMoves(): MirrorMove[] {
    const internals = this.chess as unknown as ChessInternals;
    return internals._moves({ legal: true }).map((raw) => {
      const from = algebraic(raw.from);
      const to = algebraic(raw.to);
      const intent: MoveIntent =
        raw.promotion === undefined ? { from, to } : { from, to, promotion: raw.promotion };
      return { intent, raw };
    });
  }

  apply(move: MirrorMove): void {
    const { from, to } = move.intent;
    for (const color of ['w', 'b'] as const) {
      if (this.secretSquares[color] === to) this.secretSquares[color] = null; // dame capturée
    }
    for (const color of ['w', 'b'] as const) {
      if (this.secretSquares[color] === from) this.secretSquares[color] = to;
    }
    (this.chess as unknown as ChessInternals)._makeMove(move.raw);
  }

  /** Type réel de la pièce sur `square`. */
  realType(square: Square): { color: Color; type: PieceType } | undefined {
    return this.chess.get(square);
  }
}
