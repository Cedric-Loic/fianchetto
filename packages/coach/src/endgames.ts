/*
 * Finales contre le bot (lot 4b) : positions de référence jouées contre Stockfish à pleine
 * force, depuis `fen`, en partie d'entraînement. La finale est réussie quand le résultat attendu
 * est atteint. Chaque position est vérifiée par les tests (légalité) et par Stockfish
 * (`pnpm test:stress` : l'évaluation correspond au résultat attendu).
 */

export type EndgameGoal = 'win' | 'draw';

export interface Endgame {
  id: string;
  title: string;
  /** Objectif affiché au joueur. */
  objective: string;
  /** Position de départ ; le joueur a le trait. */
  fen: string;
  /** Résultat à obtenir : gagner, ou tenir au moins la nulle. */
  goal: EndgameGoal;
  /** Leçon qui explique la technique, si elle existe. */
  lesson?: string;
}

export const ENDGAMES: readonly Endgame[] = [
  {
    id: 'dame-roi',
    title: 'Roi et dame contre roi',
    objective:
      'Mate le roi noir : repousse-le vers un bord avec ta dame, approche ton roi, sans pat.',
    fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    goal: 'win',
    lesson: 'mats-elementaires',
  },
  {
    id: 'tour-roi',
    title: 'Roi et tour contre roi',
    objective: 'Mate le roi noir avec ta tour : coupe-le, mets tes rois en opposition, puis échec.',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    goal: 'win',
    lesson: 'mats-elementaires',
  },
  {
    id: 'deux-tours',
    title: 'Mat de l’escalier (deux tours)',
    objective:
      'Mate le roi noir avec tes deux tours, sans l’aide de ton roi : elles avancent en escalier.',
    fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1',
    goal: 'win',
    lesson: 'mats-elementaires',
  },
  {
    id: 'opposition-gagner',
    title: 'Opposition : gagner avec le pion',
    objective:
      'Fais aller ton pion à dame. Ton roi est devant : garde l’opposition, le coup de pion sert de temps d’attente.',
    fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
    goal: 'win',
    lesson: 'opposition',
  },
  {
    id: 'opposition-tenir',
    title: 'Opposition : tenir la nulle',
    objective:
      'Avec les Noirs, empêche le pion blanc d’aller à dame : reste devant lui et reprends l’opposition.',
    fen: '4k3/8/8/4P3/4K3/8/8/8 b - - 0 1',
    goal: 'draw',
    lesson: 'opposition',
  },
  {
    id: 'carre-courir',
    title: 'Règle du carré : la course',
    objective: 'Le roi noir est hors du carré de ton pion : pousse-le jusqu’à dame, puis mate.',
    fen: '8/8/8/8/2k4P/8/8/K7 w - - 0 1',
    goal: 'win',
    lesson: 'regle-du-carre',
  },
  {
    id: 'carre-rattraper',
    title: 'Règle du carré : rattraper le pion',
    objective: 'Avec les Noirs, entre dans le carré du pion blanc et rattrape-le.',
    fen: '8/8/8/8/3k3P/8/8/K7 b - - 0 1',
    goal: 'draw',
    lesson: 'regle-du-carre',
  },
  {
    id: 'roi-actif',
    title: 'Le roi actif',
    objective:
      'Ton roi est le plus actif : va prendre le pion c5, puis fais aller ton pion à dame.',
    fen: '8/5k2/8/2p1K3/2P5/8/8/8 w - - 0 1',
    goal: 'win',
  },
  {
    id: 'lucena',
    title: 'Position de Lucena',
    objective:
      'Fais aller ton pion à dame : chasse le roi noir avec ta tour, puis construis le « pont » sur la 4e rangée.',
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    goal: 'win',
  },
  {
    id: 'philidor',
    title: 'Défense de Philidor',
    objective:
      'Avec les Noirs, tiens la nulle : ta tour garde la 6e rangée ; dès que le pion avance, donne des échecs par derrière.',
    fen: '4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1',
    goal: 'draw',
  },
  {
    id: 'bon-fou',
    title: 'Fou et pion de tour : le bon fou',
    objective: 'Ton fou contrôle le coin de promotion : fais aller ton pion à dame, sans pat.',
    fen: '7k/8/6K1/7P/8/8/8/2B5 w - - 0 1',
    goal: 'win',
  },
];

export function endgameById(id: string): Endgame | undefined {
  return ENDGAMES.find((e) => e.id === id);
}

/** Finale dont la position de départ est `fen` (une partie d'entraînement depuis cette position). */
export function endgameByFen(fen: string): Endgame | undefined {
  return ENDGAMES.find((e) => e.fen === fen);
}

/** Camp du joueur : celui qui a le trait au départ. */
export function endgameColor(endgame: Endgame): 'w' | 'b' {
  return endgame.fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/**
 * Finale réussie ? Gagner : le joueur gagne. Tenir : le joueur gagne ou la partie est nulle,
 * sauf nulle par accord (sinon proposer nulle au premier coup suffirait).
 */
export function endgameSucceeded(
  endgame: Endgame,
  result: { winner: 'w' | 'b' | null; reason: string },
): boolean {
  const color = endgameColor(endgame);
  if (result.winner === color) return true;
  return endgame.goal === 'draw' && result.winner === null && result.reason !== 'agreement';
}
