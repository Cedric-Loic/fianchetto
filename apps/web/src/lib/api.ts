import type {
  BotLevelInfo,
  CardsResponse,
  CoachAnswerResponse,
  CoachPromptResponse,
  CurriculumResponse,
  DailySessionResponse,
  CoachDashboard,
  CheckMoveResponse,
  EndgameStartResponse,
  EndgamesResponse,
  HintResponse,
  ImportedGamesResponse,
  ImportResult,
  LeaderboardResponse,
  LessonHintResponse,
  LessonMoveResponse,
  LessonSquaresResponse,
  LessonsResponse,
  LessonSummary,
  LessonView,
  ProfileResponse,
  PuzzleMode,
  PuzzleMoveResponse,
  PuzzleNextResponse,
  PuzzleStats,
  ReviewResponse,
  SessionStep,
  SkillsResponse,
  RetryMoveResponse,
  UserPublic,
  Variant,
} from '@sq/shared';

/** Réponse d'un appel REST : données, ou statut et code d'erreur du serveur. */
export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Délai maximal d'un appel REST par défaut. */
export const REQUEST_TIMEOUT_MS = 15_000;

export interface RequestOptions {
  /** Annulation par l'appelant (démontage…) : résultat `{ status: 0, error: 'ABORTED' }`. */
  signal?: AbortSignal;
  /** Délai maximal (ms) : au-delà, résultat `{ status: 0, error: 'TIMEOUT' }`. */
  timeoutMs?: number;
}

/** Statut 0 : le serveur n'a pas répondu (arrêté, réseau coupé, délai dépassé, annulation). */
export function isNetworkError(res: Result<unknown>): boolean {
  return !res.ok && res.status === 0;
}

/**
 * Appel REST détaillé (statut et code d'erreur en cas d'échec). Statut 0 : pas de réponse du
 * serveur, avec `error` = `NETWORK`, `TIMEOUT` ou `ABORTED`.
 */
export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<Result<T>> {
  const outer = options.signal;
  if (outer?.aborted) return { ok: false, status: 0, error: 'ABORTED' };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  outer?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as unknown;
    if (res.ok) return { ok: true, data: json as T };
    const error = (json as { error?: unknown }).error;
    return { ok: false, status: res.status, error: typeof error === 'string' ? error : '' };
  } catch {
    const error = timedOut ? 'TIMEOUT' : outer?.aborted ? 'ABORTED' : 'NETWORK';
    return { ok: false, status: 0, error };
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

/** Texte brut (PGN…) ; `null` en cas d'erreur HTTP ou réseau. */
async function text(path: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(path, { credentials: 'same-origin', signal: controller.signal });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Résumé public d'une partie tiré de son PGN (notation publique pendant la partie). */
export interface PgnSummary {
  white: string;
  black: string;
  variant: Variant;
  /** Nombre de demi-coups joués. */
  plies: number;
}

export function summarizePgn(pgn: string): PgnSummary {
  const tag = (name: string) => new RegExp(`^\\[${name} "([^"]*)"\\]`, 'm').exec(pgn)?.[1] ?? '';
  const body = pgn.replace(/^\[.*\]$/gm, '').trim();
  const plies = body
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)).length;
  return {
    white: tag('White'),
    black: tag('Black'),
    variant: tag('Event').includes('Secret Queen') ? 'secret-queen' : 'classic',
    plies,
  };
}

export const SERVER_UNREACHABLE = 'Serveur injoignable.';

/** Message d'échec du chargement d'une revue (statut 0 : le serveur n'a pas répondu). */
export function reviewFailureMessage(status: number): string {
  if (status === 0) return SERVER_UNREACHABLE;
  if (status === 409) return "La partie n'est pas encore terminée.";
  return 'Partie introuvable.';
}

