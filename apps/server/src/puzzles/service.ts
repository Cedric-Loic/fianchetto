import { randomUUID } from 'node:crypto';
import { Chess } from 'chess.js';
import { INITIAL_GLICKO, puzzlesFromReview, updateGlicko, winChance, type Glicko } from '@sq/coach';
import type {
  Color,
  PuzzleAttempt,
  PuzzleMode,
  PuzzleMoveResponse,
  PuzzleSource,
  PuzzleStats,
} from '@sq/shared';
import type { PositionAnalysis } from '@sq/bot';
import { legalMoves, playLine as line, playStep as play } from '../chess-utils.js';
import type { GameStore } from '../persistence/db.js';

/** Thèmes du « thème du jour » (phase 1 du plan : tactique de base), en rotation. */
const THEME_ROTATION = [
  'hangingPiece',
  'fork',
  'pin',
  'mateIn1',
  'skewer',
  'mateIn2',
  'discoveredAttack',
  'backRankMate',
] as const;

/** Tolérance (points de % de gain) pour accepter un autre coup que le meilleur, dans mes erreurs. */
const OWN_TOLERANCE = 5;
const MAX_LIVE_ATTEMPTS = 500;

export function themeOfDay(now = Date.now()): string {
  const day = Math.floor(now / (24 * 3600 * 1000));
  return THEME_ROTATION[day % THEME_ROTATION.length] ?? 'fork';
}

interface Live {
  id: string;
  userId: string;
  source: PuzzleSource;
  puzzleId: string;
  /** Coups UCI : coup adverse de départ, puis solution (Lichess) ou meilleur coup (mes erreurs). */
  moves: string[];
  rating: { rating: number; deviation: number } | null;
  themes: string;
  /** Mes erreurs : évaluation de la position à résoudre. */
  evaluation: { evalCp: number | null; mate: number | null } | null;
  color: Color;
  chess: Chess;
  /** Indice dans `moves` du prochain coup attendu du joueur. */
  step: number;
  rated: boolean;
  hinted: boolean;
  finished: boolean;
}

/**
 * Puzzles : tirage selon le mode, validation des coups (le serveur est seul juge), classement
 * Glicko-2, révisions espacées, puzzles tirés des revues de mes parties.
 */
export class PuzzleService {
  readonly #store: GameStore;
  readonly #evaluate: (fen: string) => Promise<PositionAnalysis | null>;
  readonly #live = new Map<string, Live>();

  constructor(store: GameStore, evaluate: (fen: string) => Promise<PositionAnalysis | null>) {
    this.#store = store;
    this.#evaluate = evaluate;
  }

