import { Chess, type Move } from 'chess.js';
import {
  PROMOTION_PIECES,
  isSquare,
  opposite,
  pawnStartSquares,
  type Color,
  type GameResult,
  type MoveIntent,
  type PieceId,
  type PieceType,
  type PromotionPiece,
  type PublicMove,
  type Reveal,
  type Square,
} from '@sq/shared';
import { REDACTED } from '@sq/shared/secret';
import type { PersistedGame, PlayResult, SecretChoice } from '../types.js';
import {
  initialPieces,
  realPlacement,
  type PublicBoard,
  type PublicPiece,
  type TrackedPiece,
} from './board.js';
import { cannotMate, type RealPiece } from './material.js';
import { publicSan } from './notation.js';

/*
 * État réel d'une partie Secret Queen. Ce module ne sort jamais du moteur : le serveur manipule
 * `SecretQueenGame` (game.ts), qui garde un GameCore dans un champ privé, et ne voit la partie
 * qu'au travers de `projectForViewer`.
 *
 * La légalité, les échecs et les fins automatiques sont délégués à chess.js sur la position
 * réelle (chaque dame secrète y est une vraie dame). Le moteur ajoute le suivi des pièces
 * (identifiant, type affiché, type réel) et la notation publique.
 */

const INSPECT = Symbol.for('nodejs.util.inspect.custom');

const INVALID_SECRETS = 'Choix de dame secrète invalide.';
const NOT_SECRET_QUEEN = 'Partie classique : aucune dame secrète.';

/**
 * Marqueur d'une partie classique (aucune dame secrète). Un symbole ne peut pas provenir d'un
 * JSON : une partie Secret Queen persistée ne peut donc jamais être recréée en partie classique.
 */
export const CLASSIC = Symbol('classic');
const GAME_OVER = 'La partie est déjà terminée.';

interface ParsedIntent {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

interface RealPly {
  realSan: string;
  realFenAfter: string;
}

function isPromotionPiece(value: unknown): value is PromotionPiece {
  return (PROMOTION_PIECES as readonly unknown[]).includes(value);
}

/** Intention bien formée, sinon `null` (le serveur valide déjà ; le moteur reste défensif). */
function parseIntent(intent: unknown): ParsedIntent | null {
  if (typeof intent !== 'object' || intent === null) return null;
  const { from, to, promotion } = intent as Record<string, unknown>;
  if (typeof from !== 'string' || typeof to !== 'string' || !isSquare(from) || !isSquare(to)) {
    return null;
  }
  if (promotion === undefined) return { from, to };
  return isPromotionPiece(promotion) ? { from, to, promotion } : null;
}

function isValidSecretChoice(secrets: unknown): secrets is SecretChoice {
  if (typeof secrets !== 'object' || secrets === null) return false;
  const { w, b } = secrets as Record<string, unknown>;
  return (
    (pawnStartSquares('w') as unknown[]).includes(w) &&
    (pawnStartSquares('b') as unknown[]).includes(b)
  );
}

/** Clé de répétition : placement réel, trait, roques, prise en passant réellement jouable. */
function repetitionKey(fen: string): string {
  // chess.js n'écrit la case de prise en passant dans la FEN que si une prise légale existe.
  return fen.split(' ').slice(0, 4).join(' ');
}

const refused = (): PlayResult => ({ ok: false });

/** Copie profonde d'un coup public (l'appelant ne doit jamais tenir une référence interne). */
function copyMove(move: PublicMove): PublicMove {
  return {
    ...move,
    capture: move.capture === null ? null : { ...move.capture },
    castle: move.castle === null ? null : { ...move.castle },
  };
}

export class GameCore {
  /** `null` : partie classique. */
  readonly #secrets: SecretChoice | null;
  readonly #secretIds: Readonly<Record<Color, PieceId>> | null;
  readonly #chess: Chess;
  readonly #realInitialFen: string;
  readonly #pieces: Map<Square, TrackedPiece>;
  readonly #moves: PublicMove[] = [];
  readonly #intents: ParsedIntent[] = [];
  readonly #realPlies: RealPly[] = [];
  readonly #captured: Record<Color, PieceType[]> = { w: [], b: [] };
  readonly #repetitions = new Map<string, number>();
  #result: GameResult | null = null;
  #externalResult: GameResult | null = null;

  /**
   * `CLASSIC` : partie classique. Sinon, lève une erreur si une case n'est pas une case de
   * départ de pion de la bonne couleur.
   */
  constructor(secrets: SecretChoice | typeof CLASSIC) {
    if (secrets === CLASSIC) {
      this.#secrets = null;
      this.#secretIds = null;
    } else {
      if (!isValidSecretChoice(secrets)) throw new Error(INVALID_SECRETS);
      this.#secrets = { w: secrets.w, b: secrets.b };
      this.#secretIds = { w: `wp${secrets.w}`, b: `bp${secrets.b}` };
    }
    this.#pieces = initialPieces(this.#secrets ?? {});
    this.#chess = new Chess(`${realPlacement(this.#pieces)} w KQkq - 0 1`);
    this.#realInitialFen = this.#chess.fen();
    this.#countRepetition(this.#realInitialFen);
  }

