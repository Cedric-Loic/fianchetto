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

export class ClassicGame {
  readonly #core: GameCore;

  private constructor(core: GameCore) {
    this.#core = core;
  }

  static {
    readCore = (game) => {
      if (!(#core in game)) throw new Error(INVALID_GAME);
      return game.#core;
    };
  }

  static create(): ClassicGame {
    return new ClassicGame(new GameCore(CLASSIC));
  }

  /** Rejoue une partie persistée. Lève une erreur (sans détail) si elle est incohérente. */
  static restore(persisted: Secret<PersistedClassicGame>): ClassicGame {
    if (!Secret.isSecret(persisted)) throw new Error(INVALID_PERSISTED);
    const data: unknown = persisted.expose();
    if (typeof data !== 'object' || data === null) throw new Error(INVALID_PERSISTED);
    if ((data as Record<string, unknown>).variant !== 'classic') {
      throw new Error(INVALID_PERSISTED);
    }
    const core = new GameCore(CLASSIC);
    replayHistory(core, parseHistory(data as Record<string, unknown>));
    return new ClassicGame(core);
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

  toPersisted(): Secret<PersistedClassicGame> {
    return new Secret({
      version: 1,
      variant: 'classic',
      moves: this.#core.intents(),
      externalResult: this.#core.externalResult,
    });
  }
}

/** Accès au noyau, réservé au moteur (non exporté par index.ts). */
export function classicCoreOf(game: ClassicGame): GameCore {
  return readCore(game);
}
