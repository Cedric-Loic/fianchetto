import { Chess, type PieceSymbol } from 'chess.js';
import type { CalcProblem, CalcTechnique, Color, PuzzleStep } from '@sq/shared';
import { playLine, playStep } from '../chess-utils.js';
import type { BankPuzzle } from '../persistence/puzzles.js';

/*
 * Logique pure de l'entraîneur de calcul : un puzzle Lichess local devient un problème (position
 * où le joueur doit jouer, question sur la position finale) et le serveur juge la ligne saisie.
 * Aucune donnée de partie : seulement des puzzles publics, jamais une partie de l'utilisateur.
 */

/** Nombre de coups du joueur dans la ligne. */
export type CalcDepth = 1 | 2 | 3;

/** Techniques d'Aagaard et Kotov, une par profondeur. */
export const TECHNIQUE_OF_DEPTH: Record<CalcDepth, CalcTechnique> = {
  1: 'forced',
  2: 'candidates',
  3: 'long',
};

const TECHNIQUE_TIPS: Record<CalcTechnique, string> = {
  forced: 'Cherche d’abord les coups forcés : échecs, prises, menaces.',
  candidates: 'Liste tes coups candidats, puis vérifie la meilleure réponse adverse à chacun.',
  long: 'Poursuis ton calcul jusqu’à une position calme avant de juger.',
};

/** Choix du bilan matériel (indices fixes, dans l'ordre affiché). */
export const MATERIAL_OPTIONS = [
  'Je perds du matériel',
  'Matériel égal',
  'Je gagne un pion (ou deux)',
  'Je gagne une pièce mineure',
  'Je gagne une tour ou plus',
] as const;
export const MATE_OPTIONS = ['Oui', 'Non'] as const;

const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Matériel de `color` moins celui de l'adversaire (pion 1, cavalier et fou 3, tour 5, dame 9). */
export function materialBalance(chess: Chess, color: Color): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece) total += (piece.color === color ? 1 : -1) * VALUES[piece.type];
    }
  }
  return total;
}

/** Indice de `MATERIAL_OPTIONS` pour un gain (ou une perte) de matériel pendant la ligne. */
export function materialOption(delta: number): number {
  if (delta < 0) return 0;
  if (delta === 0) return 1;
  if (delta < 3) return 2;
  return delta < 5 ? 3 : 4;
}

/** Problème décodé depuis un puzzle : position à jouer et solution du joueur. */
export interface ParsedCalc {
  puzzle: BankPuzzle;
  depth: CalcDepth;
  /** Position où le joueur doit jouer (après le coup d'amorce de l'adversaire). */
  fen: string;
  color: Color;
  /** Solution : `2 * depth - 1` demi-coups UCI, le premier est celui du joueur. */
  solution: string[];
  /** La solution se termine par un mat (question « mat ou non ») ? */
  endsInMate: boolean;
}

/** Décode un puzzle ; `null` si sa solution n'a pas 1 à 3 coups du joueur ou est illisible. */
export function parseCalc(puzzle: BankPuzzle): ParsedCalc | null {
  const moves = puzzle.moves.trim().split(/\s+/);
  if (moves.length % 2 !== 0 || moves.length < 2 || moves.length > 6) return null;
  const depth = (moves.length / 2) as CalcDepth;
  const chess = new Chess(puzzle.fen);
  const setup = moves[0];
  if (!setup || !playStep(chess, setup)) return null;
  const fen = chess.fen();
  const color: Color = chess.turn();
  const solution = moves.slice(1);
  for (const uci of solution) if (!playStep(chess, uci)) return null;
  return { puzzle, depth, fen, color, solution, endsInMate: chess.isCheckmate() };
}

/** Problème envoyé au client : jamais la solution. */
export function toProblem(parsed: ParsedCalc): CalcProblem {
  const technique = TECHNIQUE_OF_DEPTH[parsed.depth];
  const plies = 2 * parsed.depth - 1;
  const line =
    plies === 1
      ? 'ton coup'
      : `ta ligne de ${plies} demi-coups (tes coups et les répliques de l’adversaire)`;
  return {
    id: parsed.puzzle.id,
    fen: parsed.fen,
    color: parsed.color,
    depth: parsed.depth,
    plies,
    technique,
    prompt: `Saisis ${line} sans bouger les pièces. ${TECHNIQUE_TIPS[technique]}`,
    question: parsed.endsInMate
      ? { text: 'Le roi adverse est-il mat à la fin de la ligne ?', options: [...MATE_OPTIONS] }
      : {
          text: 'Quel est le bilan matériel de la position à la fin de la ligne, pour toi ?',
          options: [...MATERIAL_OPTIONS],
        },
  };
}

/** Rejoue `line` depuis la position du problème ; `null` si un coup est illégal. */
export function replay(parsed: ParsedCalc, line: readonly string[]): Chess | null {
  const chess = new Chess(parsed.fen);
  for (const uci of line) if (!playStep(chess, uci)) return null;
  return chess;
}

/**
 * La ligne saisie est-elle la solution ? Les coups de l'adversaire doivent être identiques ; un
 * coup du joueur différent est accepté s'il donne mat (la ligne s'arrête alors là).
 */
export function lineCorrect(parsed: ParsedCalc, line: readonly string[]): boolean {
  if (line.length === 0 || line.length > parsed.solution.length) return false;
  const chess = new Chess(parsed.fen);
  for (const [i, uci] of line.entries()) {
    const step = playStep(chess, uci);
    if (!step) return false;
    if (step.uci === parsed.solution[i]) continue;
    // Autre coup du joueur : correct seulement s'il mate (et alors la ligne est terminée).
    if (i % 2 !== 0 || !chess.isCheckmate() || i !== line.length - 1) return false;
    return true;
  }
  return line.length === parsed.solution.length || chess.isCheckmate();
}

/**
 * Bonne réponse à la question, calculée sur la position finale de la ligne saisie si elle est
 * jouable en entier (c'est ce que le joueur a calculé), sinon sur la solution.
 */
export function correctAnswer(parsed: ParsedCalc, line: readonly string[]): number {
  const end = (line.length > 0 ? replay(parsed, line) : null) ?? replay(parsed, parsed.solution);
  if (!end) return 0;
  if (parsed.endsInMate) return end.isCheckmate() ? 0 : 1;
  return materialOption(
    materialBalance(end, parsed.color) - materialBalance(new Chess(parsed.fen), parsed.color),
  );
}

/** Solution en coups UCI et SAN, avec la position après chaque coup. */
export function solutionSteps(parsed: ParsedCalc): PuzzleStep[] {
  return playLine(parsed.fen, parsed.solution);
}

/** Explication affichée après la réponse. */
export function explain(
  parsed: ParsedCalc,
  steps: PuzzleStep[],
  result: { lineCorrect: boolean; answerCorrect: boolean },
  options: readonly string[],
  correct: number,
): string {
  const moveNumber = Number(parsed.fen.split(' ')[5] ?? '1');
  let n = moveNumber;
  const text = steps
    .map((s, i) => {
      const white = (i % 2 === 0) === (parsed.color === 'w');
      const label = white ? `${n}.` : i === 0 ? `${n}...` : '';
      if (!white) n++;
      return `${label}${s.san}`;
    })
    .join(' ');
  const line = result.lineCorrect ? `Ligne exacte : ${text}.` : `La bonne ligne était : ${text}.`;
  const answer = result.answerCorrect
    ? `Bonne réponse : « ${options[correct] ?? ''} ».`
    : `À la fin de ta ligne, la bonne réponse était : « ${options[correct] ?? ''} ».`;
  return `${line} ${answer}`;
}
