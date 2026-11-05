import { Chess } from 'chess.js';
import { INITIAL_GLICKO } from '@sq/coach';
import {
  PUZZLE_THEME_LABELS,
  type Color,
  type ThreatAnswerResponse,
  type ThreatNextResponse,
  type ThreatProblem,
  type ThreatStats,
} from '@sq/shared';
import { playLine, playStep } from '../chess-utils.js';
import type { GameStore } from '../persistence/db.js';
import type { BankPuzzle } from '../persistence/puzzles.js';

/** Thèmes de structure (longueur, phase) : pas des motifs, non affichés dans l'explication. */
const NOT_MOTIFS = new Set([
  'short',
  'long',
  'veryLong',
  'oneMove',
  'opening',
  'middlegame',
  'endgame',
  'crushing',
  'advantage',
  'equality',
  'master',
  'masterVsMaster',
  'superGM',
  'mate',
]);

interface ParsedThreat {
  puzzle: BankPuzzle;
  /** Position après mon dernier coup (le coup d'amorce du puzzle) : l'adversaire a le trait. */
  fen: string;
  color: Color;
  lastMove: { from: string; to: string; san: string };
  /** La menace, puis la suite de la combinaison (UCI). */
  solution: string[];
}

function parse(puzzle: BankPuzzle): ParsedThreat | null {
  const [setup, ...solution] = puzzle.moves.split(' ');
  if (!setup || solution.length === 0) return null;
  const chess = new Chess(puzzle.fen);
  const color = chess.turn();
  const step = playStep(chess, setup);
  if (!step) return null;
  return {
    puzzle,
    fen: step.fen,
    color,
    lastMove: { from: setup.slice(0, 2), to: setup.slice(2, 4), san: step.san },
    solution,
  };
}

/**
 * « Trouve la menace » : tu viens de jouer le coup d'amorce d'un puzzle Lichess ; l'adversaire
 * a le trait. Désigne le coup qui te fait mal (premier coup de la solution, ou tout coup qui
 * mate). Sans état : le serveur relit le puzzle à chaque réponse ; la menace ne sort qu'avec
 * la réponse.
 */
export class ThreatService {
  readonly #store: GameStore;
  readonly #now: () => number;

  constructor(store: GameStore, now: () => number = Date.now) {
    this.#store = store;
    this.#now = now;
  }

  stats(userId: string): ThreatStats {
    const attempts = this.#store.drills.threatAttempts(userId);
    let streak = 0;
    for (let i = attempts.length - 1; i >= 0 && attempts[i]?.correct; i--) streak++;
    return {
      attempts: attempts.length,
      correct: attempts.filter((a) => a.correct).length,
      streak,
    };
  }

  /** Position suivante, de préférence jamais servie, un peu sous le classement puzzle. */
  next(userId: string): ThreatNextResponse {
    const stats = this.stats(userId);
    const p = this.#store.puzzles;
    if (p.bankSize() === 0) return { problem: null, stats };
    const rating = (p.glicko(userId) ?? INITIAL_GLICKO).rating;
    for (const fresh of [true, false]) {
      for (const [below, above] of [
        [400, 0],
        [700, 200],
        [3000, 3000],
      ] as const) {
        const puzzle = this.#store.drills.pickThreat(
          userId,
          { min: rating - below, max: rating + above },
          fresh,
        );
        const parsed = puzzle && parse(puzzle);
        if (parsed) return { problem: this.#problem(parsed), stats };
      }
    }
    return { problem: null, stats };
  }

  #problem(t: ParsedThreat): ThreatProblem {
    return {
      id: t.puzzle.id,
      fen: t.fen,
      color: t.color,
      lastMove: t.lastMove,
      rating: t.puzzle.rating,
    };
  }

  /**
   * Réponse : `NOT_FOUND` (puzzle inconnu) ou `ILLEGAL` (coup impossible pour l'adversaire, sans
   * conséquence) ; sinon le verdict, enregistré comme preuve de la compétence « menaces ».
   */
  answer(userId: string, id: string, uci: string): ThreatAnswerResponse | 'NOT_FOUND' | 'ILLEGAL' {
    const puzzle = this.#store.puzzles.getLichess(id);
    const parsed = puzzle && parse(puzzle);
    if (!parsed) return 'NOT_FOUND';
    const probe = new Chess(parsed.fen);
    const played = playStep(probe, uci);
    if (!played) return 'ILLEGAL';
    const threat = parsed.solution[0] ?? '';
    const correct = played.uci.slice(0, 4) === threat.slice(0, 4) || probe.isCheckmate();
    this.#store.drills.recordThreat(userId, id, correct, this.#now());
    const line = playLine(parsed.fen, parsed.solution);
    const themes = parsed.puzzle.themes
      .trim()
      .split(/\s+/)
      .filter((t) => t && !NOT_MOTIFS.has(t));
    const motifs = themes.map((t) => (PUZZLE_THEME_LABELS[t] ?? t).toLowerCase());
    const san = line[0]?.san ?? threat;
    const explanation = correct
      ? `Bien vu : après ${parsed.lastMove.san}, l'adversaire menaçait ${san}${
          motifs.length ? ` (${motifs.join(', ')})` : ''
        }. Avant de jouer, demande-toi toujours ce que ton coup permet.`
      : `La menace était ${san}${motifs.length ? ` (${motifs.join(', ')})` : ''}. Ton coup ${
          parsed.lastMove.san
        } l'a permise : rejoue la suite pour voir ce qu'elle gagne.`;
    return { correct, line, themes, explanation, stats: this.stats(userId) };
  }
}