  #glicko(userId: string): Glicko {
    return this.#store.puzzles.glicko(userId) ?? INITIAL_GLICKO;
  }

  /** Crée les puzzles « mes erreurs » des parties analysées pas encore exploitées. */
  syncOwn(userId: string): void {
    const p = this.#store.puzzles;
    const sources: { gameId: string; color: Color; label: string; url: string | null }[] = [];
    for (const row of this.#store.listImported(userId)) {
      if (!row.userColor) continue;
      const opponent = row.userColor === 'w' ? row.black : row.white;
      sources.push({
        gameId: row.id,
        color: row.userColor,
        label: `contre ${opponent}`,
        url: row.url,
      });
    }
    for (const g of this.#store.history(userId)) {
      if (g.mode !== 'bot') continue;
      sources.push({
        gameId: g.gameId,
        color: g.color,
        label: `contre ${g.opponentName}`,
        url: null,
      });
    }
    for (const s of sources) {
      if (p.isSourceSynced(userId, s.gameId)) continue;
      const review = this.#store.getReview(s.gameId);
      if (!review) continue;
      for (const c of puzzlesFromReview(review, s.color)) {
        p.addOwn({
          id: `${s.gameId}-${c.ply}`,
          userId,
          gameId: s.gameId,
          ply: c.ply,
          fen: c.fen,
          moves: c.moves.join(' '),
          evalCp: c.evalCp,
          mate: c.mate,
          kind: c.kind,
          label: `Ta partie ${s.label}, coup ${Math.ceil(c.ply / 2)}`,
          url: s.url,
        });
      }
      p.markSourceSynced(userId, s.gameId);
    }
  }

  /** Puzzle suivant ; `NO_BANK` si la base Lichess n'est pas importée (modes classés). */
  next(
    userId: string,
    mode: PuzzleMode,
    theme: string | null,
  ): PuzzleAttempt | 'NO_BANK' | 'NO_PUZZLE' {
    const p = this.#store.puzzles;
    if (mode === 'mine') {
      this.syncOwn(userId);
      const own = p.pickOwn(userId);
      return (own && this.#startOwn(userId, own.id)) ?? 'NO_PUZZLE';
    }
    if (mode === 'review') {
      for (const due of p.due(userId)) {
        const attempt =
          due.source === 'mine'
            ? this.#startOwn(userId, due.puzzleId)
            : this.#startLichess(userId, due.puzzleId, false);
        if (attempt) return attempt;
      }
      return 'NO_PUZZLE';
    }
    if (p.bankSize() === 0) return 'NO_BANK';
    // Légèrement au-dessus du niveau, fenêtre élargie s'il le faut.
    const rating = this.#glicko(userId).rating;
    const filter = mode === 'theme' ? (theme ?? themeOfDay()) : null;
    for (const [below, above] of [
      [50, 150],
      [200, 300],
      [600, 600],
      [3000, 3000],
    ] as const) {
      const puzzle = p.pickLichess(userId, { min: rating - below, max: rating + above }, filter);
      if (puzzle) return this.#startLichess(userId, puzzle.id, true) ?? 'NO_PUZZLE';
    }
    return 'NO_PUZZLE';
  }

  #register(live: Live, origin: PuzzleAttempt['origin'], fenBefore: string): PuzzleAttempt | null {
    const setupUci = live.moves[0];
    const setup = setupUci ? play(live.chess, setupUci) : null;
    if (!setup) return null;
    if (this.#live.size >= MAX_LIVE_ATTEMPTS) {
      const oldest = this.#live.keys().next().value;
      if (oldest !== undefined) this.#live.delete(oldest);
    }
    this.#live.set(live.id, live);
    return {
      attemptId: live.id,
      source: live.source,
      puzzleId: live.puzzleId,
      rating: live.rating ? Math.round(live.rating.rating) : null,
      themes: live.themes.trim() === '' ? [] : live.themes.trim().split(/\s+/),
      color: live.chess.turn(),
      fenBefore,
      setup,
      legalMoves: legalMoves(live.chess),
      rated: live.rated,
      origin,
    };
  }

  #startLichess(userId: string, id: string, rated: boolean): PuzzleAttempt | null {
    const puzzle = this.#store.puzzles.getLichess(id);
    if (!puzzle) return null;
    const chess = new Chess(puzzle.fen);
    return this.#register(
      {
        id: randomUUID(),
        userId,
        source: 'lichess',
        puzzleId: puzzle.id,
        moves: puzzle.moves.split(' '),
        rating: { rating: puzzle.rating, deviation: puzzle.deviation },
        themes: puzzle.themes,
        evaluation: null,
        color: chess.turn() === 'w' ? 'b' : 'w',
        chess,
        step: 1,
        rated,
        hinted: false,
        finished: false,
      },
      puzzle.gameUrl ? { label: 'Partie Lichess d’origine', url: puzzle.gameUrl } : null,
      puzzle.fen,
    );
  }

  #startOwn(userId: string, id: string): PuzzleAttempt | null {
    const own = this.#store.puzzles.getOwn(id);
    if (!own || own.userId !== userId) return null;
    const chess = new Chess(own.fen);
    return this.#register(
      {
        id: randomUUID(),
        userId,
        source: 'mine',
        puzzleId: own.id,
        moves: own.moves.split(' '),
        rating: null,
        themes: own.kind ? ` ${own.kind} ` : '',
        evaluation: { evalCp: own.evalCp, mate: own.mate },
        color: chess.turn() === 'w' ? 'b' : 'w',
        chess,
        step: 1,
        rated: false,
        hinted: false,
        finished: false,
      },
      { label: own.label, url: own.url },
      own.fen,
    );
  }

  #attempt(userId: string, attemptId: string): Live | null {
    const live = this.#live.get(attemptId);
    return live && live.userId === userId ? live : null;
  }

  hint(userId: string, attemptId: string): { from: string } | null {
    const live = this.#attempt(userId, attemptId);
    const expected = live?.moves[live.step];
    if (!live || !expected || live.finished) return null;
    live.hinted = true;
    return { from: expected.slice(0, 2) };
  }

  /** Coup du joueur. `null` : tentative inconnue. */
  async move(userId: string, attemptId: string, uci: string): Promise<PuzzleMoveResponse | null> {
    const live = this.#attempt(userId, attemptId);
    if (!live) return null;
    const fen = live.chess.fen();
    const remaining = () => line(fen, live.moves.slice(live.step));
    if (live.finished) {
      return { status: 'failed', steps: [], legalMoves: [], solution: remaining(), rating: null };
    }
    const probe = new Chess(fen);
    const step = play(probe, uci);
    if (!step) {
      return {
        status: 'illegal',
        steps: [],
        legalMoves: legalMoves(live.chess),
        solution: null,
        rating: null,
      };
    }
    const expected = live.moves[live.step] ?? '';
    let correct = step.uci === expected || probe.isCheckmate();
    if (!correct && live.source === 'mine' && live.evaluation) {
      // Mes erreurs : un autre coup presque aussi bon que celui du moteur est accepté.
      const after = await this.#evaluate(step.fen);
      if (after) {
        const before = winChance(live.evaluation, live.color);
        correct = before - winChance(after, live.color) <= OWN_TOLERANCE;
      }
    }
    if (!correct) {
      const solution = remaining();
      return {
        status: 'failed',
        steps: [],
        legalMoves: [],
        solution,
        rating: this.#finish(live, false),
      };
    }
    play(live.chess, step.uci);
    live.step++;
    const steps = [step];
    const reply = live.moves[live.step];
    if (reply && !probe.isCheckmate() && step.uci === expected) {
      const replied = play(live.chess, reply);
      if (replied) {
        steps.push(replied);
        live.step++;
      }
    }
    const solved =
      live.step >= live.moves.length || live.chess.isCheckmate() || step.uci !== expected;
    return {
      status: solved ? 'solved' : 'continue',
      steps,
      legalMoves: solved ? [] : legalMoves(live.chess),
      solution: null,
      rating: solved ? this.#finish(live, true) : null,
    };
  }

  /** Fin d'une tentative : enregistrement, classement, révisions. */
  #finish(live: Live, success: boolean): { before: number; after: number } | null {
    live.finished = true;
    const p = this.#store.puzzles;
    // Un indice rend la réussite non classée (l'échec, lui, compte).
    const rated = live.rated && live.rating !== null && !(success && live.hinted);
    const before = this.#glicko(live.userId);
    const after = rated && live.rating ? updateGlicko(before, live.rating, success ? 1 : 0) : null;
    p.recordAttempt({
      userId: live.userId,
      source: live.source,
      puzzleId: live.puzzleId,
      success,
      rated,
      themes: live.themes,
      ratingAfter: after?.rating ?? null,
    });
    if (success) p.scheduleSuccess(live.userId, live.source, live.puzzleId);
    else p.scheduleFailure(live.userId, live.source, live.puzzleId);
    if (!after) return null;
    p.setGlicko(live.userId, after);
    return { before: Math.round(before.rating), after: Math.round(after.rating) };
  }

  stats(userId: string): PuzzleStats {
    this.syncOwn(userId);
    const p = this.#store.puzzles;
    const g = this.#glicko(userId);
    const attempts = p.attempts(userId);
    const byTheme = new Map<string, { attempts: number; solved: number }>();
    for (const a of attempts) {
      if (a.source !== 'lichess') continue;
      for (const theme of a.themes.trim().split(/\s+/).filter(Boolean)) {
        const t = byTheme.get(theme) ?? { attempts: 0, solved: 0 };
        t.attempts++;
        t.solved += a.success;
        byTheme.set(theme, t);
      }
    }
    return {
      rating: Math.round(g.rating),
      deviation: Math.round(g.deviation),
      attempts: attempts.length,
      solved: attempts.filter((a) => a.success === 1).length,
      available: { lichess: p.bankSize(), mine: p.countOwn(userId), due: p.due(userId).length },
      themeOfDay: themeOfDay(),
      themes: [...byTheme.entries()]
        .map(([theme, t]) => ({ theme, ...t }))
        .sort((a, b) => b.attempts - a.attempts),
    };
  }
}
