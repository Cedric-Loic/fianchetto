import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { PIECE_VALUE, pieceShort } from './board.js';

/*
 * Partie coachée : question socratique posée au joueur AVANT qu'il joue. Détecte, dans la
 * position où c'est à lui de jouer, les pièces en prise : les siennes (menace adverse), sinon
 * celles de l'adversaire (occasion). Pur et sans I/O ; réservé aux parties classiques, la
 * position étant publique.
 */

export interface CoachPromptData {
  kind: 'threat' | 'chance';
  /** Question posée, sans révéler la réponse. */
  question: string;
  /** Cases attendues (jamais envoyées avant la réponse). */
  squares: string[];
  /** Explication donnée après la réponse. */
  explanation: string;
}

/** Pièces de `owner` qu'un adversaire gagnerait en les prenant (sans défenseur, ou plus chères
 *  que la plus petite pièce attaquante). */
function hanging(chess: Chess, owner: 'w' | 'b'): { square: Square; type: PieceSymbol }[] {
  const enemy = owner === 'w' ? 'b' : 'w';
  const out: { square: Square; type: PieceSymbol }[] = [];
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== owner || piece.type === 'k') continue;
      const attackers = chess.attackers(piece.square, enemy);
      if (attackers.length === 0) continue;
      const cheapest = Math.min(
        ...attackers.map((sq) => PIECE_VALUE[chess.get(sq)?.type ?? 'k'] || 100),
      );
      const defended = chess.attackers(piece.square, owner).length > 0;
      if (!defended || cheapest < PIECE_VALUE[piece.type]) {
        out.push({ square: piece.square, type: piece.type });
      }
    }
  }
  return out;
}

const names = (list: { square: Square; type: PieceSymbol }[]) =>
  list.map((p) => pieceShort(p.type, p.square)).join(', ');

/** `null` : rien à signaler, on ne dérange pas le joueur. Position finale : `null`. */
export function coachPrompt(fen: string): CoachPromptData | null {
  const chess = new Chess(fen);
  if (chess.isGameOver() || chess.inCheck()) return null;
  const me = chess.turn();
  const threatened = hanging(chess, me);
  if (threatened.length > 0) {
    return {
      kind: 'threat',
      question:
        'Avant de jouer : qu’a voulu faire l’adversaire avec son dernier coup ? ' +
        'Désigne la ou les pièces à toi qui sont menacées.',
      squares: threatened.map((p) => p.square),
      explanation: `Ces pièces étaient menacées : ${names(threatened)}. Pare la menace avant tes projets.`,
    };
  }
  const targets = hanging(chess, me === 'w' ? 'b' : 'w');
  if (targets.length > 0) {
    return {
      kind: 'chance',
      question:
        'Regarde bien : l’adversaire laisse quelque chose. Désigne la ou les pièces adverses en prise.',
      squares: targets.map((p) => p.square),
      explanation: `Pièces adverses en prise : ${names(targets)}.`,
    };
  }
  return null;
}

/** Réponse juste : exactement l'ensemble attendu (sans ordre). */
export function coachAnswerCorrect(prompt: CoachPromptData, squares: readonly string[]): boolean {
  const expected = new Set(prompt.squares);
  const given = new Set(squares);
  return expected.size === given.size && [...expected].every((s) => given.has(s));
}