  get turn(): Color {
    return this.#chess.turn();
  }

  get plyCount(): number {
    return this.#moves.length;
  }

  /** Le camp au trait est en échec (annonce publique). */
  get inCheck(): boolean {
    return this.#chess.inCheck();
  }

  get result(): GameResult | null {
    return this.#result === null ? null : { ...this.#result };
  }

  get isClassic(): boolean {
    return this.#secrets === null;
  }

  /** Pièce suivie sur `square` (lecture seule). */
  pieceAt(square: Square): Readonly<TrackedPiece> | undefined {
    return this.#pieces.get(square);
  }

  /** Copie des coups publics joués. */
  publicMoves(): PublicMove[] {
    return this.#moves.map(copyMove);
  }

  /** Copie des types AFFICHÉS des pièces capturées, par couleur, dans l'ordre des prises. */
  capturedDisplayed(): Record<Color, PieceType[]> {
    return { w: [...this.#captured.w], b: [...this.#captured.b] };
  }

  secretId(color: Color): PieceId {
    return this.#secretChoice().ids[color];
  }

  /** Case actuelle de la dame secrète de `color`, `null` si elle a été capturée. */
  secretSquare(color: Color): Square | null {
    const id = this.#secretChoice().ids[color];
    for (const [square, piece] of this.#pieces) {
      if (piece.id === id) return square;
    }
    return null;
  }

  /** Vérité de fin de partie (§3.10). À ne publier qu'une fois la partie terminée. */
  reveal(): Reveal {
    const { secrets, ids } = this.#secretChoice();
    const secret = (color: Color) => ({
      pieceId: ids[color],
      initialSquare: secrets[color],
      finalSquare: this.secretSquare(color),
    });
    return {
      secrets: { w: secret('w'), b: secret('b') },
      realInitialFen: this.#realInitialFen,
      plies: this.#realPlies.map((ply) => ({ ...ply })),
    };
  }

  /** FEN réelles : position initiale puis position après chaque demi-coup. */
  positions(): string[] {
    return [this.#realInitialFen, ...this.#realPlies.map((ply) => ply.realFenAfter)];
  }

  /** Coups légaux du camp au trait dans la position réelle (aucun si la partie est finie). */
  legalMoves(): { from: Square; to: Square }[] {
    if (this.#result !== null) return [];
    const seen = new Set<string>();
    const moves: { from: Square; to: Square }[] = [];
    for (const move of this.#chess.moves({ verbose: true })) {
      // Les quatre promotions possibles d'un même coup ne comptent qu'une fois.
      if (seen.has(move.lan.slice(0, 4))) continue;
      seen.add(move.lan.slice(0, 4));
      moves.push({ from: move.from, to: move.to });
    }
    return moves;
  }

  /** Coups joués (intentions normalisées), pour la persistance. */
  intents(): MoveIntent[] {
    return this.#intents.map((intent) => ({ ...intent }));
  }

  /** Fin appliquée par le serveur, pour la persistance. */
  get externalResult(): GameResult | null {
    return this.#externalResult === null ? null : { ...this.#externalResult };
  }

  persisted(): PersistedGame {
    return {
      version: 1,
      secrets: { ...this.#secretChoice().secrets },
      moves: this.#intents.map((intent) => ({ ...intent })),
      externalResult: this.#externalResult === null ? null : { ...this.#externalResult },
    };
  }

  /** Refus sans motif si : partie terminée, mauvais camp, coup illégal dans la position réelle. */
  play(color: Color, intent: MoveIntent): PlayResult {
    if (this.#result !== null || color !== this.#chess.turn()) return refused();
    const parsed = parseIntent(intent);
    if (parsed === null) return refused();
    const piece = this.#pieces.get(parsed.from);
    if (piece === undefined || piece.color !== color) return refused();

    const board = this.#publicBoard();
    let move: Move;
    try {
      // La promotion n'est retenue par chess.js que pour la promotion d'un vrai pion : elle est
      // ignorée pour tout autre coup, dame secrète comprise. Un vrai pion qui atteint la dernière
      // rangée sans promotion est refusé.
      move = this.#chess.move(parsed);
    } catch {
      return refused();
    }
    return { ok: true, ...this.#record(color, piece, board, move) };
  }

  /** Fin appliquée par le serveur (abandon, nulle par accord, chute du drapeau). */
  endExternally(result: GameResult): GameResult {
    if (this.#result !== null) throw new Error(GAME_OVER);
    this.#result = { ...result };
    this.#externalResult = { ...result };
    return { ...result };
  }

  /** Chute du drapeau de `color` : défaite, ou nulle si l'adversaire ne peut pas mater. */
  flagFall(color: Color): GameResult {
    if (this.#result !== null) throw new Error(GAME_OVER);
    const opponent = opposite(color);
    const realPieces: RealPiece[] = [...this.#pieces].map(([square, p]) => ({
      color: p.color,
      type: p.real,
      square,
    }));
    return this.endExternally(
      cannotMate(realPieces, opponent)
        ? { winner: null, reason: 'timeout-vs-insufficient-material' }
        : { winner: opponent, reason: 'timeout' },
    );
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }

  [INSPECT](): string {
    return REDACTED;
  }

  /** Choix secrets d'une partie Secret Queen (erreur en classique). */
  #secretChoice(): { secrets: SecretChoice; ids: Readonly<Record<Color, PieceId>> } {
    if (this.#secrets === null || this.#secretIds === null) throw new Error(NOT_SECRET_QUEEN);
    return { secrets: this.#secrets, ids: this.#secretIds };
  }

  /** Échiquier public : types affichés uniquement. */
  #publicBoard(): PublicBoard {
    const board = new Map<Square, PublicPiece>();
    for (const [square, piece] of this.#pieces) {
      board.set(square, { color: piece.color, type: piece.displayed });
    }
    return board;
  }

  /** Met à jour le suivi des pièces et l'historique après le coup réel `move`. */
  #record(
    color: Color,
    piece: TrackedPiece,
    board: PublicBoard,
    move: Move,
  ): { move: PublicMove; result: GameResult | null } {
    const from = move.from;
    const to = move.to;
    const enPassant = move.isEnPassant();
    const captureSquare: Square | null = enPassant
      ? (`${to[0]}${from[1]}` as Square)
      : move.isCapture()
        ? to
        : null;
    const captured = captureSquare === null ? undefined : this.#pieces.get(captureSquare);
    const castleSide = move.isKingsideCastle() ? 'king' : move.isQueensideCastle() ? 'queen' : null;
    const promotion = move.isPromotion() ? (move.promotion as PromotionPiece) : null;
    const check = this.#chess.inCheck();
    const mate = check && this.#chess.isCheckmate();
    const stalemate = !check && this.#chess.isStalemate();

    // Classique : notation SAN standard de chess.js (rien n'est caché).
    const san =
      this.#secretIds === null
        ? move.san
        : publicSan({
            board,
            color,
            displayedType: piece.displayed,
            isSecretQueen: piece.id === this.#secretIds[color],
            from,
            to,
            enPassant,
            promotion,
            castle: castleSide,
            check,
            mate,
          });

    let castle: PublicMove['castle'] = null;
    if (castleSide !== null) {
      const rank = color === 'w' ? '1' : '8';
      const rookFrom: Square = `${castleSide === 'king' ? 'h' : 'a'}${rank}`;
      const rookTo: Square = `${castleSide === 'king' ? 'f' : 'd'}${rank}`;
      const rook = this.#pieces.get(rookFrom) as TrackedPiece;
      castle = { rookId: rook.id, rookFrom, rookTo };
      this.#pieces.delete(rookFrom);
      this.#pieces.set(rookTo, rook);
    }

    const publicMove: PublicMove = {
      ply: this.#moves.length + 1,
      color,
      pieceId: piece.id,
      displayedType: piece.displayed,
      from,
      to,
      san,
      capture:
        captured === undefined || captureSquare === null
          ? null
          : { pieceId: captured.id, displayedType: captured.displayed, square: captureSquare },
      promotion,
      castle,
      check,
      checkmate: mate,
    };

    if (captured !== undefined && captureSquare !== null) {
      this.#pieces.delete(captureSquare);
      this.#captured[captured.color].push(captured.displayed);
    }
    this.#pieces.delete(from);
    if (promotion !== null) {
      piece.displayed = promotion;
      piece.real = promotion;
    }
    this.#pieces.set(to, piece);

    this.#moves.push(publicMove);
    this.#intents.push(promotion === null ? { from, to } : { from, to, promotion });
    this.#realPlies.push({ realSan: move.san, realFenAfter: move.after });
    const repeated = this.#countRepetition(move.after) >= 3;
    this.#result = this.#automaticEnd(color, mate, stalemate, repeated);
    return { move: copyMove(publicMove), result: this.result };
  }

  /** Fins automatiques, toutes jugées sur la position réelle (§5). Le mat prime. */
  #automaticEnd(
    mover: Color,
    mate: boolean,
    stalemate: boolean,
    repeated: boolean,
  ): GameResult | null {
    if (mate) return { winner: mover, reason: 'checkmate' };
    if (stalemate) return { winner: null, reason: 'stalemate' };
    if (this.#chess.isInsufficientMaterial()) {
      return { winner: null, reason: 'insufficient-material' };
    }
    if (this.#chess.isDrawByFiftyMoves()) return { winner: null, reason: 'fifty-move-rule' };
    if (repeated) return { winner: null, reason: 'threefold-repetition' };
    return null;
  }

  #countRepetition(fen: string): number {
    const key = repetitionKey(fen);
    const count = (this.#repetitions.get(key) ?? 0) + 1;
    this.#repetitions.set(key, count);
    return count;
  }
}
