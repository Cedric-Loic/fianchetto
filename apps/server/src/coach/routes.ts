import type { FastifyInstance } from 'fastify';
import { LESSONS, PASS_RATIO, buildDashboard, timeClassOf, type DashboardGame } from '@sq/coach';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import type { PuzzleService } from '../puzzles/service.js';

/** Cadences locales considérées comme lentes (le plan recommande des parties 15+10). */
const SLOW_LOCAL = new Set(['rapid-10+0', 'untimed']);

/** Rassemble les données du tableau de bord d'un utilisateur. */
export function dashboardFor(
  store: GameStore,
  puzzles: PuzzleService,
  userId: string,
  now = new Date(),
) {
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
    });
  }
  const stats = puzzles.stats(userId);
  const progress = new Map(store.lessonProgress(userId).map((p) => [p.lessonId, p]));
  return buildDashboard({
    now,
    games,
    puzzleAttempts: store.puzzles.attempts(userId).map((a) => ({
      at: a.at,
      success: a.success === 1,
      ratingAfter: a.ratingAfter,
      themes: a.themes,
    })),
    puzzleRating: stats.rating,
    lessons: LESSONS.map((l) => {
      const p = progress.get(l.id);
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
    duePuzzles: stats.available.due,
    ownPuzzles: stats.available.mine,
  });
}

/** Tableau de bord du coach (étape 11). */
export function registerCoachRoutes(
  app: FastifyInstance,
  store: GameStore,
  puzzles: PuzzleService,
) {
  app.get('/api/coach/dashboard', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    return dashboardFor(store, puzzles, user.id);
  });
}
