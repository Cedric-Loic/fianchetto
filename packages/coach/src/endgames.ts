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
  /** Palier du cours (1 : 1000-1200, 2 : 1200-1400, 3 : 1400-1600) ; 1 par défaut. */
  stage?: 1 | 2 | 3;
  /** Coups maximum du joueur pour réussir (`undefined` : pas de limite). */
  maxMoves?: number;
  /** Indices progressifs propres à la finale (1 = l'idée, 2 = la case ou la pièce, 3 = le coup). */
  hints?: readonly string[];
  /** Compétence travaillée ; `pawn-endgames` par défaut. */
  skill?: 'pawn-endgames' | 'rook-endgames';
}

/*
 * Chapitres du cours de finales. Palier 1 (1000-1200) : mats élémentaires, pions et dame contre
 * pion. Palier 2 : opposition à distance, pion passé éloigné, percée, roi actif, positions théoriques
 * de tours (Lucena, Philidor, tour derrière le pion passé) et bon fou. `maxMoves` = coups du joueur : le mat le plus rapide du moteur
 * (mesuré avec Stockfish) plus une marge pour une exécution humaine. Pas de limite pour les
 * nulles « à tenir » : leur durée dépend du bot.
 */
export const ENDGAMES: readonly Endgame[] = [
  // --- Palier 1 -----------------------------------------------------------------------------
  {
    id: 'dame-roi',
    title: 'Roi et dame contre roi',
    objective:
      'Mate le roi noir avec ta dame et ton roi, en 12 coups au plus. Place d’abord un mur à un saut de cavalier ' +
      'du roi noir, approche ton roi, puis donne le mat. Surveille les cases du roi noir : un pat gâcherait tout.',
    fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    goal: 'win',
    lesson: 'fin-mat-dame',
    stage: 1,
    maxMoves: 12,
    skill: 'pawn-endgames',
    hints: [
      'Ne cherche pas l’échec : construis un mur. La dame se place à un saut de cavalier du roi noir.',
      'Ton roi n’approche que lorsque la dame tient déjà le mur. Compte les cases du roi noir avant chaque coup, pour éviter le pat.',
      'Premier coup : Dd3 (ou Dg4, Dd7).',
    ],
  },
  {
    id: 'tour-roi',
    title: 'Roi et tour contre roi',
    objective:
      'Mate le roi noir avec ta tour et ton roi, en 25 coups au plus. La tour coupe le roi noir, ton roi monte, et ' +
      'chaque fois que les rois sont en opposition avec le trait aux Noirs, la tour donne échec. Sans opposition, ' +
      'perds un temps avec la tour.',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    goal: 'win',
    lesson: 'fin-mat-tour',
    stage: 1,
    maxMoves: 25,
    skill: 'rook-endgames',
    hints: [
      'Coupe le roi noir avec la tour, puis fais monter ton roi : un échec n’a de sens qu’avec l’opposition.',
      'Garde la tour loin du roi noir, sur la colonne ou la rangée de coupe. Si les rois sont en opposition mais que tu as le trait, fais un coup d’attente avec la tour.',
      'Premier coup : Td1 (coupe la colonne d), puis Rf2 pour ramener ton roi.',
    ],
  },
  {
    id: 'deux-tours',
    title: 'Mat de l’escalier (deux tours)',
    objective:
      'Mate le roi noir avec tes deux tours, en 8 coups au plus, sans l’aide de ton roi. Une tour coupe une rangée, ' +
      'l’autre donne échec, puis on échange les rôles. Ne pose jamais une tour à côté du roi noir.',
    fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1',
    goal: 'win',
    lesson: 'fin-deux-tours',
    stage: 1,
    maxMoves: 8,
    skill: 'rook-endgames',
    hints: [
      'Une tour coupe une rangée, l’autre donne échec sur la rangée voisine : le roi est repoussé.',
      'Les deux tours restent loin du roi noir et ne se placent jamais côte à côte.',
      'Premier coup : Th5 (coupe la 5e rangée), puis Ta6.',
    ],
  },
  {
    id: 'cases-cles',
    title: 'Cases clés : le roi devant le pion',
    objective:
      'Fais passer ton pion c4. Ses cases clés sont b6, c6 et d6 : si ton roi les atteint avant le roi noir, le pion ' +
      'file à dame. Place ton roi devant le pion, jamais à côté ni derrière, puis mate avec la nouvelle dame.',
    fen: '8/8/5k2/8/2P5/4K3/8/8 w - - 0 1',
    goal: 'win',
    lesson: 'fin-cases-cles',
    stage: 1,
    maxMoves: 24,
    hints: [
      'Les cases clés de c4 sont b6, c6 et d6. Ton roi doit les atteindre avant le roi noir.',
      'Ton roi monte sur la colonne d puis c, devant le pion. Il ne doit pas rester à côté ni derrière.',
      'Premier coup : Rd4 (seul coup gagnant), puis Rc5.',
    ],
  },
  {
    id: 'opposition-gagner',
    title: 'Opposition : gagner avec le pion',
    objective:
      'Fais aller ton pion à dame, puis mate. Ton roi est devant le pion, mais les rois sont en opposition avec le ' +
      'trait pour toi : le coup de pion sert de temps d’attente, comme la tour dans le mat.',
    fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
    goal: 'win',
    lesson: 'fin-opposition',
    stage: 1,
    maxMoves: 28,
    hints: [
      'Les rois sont en opposition mais tu as le trait : tu dois perdre un temps pour la reprendre.',
      'Le pion e2 peut avancer d’une case sans lâcher la garde du roi.',
      'Premier coup : e3.',
    ],
  },
  {
    id: 'opposition-tenir',
    title: 'Opposition : tenir la nulle',
    objective:
      'Avec les Noirs, empêche le pion blanc d’aller à dame : reste devant lui et reprends l’opposition chaque fois ' +
      'que le roi blanc avance. Si ton roi quitte la colonne du pion, la partie est perdue.',
    fen: '4k3/8/8/4P3/4K3/8/8/8 b - - 0 1',
    goal: 'draw',
    lesson: 'fin-opposition',
    stage: 1,
    hints: [
      'Ton roi doit rester devant le pion, sur la colonne e.',
      'Reprends l’opposition chaque fois que le roi blanc avance : un roi à deux cases du sien, en face.',
      'Re7 (ou Rd7, Rf7) : reste proche de la colonne du pion.',
    ],
  },
  {
    id: 'carre-courir',
    title: 'Règle du carré : la course',
    objective:
      'Le roi noir est hors du carré de ton pion : pousse-le sans attendre jusqu’à la promotion, puis mate avec la ' +
      'dame. Chaque coup de roi perdrait un temps et laisserait le roi noir se rapprocher.',
    fen: '8/8/8/8/2k4P/8/8/K7 w - - 0 1',
    goal: 'win',
    lesson: 'regle-du-carre',
    stage: 1,
    maxMoves: 20,
    hints: [
      'Trace le carré du pion : le roi noir peut-il y entrer ?',
      'Le pion h4 file en h5, h6, h7, h8. Le roi noir est trop loin de la colonne h.',
      'Premier coup : h5.',
    ],
  },
  {
    id: 'carre-rattraper',
    title: 'Règle du carré : rattraper le pion',
    objective:
      'Avec les Noirs, entre dans le carré du pion blanc et rattrape-le. Trace le carré h4-e4-e8-h8 : ton roi doit ' +
      'y entrer tout de suite pour capturer le pion avant qu’il ne passe.',
    fen: '8/8/8/8/3k3P/8/8/K7 b - - 0 1',
    goal: 'draw',
    lesson: 'regle-du-carre',
    stage: 1,
    maxMoves: 10,
    hints: [
      'Trace le carré du pion h4 : il va de la colonne e à la colonne h, de la 4e à la 8e rangée.',
      'Ton roi d4 doit entrer dans le carré dès maintenant, côté colonne e.',
      'Re5 (ou Re4).',
    ],
  },
  {
    id: 'pion-de-tour',
    title: 'Pion de tour : nulle dans le coin',
    objective:
      'Avec les Noirs, fais nulle contre un pion de tour : amène ton roi dans le coin de promotion (zone g7, g8, h7, ' +
      'h8). Une fois dans le coin, le roi blanc ne peut plus progresser sans risquer le pat ni perdre son pion.',
    fen: '8/8/4k3/6KP/8/8/8/8 b - - 0 1',
    goal: 'draw',
    lesson: 'fin-pion-de-tour',
    stage: 1,
    hints: [
      'Le pion h5 va vers h8 : ton objectif est de t’installer dans le coin h8.',
      'Évite la colonne d : va vers la colonne f puis g, du côté du pion.',
      'Rf7 (ou Re7), puis Rg8.',
    ],
  },
  {
    id: 'dame-contre-pion',
    title: 'Dame contre pion en 7e',
    objective:
      'Gagne avec ta dame contre un pion central en 7e rangée, puis mate. Ne le prends pas tout de suite : des échecs ' +
      'obligent le roi noir à se placer devant son pion, pendant que ton roi approche.',
    fen: '8/8/2K5/8/8/8/3p3Q/4k3 w - - 0 1',
    goal: 'win',
    lesson: 'fin-dame-pion',
    stage: 1,
    maxMoves: 22,
    skill: 'pawn-endgames',
    hints: [
      'Force le roi noir à se placer devant son pion par des échecs, avant de le capturer.',
      'Donne chaque échec de loin : la dame ne doit jamais être prise. Ton roi gagne ainsi des temps pour approcher.',
      'Premier coup : Dh1+, puis De4+.',
    ],
  },
  // --- Palier 2 -----------------------------------------------------------------------------
  {
    id: 'opposition-distance',
    title: 'Opposition à distance',
    objective:
      'Fais passer ton pion c3, puis mate. Ton roi est trop loin pour l’opposition directe : prends l’opposition à ' +
      'distance sur la colonne du roi noir, avec trois cases libres entre les rois, puis entre sur une case clé du pion.',
    fen: '4k3/8/8/8/8/2P2K2/8/8 w - - 0 1',
    goal: 'win',
    lesson: 'fin-opposition-distance',
    stage: 2,
    maxMoves: 32,
    hints: [
      'Les rois ne sont pas assez proches pour l’opposition directe. Regarde la colonne e et compte les cases libres.',
      'Il faut trois cases libres entre les rois, avec les Noirs au trait.',
      'Premier coup : Re4 (seul coup gagnant), puis Rd5.',
    ],
  },
  {
    id: 'passe-eloigne',
    title: 'Pion passé éloigné',
    objective:
      'Gagne avec ton pion passé éloigné a4 : le roi noir ne peut pas surveiller à la fois ce pion et ses pions de ' +
      'l’aile roi. Lance ton roi vers l’autre aile, puis fais passer un de tes pions et mate.',
    fen: '8/6pp/3k4/8/P7/4K3/6PP/8 w - - 0 1',
    goal: 'win',
    lesson: 'fin-pion-passe-eloigne',
    stage: 2,
    maxMoves: 30,
    hints: [
      'Le pion a4 est éloigné des autres pions : il sert d’appât, ne le pousse pas tout de suite.',
      'Lance ton roi vers l’aile roi, par le centre : le roi noir devra choisir entre le pion a4 et ses pions.',
      'Premier coup : Rf4 (Re4 ou Rd4 gagnent aussi).',
    ],
  },
  {
    id: 'percee',
    title: 'Percée de pions',
    objective:
      'Trois pions contre trois : aucun ne peut avancer sans être pris, mais le sacrifice du pion central ouvre la voie. ' +
      'Crée un pion passé que le roi noir ne rattrape pas, puis promeus et mate.',
    fen: '6k1/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1',
    goal: 'win',
    lesson: 'fin-percee',
    stage: 2,
    maxMoves: 30,
    hints: [
      'Trois pions contre trois : avance un pion pour être capturé et ouvrir une colonne.',
      'Le pion du milieu, b5, avance en b6 : les Noirs prennent et un de tes pions devient passé.',
      'Premier coup : b6 ! Après axb6, c6 ! ; après cxb6, a6 !',
    ],
  },
  {
    id: 'roi-actif',
    title: 'Le roi actif',
    objective:
      'Ton roi est le plus actif : va prendre le pion c5, puis fais aller ton pion à dame et mate. Passe par d5 pour ' +
      'attaquer le pion sans laisser le roi noir revenir.',
    fen: '8/5k2/8/2p1K3/2P5/8/8/8 w - - 0 1',
    goal: 'win',
    lesson: 'fin-roi-actif',
    stage: 2,
    maxMoves: 24,
    hints: [
      'Ton roi est plus proche du centre que le roi noir : utilise-le comme une pièce d’attaque.',
      'Le pion c5 est la cible : ton roi doit l’attaquer par d5.',
      'Premier coup : Rd5, puis Rxc5.',
    ],
  },
  {
    id: 'lucena',
    title: 'Position de Lucena',
    objective:
      'Fais aller ton pion à dame : chasse le roi noir avec ta tour, puis construis le « pont » sur la 4e rangée pour ' +
      'protéger ton roi des échecs. Gagne ensuite la partie avec ta nouvelle dame.',
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    goal: 'win',
    lesson: 'fin-lucena',
    stage: 2,
    maxMoves: 35,
    skill: 'rook-endgames',
    hints: [
      'Ton roi est enfermé devant son pion : il faut d’abord éloigner le roi noir de la colonne d.',
      'Un échec de la tour sur la colonne d chasse le roi noir.',
      'Premier coup : Td1+, puis Td4 (le pont).',
    ],
  },
  {
    id: 'philidor',
    title: 'Défense de Philidor',
    objective:
      'Avec les Noirs, tiens la nulle : ta tour garde la 6e rangée ; dès que le pion avance, donne des échecs par ' +
      'derrière. Reste sur la 6e rangée tant que le pion n’a pas dépassé cette limite.',
    fen: '4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1',
    goal: 'draw',
    lesson: 'fin-philidor',
    stage: 2,
    skill: 'rook-endgames',
    hints: [
      'Ta tour doit empêcher le roi blanc de monter : elle garde la 6e rangée.',
      'Ton roi reste en e8 et ta tour sur la 6e rangée ; tu attends que le pion avance.',
      'Un coup d’attente de la tour sur la 6e rangée ; quand le pion arrive en e6, passe derrière avec Tb1 et donne des échecs.',
    ],
  },
  {
    id: 'tour-derriere',
    title: 'Tour derrière le pion passé',
    objective:
      'Gagne avec ta tour derrière le pion passé a5. Pousse le pion en comptant sur la tour pour protéger la case de ' +
      'promotion, et éloigne ton roi des échecs de la tour noire en marchant vers elle.',
    fen: '8/3k4/7r/PK6/8/8/8/R7 w - - 0 1',
    goal: 'win',
    lesson: 'fin-tour-derriere',
    stage: 2,
    maxMoves: 34,
    skill: 'rook-endgames',
    hints: [
      'Ta tour est derrière le pion : c’est sa bonne place. Il faut maintenant faire avancer le pion.',
      'Le roi noir est loin : pousse le pion, soutenu par la tour, et sors des échecs en allant vers la tour noire.',
      'Premier coup : a6, puis a7.',
    ],
  },
  {
    id: 'bon-fou',
    title: 'Fou et pion de tour : le bon fou',
    objective:
      'Ton fou contrôle le coin de promotion : fais aller ton pion à dame, sans pat. Ton roi et ton fou poussent ' +
      'ensemble, et le roi noir reste dans le coin.',
    fen: '7k/8/6K1/7P/8/8/8/2B5 w - - 0 1',
    goal: 'win',
    lesson: 'fin-bon-fou',
    stage: 2,
    maxMoves: 8,
    hints: [
      'Ton fou contrôle h8, la case de promotion : le roi noir ne peut pas s’y réfugier.',
      'Ne prive pas le roi noir de toutes ses cases : sinon c’est pat.',
      'Fe3 (un coup de fou tranquille), puis h6 et h7+.',
    ],
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
