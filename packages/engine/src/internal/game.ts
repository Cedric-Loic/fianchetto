import {
  COLORS,
  GameResultSchema,
  MoveIntentSchema,
  opposite,
  type Color,
  type GameResult,
  type MoveIntent,
} from '@sq/shared';
import { REDACTED, Secret } from '@sq/shared/secret';
import type { PersistedGame, PlayResult, SecretChoice } from '../types.js';
import { GameCore } from './core.js';

/*
 * Objet partie remis au serveur. Tout l'état réel vit dans un GameCore gardé dans le champ privé
 * `#core` : il n'apparaît ni dans JSON.stringify, ni dans util.inspect, ni dans structuredClone.
 * Seuls le moteur (`coreOf`, non exporté par index.ts) et `projectForViewer` y accèdent.
 */

const INSPECT = Symbol.for('nodejs.util.inspect.custom');

const INVALID_PERSISTED = 'Partie persistée invalide.';
const INVALID_COLOR = 'Camp invalide.';

let readCore: (game: SecretQueenGame) => GameCore;

function assertColor(color: unknown): asserts color is Color {
  if (!(COLORS as readonly unknown[]).includes(color)) throw new Error(INVALID_COLOR);
}

/** Une fin externe persistée est cohérente : bon motif, vainqueur présent ssi défaite. */
function isExternalResult(result: GameResult): boolean {
  switch (result.reason) {
    case 'resignation':
    case 'timeout':
      return result.winner !== null;
    case 'agreement':
    case 'timeout-vs-insufficient-material':
      return result.winner === null;
    default:
      return false;
  }
}

function parsePersisted(data: unknown): PersistedGame {
  if (typeof data !== 'object' || data === null) throw new Error(INVALID_PERSISTED);
  const { version, secrets, moves, externalResult } = data as Record<string, unknown>;
  if (version !== 1 || !Array.isArray(moves)) throw new Error(INVALID_PERSISTED);
  const intents = moves.map((move): MoveIntent => {
    const parsed = MoveIntentSchema.safeParse(move);
    if (!parsed.success) throw new Error(INVALID_PERSISTED);
    return parsed.data;
  });
  let result: GameResult | null = null;
  if (externalResult !== null) {
    const parsed = GameResultSchema.safeParse(externalResult);
    if (!parsed.success || !isExternalResult(parsed.data)) throw new Error(INVALID_PERSISTED);
    result = parsed.data;
  }
  // Les secrets sont validés par GameCore.
  return { version: 1, secrets: secrets as SecretChoice, moves: intents, externalResult: result };
}

export class SecretQueenGame {
  readonly #core: GameCore;

  private constructor(core: GameCore) {
    this.#core = core;
  }

  static {
    readCore = (game) => {
      if (!(#core in game)) throw new Error('Partie invalide.');
      return game.#core;
    };
  }

  /** Lève une erreur si une case n'est pas une case de départ de pion de la bonne couleur. */
  static create(secrets: SecretChoice): SecretQueenGame {
    return new SecretQueenGame(new GameCore(secrets));
  }

  /** Rejoue une partie persistée. Lève une erreur (sans détail) si elle est incohérente. */
  static restore(persisted: Secret<PersistedGame>): SecretQueenGame {
    if (!Secret.isSecret(persisted)) throw new Error(INVALID_PERSISTED);
    const data = parsePersisted(persisted.expose());
    const core = new GameCore(data.secrets);
    for (const intent of data.moves) {
      if (!core.play(core.turn, intent).ok) throw new Error(INVALID_PERSISTED);
    }
    if (data.externalResult !== null) {
      if (core.result !== null) throw new Error(INVALID_PERSISTED);
      core.endExternally(data.externalResult);
    }
    return new SecretQueenGame(core);
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

  /** Refus sans motif si : partie terminée, mauvais camp, coup illégal dans la position réelle. */
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

  toPersisted(): Secret<PersistedGame> {
    return new Secret(this.#core.persisted());
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }

  [Symbol.toPrimitive](): string {
    return REDACTED;
  }

  [INSPECT](): string {
    return REDACTED;
  }

  get [Symbol.toStringTag](): string {
    return 'SecretQueenGame';
  }
}

/** Accès à l'état réel, réservé au moteur (non exporté par index.ts). */
export function coreOf(game: SecretQueenGame): GameCore {
  return readCore(game);
}
