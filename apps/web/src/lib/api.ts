import type {
  BotLevelInfo,
  CoachDashboard,
  CheckMoveResponse,
  HintResponse,
  ImportedGamesResponse,
  ImportResult,
  LeaderboardResponse,
  LessonMoveResponse,
  LessonsResponse,
  LessonSummary,
  LessonView,
  ProfileResponse,
  PuzzleMode,
  PuzzleMoveResponse,
  PuzzleNextResponse,
  PuzzleStats,
  ReviewResponse,
  RetryMoveResponse,
  UserPublic,
  Variant,
} from '@sq/shared';

/** Réponse d'un appel REST : données, ou statut et code d'erreur du serveur. */
export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Appel REST détaillé (statut et code d'erreur en cas d'échec ; statut 0 = réseau). */
async function request<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const json = (await res.json().catch(() => ({}))) as unknown;
    if (res.ok) return { ok: true, data: json as T };
    const error = (json as { error?: unknown }).error;
    return { ok: false, status: res.status, error: typeof error === 'string' ? error : '' };
  } catch {
    return { ok: false, status: 0, error: 'NETWORK' };
  }
}

/** Appel REST ; `null` en cas d'erreur HTTP ou réseau (serveur arrêté…). */
async function call<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await request<T>(method, path, body);
  return res.ok ? res.data : null;
}

export const api = {
  me: () => call<UserPublic>('GET', '/api/auth/me'),
  login: (username: string, password: string) =>
    call<UserPublic>('POST', '/api/auth/login', { username, password }),
  register: (username: string, password: string) =>
    call<UserPublic>('POST', '/api/auth/register', { username, password }),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout'),
  botLevels: () => call<BotLevelInfo[]>('GET', '/api/bot-levels'),
  leaderboard: (variant: Variant) =>
    call<LeaderboardResponse>('GET', `/api/leaderboard?variant=${variant}`),
  profile: (username: string) =>
    call<ProfileResponse>('GET', `/api/profile/${encodeURIComponent(username)}`),
  activeGame: () => call<{ gameId: string | null }>('GET', '/api/games/active'),
  createGame: (body: unknown) => call<{ gameId: string }>('POST', '/api/games', body),
  // Entraînement.
  hint: (gameId: string, level: number) =>
    call<HintResponse>('POST', `/api/games/${gameId}/hint`, { level }),
  checkMove: (gameId: string, uci: string) =>
    call<CheckMoveResponse>('POST', `/api/games/${gameId}/check-move`, { uci }),
  // Coach : revues et imports.
  review: (id: string) => request<ReviewResponse>('GET', `/api/reviews/${id}`),
  startReview: (id: string) => request<ReviewResponse>('POST', `/api/reviews/${id}`),
  /** « Apprends de tes erreurs » : autre coup proposé au demi-coup `ply` d'une revue. */
  retryMove: (id: string, ply: number, uci: string) =>
    call<RetryMoveResponse>('POST', `/api/reviews/${id}/retry`, { ply, uci }),
  imports: () => call<ImportedGamesResponse>('GET', '/api/imports'),
  importPgn: (pgn: string, as: string) =>
    request<ImportResult>('POST', '/api/imports/pgn', { pgn, ...(as ? { as } : {}) }),
  importChessCom: (username: string, max: number) =>
    request<ImportResult>('POST', '/api/imports/chesscom', { username, max }),
  deleteImport: (id: string) => call<{ ok: true }>('DELETE', `/api/imports/${id}`),
  reviewAll: () => call<{ queued: number }>('POST', '/api/imports/review-all'),
  dashboard: () => call<CoachDashboard>('GET', '/api/coach/dashboard'),
  // Leçons.
  lessons: () => call<LessonsResponse>('GET', '/api/lessons'),
  lesson: (id: string) => call<LessonView>('GET', `/api/lessons/${id}`),
  lessonMove: (id: string, index: number, step: number, uci: string) =>
    call<LessonMoveResponse>('POST', `/api/lessons/${id}/exercises/${index}/move`, { step, uci }),
  lessonResult: (id: string, correct: number) =>
    call<LessonSummary>('POST', `/api/lessons/${id}/result`, { correct }),
  // Puzzles.
  puzzleStats: () => call<PuzzleStats>('GET', '/api/puzzles/stats'),
  puzzleNext: (mode: PuzzleMode, theme: string | null) =>
    request<PuzzleNextResponse>('POST', '/api/puzzles/next', { mode, theme }),
  puzzleMove: (attemptId: string, uci: string) =>
    call<PuzzleMoveResponse>('POST', `/api/puzzles/${attemptId}/move`, { uci }),
  puzzleHint: (attemptId: string) =>
    call<{ from: string }>('POST', `/api/puzzles/${attemptId}/hint`),
};
