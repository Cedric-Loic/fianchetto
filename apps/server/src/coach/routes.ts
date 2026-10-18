import { OpeningService } from '../openings/service.js';
import type { FastifyInstance } from 'fastify';
import {
  ENDGAMES,
  LESSONS,
  PASS_RATIO,
  buildDashboard,
  guardActive,
  initialClockMs,
  pgnClocks,
  timeClassOf,
  type BotResult,
  type DashboardGame,
} from '@sq/coach';
import type { CoachDashboard, GameConfig, GameSummary } from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import type { PuzzleService } from '../puzzles/service.js';

/** Cadences locales considérées comme lentes (le plan recommande des parties 15+10). */
const SLOW_LOCAL = new Set(['rapid-10+0', 'untimed']);
/** Revues comptées au plus par jour quand seule la date de revue est connue (règle du coach). */
const MAX_LEGACY_ANALYSES_PER_DAY = 2;

export type BotLevels = GameConfig['botLevels'];

const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Durée réelle d'une partie terminée (ms), `null` si inconnue. */
function durationOf(g: GameSummary): number | null {
  if (!g.endedAt) return null;
  const ms = Date.parse(g.endedAt) - Date.parse(g.startedAt);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** Résultats des parties classiques contre le bot, avec le niveau du bot (niveau conseillé). */
function botResultsOf(history: GameSummary[], botLevels: BotLevels): BotResult[] {
  const levelOf = new Map(botLevels.map((l) => [l.name, l.level]));
  return history.flatMap((g) => {
    const level = levelOf.get(g.opponentName);
    if (g.mode !== 'bot' || g.variant !== 'classic' || !g.endedAt || !g.reason || !level) {
      return [];
    }
    const score = g.winner === g.color ? 1 : g.winner === null ? 0.5 : 0;
    return [{ level, score, at: Date.parse(g.endedAt) }];
  });
}

/**
 * Séances d'analyse : revues ouvertes (enregistrées depuis l'étape 13). Avant le jour de la
 * première séance enregistrée, on garde l'ancienne estimation (date de revue, au plus 2 par jour) pour ne pas
 * effacer l'historique ; `undefined` si rien n'est enregistré (le coach applique ce repli seul).
 */
/** Finales (lot 4b) : réussies au moins une fois ? */
function endgamesOf(store: GameStore, userId: string) {
  const passed = new Set(
    store
      .endgameProgress(userId)
      .filter((p) => p.successes > 0)
      .map((p) => p.endgameId),
  );
  return ENDGAMES.map((e) => ({ id: e.id, title: e.title, passed: passed.has(e.id) }));
}

function analysisSessionsOf(
  recorded: number[],
  reviewedAt: (number | null)[],
): number[] | undefined {
  const first = recorded[0];
  if (first === undefined) return undefined;
  // Jours d'avant la première séance seulement : la revue consultée ce jour-là est déjà comptée.
  const d = new Date(first);
  const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const perDay = new Map<string, number>();
  const legacy = reviewedAt.flatMap((at) => {
    if (at === null || at >= cutoff) return [];
    const n = perDay.get(localDay(at)) ?? 0;
    if (n >= MAX_LEGACY_ANALYSES_PER_DAY) return [];
    perDay.set(localDay(at), n + 1);
    return [at];
  });
  return [...legacy, ...recorded];
}

/** Rassemble les données du tableau de bord d'un utilisateur. */
export function dashboardFor(
  store: GameStore,
  puzzles: PuzzleService,
  userId: string,
  botLevels: BotLevels,
  now = new Date(),
): CoachDashboard {
  const games: DashboardGame[] = [];
  for (const row of store.listImported(userId)) {
    if (!row.userColor || !row.date) continue;
    const timeClass = timeClassOf(row.timeControl);
    games.push({
      id: row.id,
      date: row.date,
      color: row.userColor,
      review: store.getReview(row.id) ?? null,
      reviewedAt: store.reviewDate(row.id),
      slow: timeClass === 'rapid' || timeClass === 'daily',
      source: row.source,
      timeClass,
      userElo: row.userColor === 'w' ? row.whiteElo : row.blackElo,
      // Pendule relue dans le PGN enregistré (pas de migration : les anciens imports en profitent).
      clocks: timeClass === 'daily' ? null : pgnClocks(row.pgn),
      initialClockMs: initialClockMs(row.timeControl),
    });
  }
  const history = store.history(userId);
  // Parties locales classiques contre le bot (le profil de faiblesses ignore Secret Queen).
  for (const g of history) {
    if (g.mode !== 'bot' || g.variant !== 'classic' || !g.endedAt) continue;
    games.push({
      id: g.gameId,
      date: g.endedAt.slice(0, 10),
      color: g.color,
      review: store.getReview(g.gameId) ?? null,
      reviewedAt: store.reviewDate(g.gameId),
      slow: SLOW_LOCAL.has(g.timeControl),
      source: 'local',
      timeClass: null,
      userElo: null,
      durationMs: durationOf(g),
    });
  }
  const summary = puzzles.summary(userId);
  const progress = store.lessonProgress(userId);
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  // Leçons : séances enregistrées, plus la date de mise à jour des leçons d'avant l'étape 13.
  const lessonActivity = store.activity(userId, 'lesson');
  const withSession = new Set(lessonActivity.map((a) => a.ref));
  const lessonSessions = [
    ...progress.filter((p) => !withSession.has(p.lessonId)).map((p) => p.updatedAt),
    ...lessonActivity.map((a) => a.at),
  ];
  const analysisSessions = analysisSessionsOf(
    store.activity(userId, 'analysis').map((a) => a.at),
    games.map((g) => g.reviewedAt),
  );
  return buildDashboard({
    now,
    dueOpenings: new OpeningService(store).dueCount(userId),
    games,
    puzzleAttempts: store.puzzles.attempts(userId).map((a) => ({
      at: a.at,
      success: a.success === 1,
      ratingAfter: a.ratingAfter,
      themes: a.themes,
      durationMs: a.durationMs,
    })),
    puzzleRating: summary.rating,
    lessons: LESSONS.map((l) => {
      const p = byLesson.get(l.id);
      return {
        id: l.id,
        phase: l.phase,
        title: l.title,
        passed: !!p && p.best >= Math.ceil(PASS_RATIO * l.exercises.length),
        updatedAt: p?.updatedAt ?? null,
      };
    }),
    classicRatings: history.flatMap((g) =>
      g.variant === 'classic' && g.rated && g.ratingAfter !== null && g.endedAt
        ? [{ date: g.endedAt.slice(0, 10), rating: g.ratingAfter }]
        : [],
    ),
    duePuzzles: summary.due,
    ownPuzzles: summary.mine,
    lessonSessions,
    ...(analysisSessions ? { analysisSessions } : {}),
    botResults: botResultsOf(history, botLevels),
    endgames: endgamesOf(store, userId),
  });
}

/**
 * Coach côté serveur : tableau de bord, thème du jour (puzzles) et garde-fou dégressif, tous
 * tirés du même calcul (`buildDashboard`) pour ne pas dupliquer phase et thèmes faibles.
 */
export class CoachService {
  readonly #store: GameStore;
  readonly #botLevels: BotLevels;
  /** Fixé après coup : le service de puzzles a lui-même besoin du thème du jour. */
  #puzzles: PuzzleService | null = null;
  /** Garde-fou décidé une fois par partie (la phase peut changer en cours de partie). */
  readonly #guard = new Map<string, boolean>();

  constructor(store: GameStore, botLevels: BotLevels) {
    this.#store = store;
    this.#botLevels = botLevels;
  }

  attach(puzzles: PuzzleService): void {
    this.#puzzles = puzzles;
  }

  dashboard(userId: string, now = new Date()): CoachDashboard {
    if (!this.#puzzles) throw new Error('Service de puzzles non branché.');
    return dashboardFor(this.#store, this.#puzzles, userId, this.#botLevels, now);
  }

  themeOfDay(userId: string): string {
    return this.dashboard(userId).themeOfDay;
  }

  /**
   * Garde-fou actif pour une partie d'entraînement : `guardActive(phase, rang de la partie)`.
   * Le réglage de l'utilisateur reste l'interrupteur maître : sans lui, le client n'appelle pas.
   */
  guardActiveFor(gameId: string, userId: string, startedAt: string): boolean {
    const known = this.#guard.get(gameId);
    if (known !== undefined) return known;
    const active = guardActive(
      this.dashboard(userId).phase.current,
      this.#store.trainingGameIndex(userId, startedAt),
    );
    if (this.#guard.size >= 500) {
      const oldest = this.#guard.keys().next().value;
      if (oldest !== undefined) this.#guard.delete(oldest);
    }
    this.#guard.set(gameId, active);
    return active;
  }
}

/** Tableau de bord du coach (étape 11). */
export function registerCoachRoutes(app: FastifyInstance, store: GameStore, coach: CoachService) {
  app.get('/api/coach/dashboard', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    return coach.dashboard(user.id);
  });
}
