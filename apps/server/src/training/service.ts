import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { explainMove, forkTargets, winChance, winsMaterial, type EngineEval } from '@sq/coach';
import type { Color, HintResponse, SquareMark } from '@sq/shared';
import type { PositionAnalysis } from '@sq/bot';

/** Seuil de gaffe (points de % de gain perdus) qui déclenche le garde-fou. */
const BLUNDER = 15;

const NAME: Record<PieceSymbol, string> = {
  p: 'pion',
  n: 'cavalier',
  b: 'fou',
  r: 'tour',
  q: 'dame',
  k: 'roi',
};
const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const toEngineEval = (a: PositionAnalysis): EngineEval => ({
  evalCp: a.evalCp,
  mate: a.mate,
  bestMoveUci: a.bestMoveUci,
  pv: a.pv,
});

/** Une de mes pièces attaquée et mal défendue (sans défense, ou attaquée par moins cher). */
function threatenedPiece(chess: Chess): { type: PieceSymbol; square: Square } | null {
  const me = chess.turn();
  const them = me === 'w' ? 'b' : 'w';
  let worst: { type: PieceSymbol; square: Square } | null = null;
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== me || p.type === 'k') continue;
      const attackers = chess.attackers(p.square, them);
      if (attackers.length === 0) continue;
      const defended = chess.attackers(p.square, me).length > 0;
      const cheapest = Math.min(...attackers.map((sq) => VALUE[chess.get(sq)?.type ?? 'q'] || 100));
      if (
        (!defended || cheapest < VALUE[p.type]) &&
        (!worst || VALUE[p.type] > VALUE[worst.type])
      ) {
        worst = { type: p.type, square: p.square };
      }
    }
  }
  return worst;
}

/**
 * Une case marquée par l'indice de niveau 1 révélerait-elle le meilleur coup ? Toujours pour sa
 * case de départ (c'est l'indice de niveau 2) ; pour sa case d'arrivée, quand une seule pièce
 * peut y aller.
 */
function revealsMove(chess: Chess, best: Move, square: Square): boolean {
  if (square === best.from) return true;
  if (square !== best.to) return false;
  const origins = chess
    .moves({ verbose: true })
    .filter((m) => m.to === square)
    .map((m) => m.from);
  return new Set(origins).size <= 1;
}

/**
 * Coach pendant les parties d'entraînement : indices progressifs (l'idée, la pièce, le coup) et
 * garde-fou avant une gaffe. Les évaluations Stockfish sont gardées en cache par position.
 */
export class TrainingService {
  readonly #evaluate: (fen: string) => Promise<PositionAnalysis | null>;
  readonly #cache = new Map<string, PositionAnalysis>();

  constructor(evaluate: (fen: string) => Promise<PositionAnalysis | null>) {
    this.#evaluate = evaluate;
  }

  async #analysis(fen: string): Promise<PositionAnalysis | null> {
    const cached = this.#cache.get(fen);
    if (cached) return cached;
    const result = await this.#evaluate(fen);
    if (result) {
      if (this.#cache.size > 500) this.#cache.clear();
      this.#cache.set(fen, result);
    }
    return result;
  }

  async hint(fen: string, level: number): Promise<HintResponse | null> {
    const analysis = await this.#analysis(fen);
    const best = analysis?.bestMoveUci;
    if (!analysis || !best) return null;
    const chess = new Chess(fen);
    const move = new Chess(fen).move({
      from: best.slice(0, 2),
      to: best.slice(2, 4),
      ...(best.length > 4 ? { promotion: best[4] } : {}),
    });
    if (level >= 3) {
      return { level: 3, text: `Le meilleur coup : ${move.san}.`, from: move.from, to: move.to };
    }
    if (level === 2) {
      return {
        level: 2,
        text: `Joue ton ${NAME[move.piece]} (${move.from}).`,
        from: move.from,
        to: null,
      };
    }
    const mate =
      analysis.mate === null ? null : chess.turn() === 'w' ? analysis.mate : -analysis.mate;
    const threatened = threatenedPiece(chess);
    const them = chess.turn() === 'w' ? 'b' : 'w';
    let text: string;
    let marks: SquareMark[] = [];
    if (mate !== null && mate > 0) {
      text = `Il y a un mat en ${mate} !`;
      const [king] = chess.findPiece({ type: 'k', color: them });
      if (king) marks = [{ square: king, kind: 'mate' }];
    } else if (threatened && move.from === threatened.square) {
      text = `Ton ${NAME[threatened.type]} en ${threatened.square} est menacé : mets-le à l'abri.`;
      // La pièce menacée est celle qui doit jouer : on montre ses attaquants, pas elle.
      marks = chess
        .attackers(threatened.square, them)
        .map((square): SquareMark => ({ square, kind: 'attacker' }));
    } else if (move.captured && winsMaterial(fen, move)) {
      text = 'Une prise gagne du matériel.';
      marks = [{ square: move.to, kind: 'target' }];
    } else if (forkTargets(fen, best).length > 0) text = 'Cherche une fourchette.';
    else if (move.san.includes('+')) text = 'Cherche un échec.';
    else if (threatened) {
      text = `Attention : ton ${NAME[threatened.type]} en ${threatened.square} est menacé.`;
      marks = [{ square: threatened.square, kind: 'hanging' }];
    } else text = 'Pas de tactique immédiate : améliore ta pièce la moins active.';
    marks = marks.filter((m) => !revealsMove(chess, move, m.square));
    return { level: 1, text, from: null, to: null, ...(marks.length > 0 ? { marks } : {}) };
  }

  /**
   * Garde-fou : avertissement si le coup est une gaffe (perte d'au moins 15 points de % de gain).
   * L'explication décrit la menace adverse, sans jamais donner le meilleur coup.
   */
  async checkMove(fen: string, color: Color, uci: string): Promise<string | null> {
    const chess = new Chess(fen);
    try {
      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci[4] } : {}),
      });
    } catch {
      return null;
    }
    const before = await this.#analysis(fen);
    const after = await this.#analysis(chess.fen());
    if (!before || !after) return null;
    if (winChance(before, color) - winChance(after, color) < BLUNDER) return null;
    const explanation = explainMove(
      {
        color,
        fenBefore: fen,
        fenAfter: chess.fen(),
        playedUci: uci,
        before: toEngineEval(before),
        after: toEngineEval(after),
      },
      { consequencesOnly: true },
    );
    switch (explanation.kind) {
      case 'hanging-piece':
      case 'allowed-mate':
      case 'allowed-fork':
        return explanation.text;
      case 'material-loss':
        return 'Ce coup perd du matériel : regarde les réponses de l’adversaire.';
      default:
        return 'Ce coup gâche ta position : regarde encore les menaces et les coups forcés.';
    }
  }
}
