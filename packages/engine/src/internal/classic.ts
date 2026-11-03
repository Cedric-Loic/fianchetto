import { COLORS, opposite, type Color, type GameResult, type MoveIntent } from '@sq/shared';
import { Secret } from '@sq/shared/secret';
import type { PersistedClassicGame, PlayResult } from '../types.js';
import { CLASSIC, GameCore } from './core.js';
import { parseHistory, replayHistory } from './game.js';

/*
 * Partie d'échecs classique. Même noyau que Secret Queen (suivi des pièces, fins automatiques,
 * pendule), sans dame secrète : la position publique EST la position réelle et la notation est
 * la SAN standard. Le serveur la manipule avec la même interface que `SecretQueenGame` ; seule
 * `projectClassic` en produit la vue.
 */

const INVALID_PERSISTED = 'Partie persistée invalide.';
const INVALID_COLOR = 'Camp invalide.';
const INVALID_GAME = 'Partie invalide.';

let readCore: (game: ClassicGame) => GameCore;

function assertColor(color: unknown): asserts color is Color {
  if (!(COLORS as readonly unknown[]).includes(color)) throw new Error(INVALID_COLOR);
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export class ClassicGame {
  readonly #core: GameCore;
  /** Position de départ si elle n'est pas standard. */
  readonly #initialFen: string | undefined;

  private constructor(core: GameCore, initialFen?: string) {
    this.#core = core;
    this.#initialFen = initialFen;
  }

  static {
    readCore = (game) => {
      if (!(#core in game)) throw new Error(INVALID_GAME);
      return game.#core;
    };
  }

  /**
   * Nouvelle partie, depuis la position initiale ou une FEN (rejouer à partir d'une erreur).
   * Lève une erreur si la FEN est invalide ou si la partie y est déjà finie.
   */
  static create(initialFen?: string): ClassicGame {
    const fen = initialFen === START ? undefined : initialFen;
    return new ClassicGame(new GameCore(CLASSIC, fen), fen);
  }

  /** Rejoue une partie persistée. Lève une erreur (sans détail) si elle est incohérente. */
  static restore(persisted: Secret<PersistedClassicGame>): ClassicGame {
    if (!Secret.isSecret(persisted)) throw new Error(INVALID_PERSISTED);
    const data: unknown = persisted.expose();
    if (typeof data !== 'object' || data === null) throw new Error(INVALID_PERSISTED);
    const record = data as Record<string, unknown>;
    if (record.variant !== 'classic') throw new Error(INVALID_PERSISTED);
    const fen = record.initialFen;
    if (fen !== undefined && typeof fen !== 'string') throw new Error(INVALID_PERSISTED);
    let core: GameCore;
    try {
      core = new GameCore(CLASSIC, fen);
    } catch {
      throw new Error(INVALID_PERSISTED);
    }
    replayHistory(core, parseHistory(record));
    return new ClassicGame(core, fen);
  }

  get turn(): Color {
    return this.#core.turn;
  }

  get plyCount(): number {
    return this.#core.plyCount;
  }

  get isOver(): boolean {
    return this.#core.result !== null;
  }

  get result(): GameResult | null {
    return this.#core.result;
  }

  /** Refus sans motif si : partie terminée, mauvais camp, coup illégal. */
  play(color: Color, intent: MoveIntent): PlayResult {
    return this.#core.play(color, intent);
  }

  resign(color: Color): GameResult {
    assertColor(color);
    return this.#core.endExternally({ winner: opposite(color), reason: 'resignation' });
  }

  agreeDraw(): GameResult {
    return this.#core.endExternally({ winner: null, reason: 'agreement' });
  }

  /** Chute du drapeau de `color` : défaite, ou nulle si l'adversaire n'a pas de quoi mater. */
  flagFall(color: Color): GameResult {
    assertColor(color);
    return this.#core.flagFall(color);
  }

  /** FEN de la position initiale puis après chaque demi-coup (analyse, export). */
  positions(): string[] {
    return this.#core.positions();
  }

  /**
   * La même partie sans ses `count` derniers demi-coups (reprise de coup en entraînement).
   * Une fin de partie éventuelle est annulée.
   */
  withoutLastMoves(count: number): ClassicGame {
    const core = new GameCore(CLASSIC, this.#initialFen);
    const moves = this.#core.intents();
    replayHistory(core, {
      moves: moves.slice(0, Math.max(0, moves.length - count)),
      externalResult: null,
    });
    return new ClassicGame(core, this.#initialFen);
  }

  toPersisted(): Secret<PersistedClassicGame> {
    return new Secret({
      version: 1,
      variant: 'classic',
      ...(this.#initialFen ? { initialFen: this.#initialFen } : {}),
      moves: this.#core.intents(),
      externalResult: this.#core.externalResult,
    });
  }
}

/** Accès au noyau, réservé au moteur (non exporté par index.ts). */
export function classicCoreOf(game: ClassicGame): GameCore {
  return readCore(game);
}
