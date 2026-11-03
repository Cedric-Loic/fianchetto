import { Chess } from 'chess.js';
import {
  OPENING_LINES,
  nextOpeningSchedule,
  openingLearned,
  openingLineById,
  openingLineSteps,
  repertoireDeviation,
  type OpeningLine,
} from '@sq/coach';
import type {
  Color,
  OpeningDeviation,
  OpeningDrill,
  OpeningLineSummary,
  OpeningNextResponse,
  OpeningsResponse,
} from '@sq/shared';
import { legalMoves } from '../chess-utils.js';
import type { GameStore, OpeningProgressRow } from '../persistence/db.js';
import { REVIEW_INTERVALS_DAYS } from '../persistence/puzzles.js';

/**
 * Répertoire d'ouvertures (lot 4d) : liste des lignes avec leur état de révision, ligne à
 * réviser (la plus en retard des lignes dues, sinon la prochaine nouvelle), enregistrement d'une
 * révision en répétition espacée (mêmes intervalles que les puzzles), écart d'une partie avec le
 * répertoire pour la revue. Le répertoire n'a rien de secret : la ligne complète est envoyée.
 */
export class OpeningService {
  readonly #store: GameStore;
  readonly #now: () => number;

  constructor(store: GameStore, now: () => number = Date.now) {
    this.#store = store;
    this.#now = now;
  }

  #summary(line: OpeningLine, row: OpeningProgressRow | undefined): OpeningLineSummary {
    const now = this.#now();
    return {
      id: line.id,
      color: line.color,
      group: line.group,
      title: line.title,
      idea: line.idea,
      moves: [...line.moves],
      status: !row ? 'new' : openingLearned(row, REVIEW_INTERVALS_DAYS) ? 'learned' : 'learning',
      dueAt: row?.dueAt ?? null,
      due: row !== undefined && row.dueAt <= now,
    };
  }

  #progress(userId: string): Map<string, OpeningProgressRow> {
    return new Map(this.#store.openingProgress(userId).map((r) => [r.lineId, r]));
  }

  list(userId: string): OpeningsResponse {
    const progress = this.#progress(userId);
    const lines = OPENING_LINES.map((l) => this.#summary(l, progress.get(l.id)));
    return { lines, due: lines.filter((l) => l.due).length };
  }

  /** Nombre de lignes dues (recommandation du coach). */
  dueCount(userId: string): number {
    return this.list(userId).due;
  }

  /** Entraînement sur une ligne précise. `null` : ligne inconnue. */
  drill(userId: string, id: string): OpeningDrill | null {
    const line = openingLineById(id);
    if (!line) return null;
    return this.#drillOf(line, this.#progress(userId).get(id));
  }

  #drillOf(line: OpeningLine, row: OpeningProgressRow | undefined): OpeningDrill {
    const steps = openingLineSteps(line).map((s, i) => ({
      uci: s.uci,
      san: s.san,
      fen: s.fen,
      // Coups légaux seulement avant les coups du joueur (affichage et refus des coups illégaux).
      legalMoves:
        (i % 2 === 0 ? 'w' : 'b') === line.color ? legalMoves(new Chess(s.fenBefore)) : [],
    }));
    return { line: this.#summary(line, row), steps };
  }

  /** Ligne à réviser : la plus en retard des lignes dues, sinon la première ligne nouvelle. */
  next(userId: string, color: Color | null = null): OpeningNextResponse {
    const progress = this.#progress(userId);
    const now = this.#now();
    const pool = OPENING_LINES.filter((l) => color === null || l.color === color);
    const due = pool
      .filter((l) => (progress.get(l.id)?.dueAt ?? Infinity) <= now)
      .sort((a, b) => (progress.get(a.id)?.dueAt ?? 0) - (progress.get(b.id)?.dueAt ?? 0))[0];
    if (due) return { drill: this.#drillOf(due, progress.get(due.id)), reason: 'due' };
    const fresh = pool.find((l) => !progress.has(l.id));
    if (fresh) return { drill: this.#drillOf(fresh, undefined), reason: 'new' };
    return { drill: null, reason: null };
  }

  /** Révision terminée : réussie (aucune erreur) ou non. `null` : ligne inconnue. */
  result(userId: string, id: string, success: boolean): OpeningLineSummary | null {
    const line = openingLineById(id);
    if (!line) return null;
    const previous = this.#progress(userId).get(id) ?? null;
    const schedule = nextOpeningSchedule(previous, success, this.#now(), REVIEW_INTERVALS_DAYS);
    this.#store.saveOpeningReview(userId, id, schedule, success);
    return this.#summary(line, this.#progress(userId).get(id));
  }

  deviation(moves: readonly string[], color: Color): OpeningDeviation | null {
    return repertoireDeviation(moves, color);
  }
}
