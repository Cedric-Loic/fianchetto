import {
  ENDGAMES,
  endgameByFen,
  endgameById,
  endgameColor,
  endgameSucceeded,
  type Endgame,
} from '@sq/coach';
import type { BotLevel, EndgameSummary, GameResult } from '@sq/shared';
import type { GameManager } from '../games/manager.js';
import type { GameSession } from '../games/session.js';
import type { LearningService } from '../coach/learning.js';
import type { GameStore } from '../persistence/db.js';

/**
 * Finales contre le bot (lot 4b) : liste avec progression, démarrage d'une partie
 * d'entraînement classique depuis la position (bot au niveau le plus fort, non classée), et
 * notation à la fin. Une partie est reconnue comme finale par sa position de départ : la
 * revanche (« Réessayer » depuis la partie) compte donc aussi.
 */
export class EndgameService {
  readonly #store: GameStore;
  readonly #games: GameManager;
  readonly #learning: LearningService;
  /** Plus haut niveau d'indice consulté pendant l'essai en cours, par joueur et finale. */
  readonly #hinted = new Map<string, number>();

  constructor(store: GameStore, games: GameManager, learning: LearningService) {
    this.#store = store;
    this.#games = games;
    this.#learning = learning;
  }

  /** Niveau du bot à pleine force : le plus haut niveau configuré. */
  get #maxLevel(): BotLevel {
    return Math.max(...this.#games.config.botLevels.map((l) => l.level));
  }

  list(userId: string): EndgameSummary[] {
    const progress = new Map(this.#store.endgameProgress(userId).map((p) => [p.endgameId, p]));
    const due = this.#learning.dueEndgames(userId);
    return ENDGAMES.map((e) => {
      const p = progress.get(e.id);
      return {
        id: e.id,
        title: e.title,
        objective: e.objective,
        fen: e.fen,
        color: endgameColor(e),
        goal: e.goal,
        lesson: e.lesson ?? null,
        attempts: p?.attempts ?? 0,
        passed: (p?.successes ?? 0) > 0,
        stage: e.stage ?? 1,
        maxMoves: e.maxMoves ?? null,
        hints: e.hints?.length ?? 0,
        skill: e.skill ?? 'pawn-endgames',
        due: due.has(e.id),
      };
    });
  }

  /**
   * Indice `level` (1 à 3) de la finale `id`, servi à la demande seulement. `null` : finale
   * inconnue ou sans indice à ce niveau. La consultation est retenue pour l'essai en cours.
   */
  hint(userId: string, id: string, level: number): string | null {
    const text = endgameById(id)?.hints?.[level - 1];
    if (text === undefined) return null;
    const key = `${userId}|${id}`;
    this.#hinted.set(key, Math.max(this.#hinted.get(key) ?? 0, level));
    return text;
  }

  /** Nouvelle partie depuis la finale `id`. `null` : finale inconnue. */
  start(userId: string, id: string): string | null {
    const endgame = endgameById(id);
    if (!endgame) return null;
    this.#hinted.delete(`${userId}|${id}`); // nouvel essai : les indices repartent de zéro
    return this.#games.createBotGame({
      variant: 'classic',
      userId,
      level: this.#maxLevel,
      timeControl: 'untimed',
      color: endgameColor(endgame),
      training: true,
      fen: endgame.fen,
    }).id;
  }

  /** Finale jouée par cette partie : entraînement, depuis sa position, contre le bot le plus fort. */
  #endgameOf(session: GameSession): Endgame | undefined {
    if (session.mode !== 'bot' || !session.training || !session.initialFen) return undefined;
    const endgame = endgameByFen(session.initialFen);
    if (!endgame || !session.botColor || session.botColor === endgameColor(endgame))
      return undefined;
    if (session.players[session.botColor].botLevel !== this.#maxLevel) return undefined;
    return endgame;
  }

  /** Fin d'une partie : note la finale si c'en est une. */
  onGameEnd(session: GameSession, result: GameResult): void {
    const endgame = this.#endgameOf(session);
    if (!endgame || !session.ownerId) return;
    const userId = session.ownerId;
    // Coups du joueur (il a le trait au départ) ; les reprises annulées ne comptent pas.
    const moves = Math.ceil(session.plyCount / 2);
    const success =
      endgameSucceeded(endgame, result) &&
      (endgame.maxMoves === undefined || moves <= endgame.maxMoves);
    const key = `${userId}|${endgame.id}`;
    const hints = this.#hinted.get(key) ?? 0;
    this.#hinted.delete(key);
    this.#store.saveEndgameResult(userId, endgame.id, success);
    this.#learning.recordEndgame(userId, endgame.id, success, hints, moves);
  }
}