/** Appel REST ; `null` en cas d'erreur HTTP ou réseau (serveur arrêté…). */
async function call<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T | null> {
  const res = await request<T>(method, path, body, options);
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
  /** PGN d'une partie : vue publique pendant la partie (carte « Partie en cours »). */
  gamePgn: (id: string) => text(`/api/games/${encodeURIComponent(id)}/pgn`),
  createGame: (body: unknown) => call<{ gameId: string }>('POST', '/api/games', body),
  // Entraînement.
  hint: (gameId: string, level: number) =>
    call<HintResponse>('POST', `/api/games/${gameId}/hint`, { level }),
  checkMove: (gameId: string, uci: string) =>
    call<CheckMoveResponse>('POST', `/api/games/${gameId}/check-move`, { uci }),
  // Partie coachée : question avant de jouer, puis réponse (cases) corrigée par le serveur.
  coachPrompt: (gameId: string) =>
    call<CoachPromptResponse>('POST', `/api/games/${gameId}/coach-prompt`),
  coachAnswer: (gameId: string, ply: number, squares: string[]) =>
    call<CoachAnswerResponse>('POST', `/api/games/${gameId}/coach-answer`, { ply, squares }),
  // Coach : revues et imports.
  review: (id: string, signal?: AbortSignal) =>
    request<ReviewResponse>('GET', `/api/reviews/${id}`, undefined, { signal }),
  startReview: (id: string, signal?: AbortSignal) =>
    request<ReviewResponse>('POST', `/api/reviews/${id}`, undefined, { signal }),
  /** « Apprends de tes erreurs » : autre coup proposé au demi-coup `ply` d'une revue. */
  retryMove: (id: string, ply: number, uci: string) =>
    call<RetryMoveResponse>('POST', `/api/reviews/${id}/retry`, { ply, uci }),
  imports: (signal?: AbortSignal) =>
    call<ImportedGamesResponse>('GET', '/api/imports', undefined, { signal }),
  importPgn: (pgn: string, as: string) =>
    request<ImportResult>('POST', '/api/imports/pgn', { pgn, ...(as ? { as } : {}) }),
  importChessCom: (username: string, max: number) =>
    request<ImportResult>('POST', '/api/imports/chesscom', { username, max }),
  deleteImport: (id: string) => call<{ ok: true }>('DELETE', `/api/imports/${id}`),
  reviewAll: () => call<{ queued: number }>('POST', '/api/imports/review-all'),
  coachSkills: () => call<SkillsResponse>('GET', '/api/coach/skills'),
  coachCurriculum: () => call<CurriculumResponse>('GET', '/api/coach/curriculum'),
  coachSession: () => call<DailySessionResponse>('GET', '/api/coach/session'),
  coachProgress: (kind: SessionStep['kind']) =>
    call<DailySessionResponse>('POST', '/api/coach/session/progress', { kind }),
  reviewCards: () => call<CardsResponse>('GET', '/api/reviews/cards'),
  dashboard: () => call<CoachDashboard>('GET', '/api/coach/dashboard'),
  // Leçons.
  lessons: () => call<LessonsResponse>('GET', '/api/lessons'),
  lesson: (id: string) => call<LessonView>('GET', `/api/lessons/${id}`),
  lessonMove: (id: string, index: number, step: number, uci: string, hints = 0) =>
    call<LessonMoveResponse>('POST', `/api/lessons/${id}/exercises/${index}/move`, {
      step,
      uci,
      hints,
    }),
  lessonSquares: (id: string, index: number, squares: string[], hints = 0) =>
    call<LessonSquaresResponse>('POST', `/api/lessons/${id}/exercises/${index}/squares`, {
      squares,
      hints,
    }),
  lessonHint: (id: string, index: number, level: number) =>
    call<LessonHintResponse>('POST', `/api/lessons/${id}/exercises/${index}/hint`, { level }),
  lessonResult: (id: string, correct: number) =>
    call<LessonSummary>('POST', `/api/lessons/${id}/result`, { correct }),
  // Finales contre le bot.
  endgames: () => call<EndgamesResponse>('GET', '/api/endgames'),
  startEndgame: (id: string) => call<EndgameStartResponse>('POST', `/api/endgames/${id}/start`),
  // Puzzles.
  puzzleStats: () => call<PuzzleStats>('GET', '/api/puzzles/stats'),
  puzzleNext: (mode: PuzzleMode, theme: string | null) =>
    request<PuzzleNextResponse>('POST', '/api/puzzles/next', { mode, theme }),
  puzzleMove: (attemptId: string, uci: string) =>
    call<PuzzleMoveResponse>('POST', `/api/puzzles/${attemptId}/move`, { uci }),
  puzzleHint: (attemptId: string) =>
    call<{ from: string }>('POST', `/api/puzzles/${attemptId}/hint`),
};
