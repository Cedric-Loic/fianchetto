import { Chess } from 'chess.js';
import type { Color, OpeningDeviation, Recommendation } from '@sq/shared';

/*
 * Répertoire d'ouvertures (lot 4d), écrit pour le projet : partie italienne avec les Blancs ;
 * 1…e5 contre 1. e4 (et la scandinave, vue dans la leçon « Pièges contre 1…e5 et la
 * scandinave ») et 1…d5 contre 1. d4 avec les Noirs. Les lignes partagent leurs premiers coups :
 * elles forment un arbre par camp, où le joueur a une seule réponse par position (sauf au
 * premier coup des Noirs contre 1. e4). La légalité de chaque ligne est vérifiée par les tests.
 */

export interface OpeningLine {
  id: string;
  /** Camp du joueur. */
  color: Color;
  group: string;
  title: string;
  /** Idée de la ligne, en une phrase (notation française). */
  idea: string;
  /** Coups depuis la position initiale (SAN anglaise, celle de chess.js). */
  moves: readonly string[];
}

const ITALIAN = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'];
const GIUOCO = [...ITALIAN, 'Bc5', 'c3', 'Nf6'];
const TWO_KNIGHTS_G5 = [...ITALIAN, 'Nf6', 'Ng5', 'd5', 'exd5'];

export const OPENING_LINES: readonly OpeningLine[] = [
  // --- Blancs : partie italienne -----------------------------------------------------------
  {
    id: 'w-giuoco-pianissimo',
    color: 'w',
    group: 'Partie italienne',
    title: 'Giuoco pianissimo : c3, d3 et roque',
    idea: 'Construire lentement avec c3 et d3, roquer, puis Te1 et Cbd2-f1-g3 avant de préparer d4.',
    moves: [...GIUOCO, 'd3', 'd6', 'O-O', 'O-O', 'Re1', 'a6', 'Bb3', 'Ba7', 'Nbd2'],
  },
  {
    id: 'w-giuoco-d4',
    color: 'w',
    group: 'Partie italienne',
    title: 'Giuoco piano : contre 4…d6, le centre avec d4',
    idea: 'Si les Noirs ne mettent pas la pression sur e4, d4 ! construit un grand centre ; h3 empêche …Fg4 avant le roque.',
    moves: [
      ...ITALIAN,
      'Bc5',
      'c3',
      'd6',
      'd4',
      'exd4',
      'cxd4',
      'Bb6',
      'Nc3',
      'Nf6',
      'h3',
      'O-O',
      'O-O',
    ],
  },
  {
    id: 'w-two-knights-g5',
    color: 'w',
    group: 'Partie italienne',
    title: 'Deux cavaliers : 4. Cg5 et 5…Ca5',
    idea: 'Cg5 attaque f7 ; après la bonne défense 5…Ca5, Fb5+ garde le pion de plus et les Noirs cherchent l’activité.',
    moves: [
      ...TWO_KNIGHTS_G5,
      'Na5',
      'Bb5+',
      'c6',
      'dxc6',
      'bxc6',
      'Be2',
      'h6',
      'Nf3',
      'e4',
      'Ne5',
    ],
  },
  {
    id: 'w-fegatello',
    color: 'w',
    group: 'Pièges de l’Italienne',
    title: 'Piège : le Fegatello (foie frit)',
    idea: 'Si 5…Cxd5 ?!, Cxf7 ! Rxf7 Df3+ : le cavalier d5 est cloué et Cc3 l’attaque une fois de plus.',
    moves: [...TWO_KNIGHTS_G5, 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+', 'Ke6', 'Nc3'],
  },
  {
    id: 'w-legal',
    color: 'w',
    group: 'Pièges de l’Italienne',
    title: 'Piège : le mat de Légal',
    idea: 'Le fou g4 ne cloue pas vraiment le cavalier : Cxe5 ! et si …Fxd1 ??, Fxf7+ Re7 Cd5 est mat.',
    moves: [...ITALIAN, 'd6', 'Nc3', 'Bg4', 'h3', 'Bh5', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'],
  },
  {
    id: 'w-blackburne-avoid',
    color: 'w',
    group: 'Pièges de l’Italienne',
    title: 'Contre 3…Cd4 : ne pas prendre en e5',
    idea: 'Cxe5 ?? perdrait sur …Dg5 ; on échange en d4, puis c3 ouvre le jeu avec une avance de développement.',
    moves: [...ITALIAN, 'Nd4', 'Nxd4', 'exd4', 'c3', 'dxc3', 'Nxc3', 'd6', 'd4', 'Nf6', 'O-O'],
  },
  {
    id: 'w-hungarian',
    color: 'w',
    group: 'Partie italienne',
    title: 'Défense hongroise : 3…Fe7',
    idea: 'Contre le passif 3…Fe7, d4 ! prend le centre ; développement rapide et h3 pour priver les Noirs de g4.',
    moves: [...ITALIAN, 'Be7', 'd4', 'exd4', 'Nxd4', 'd6', 'Nc3', 'Nf6', 'O-O', 'O-O', 'h3'],
  },
  {
    id: 'w-philidor',
    color: 'w',
    group: 'Autres réponses',
    title: 'Défense Philidor : 2…d6',
    idea: 'Contre 2…d6, d4 et Fc4 : pression au centre et sur f7, roque puis Te1 et a4 pour gagner de l’espace.',
    moves: [
      'e4',
      'e5',
      'Nf3',
      'd6',
      'd4',
      'Nf6',
      'Nc3',
      'Nbd7',
      'Bc4',
      'Be7',
      'O-O',
      'O-O',
      'Re1',
      'c6',
      'a4',
    ],
  },
  {
    id: 'w-petrov',
    color: 'w',
    group: 'Autres réponses',
    title: 'Défense russe : 2…Cf6',
    idea: 'Cxe5 puis Cf3 : le pion e4 se reprend après d6, et d4, Fd3, c4 donnent l’avantage d’espace (si 3…Cxe4 ?, De2 !).',
    moves: [
      'e4',
      'e5',
      'Nf3',
      'Nf6',
      'Nxe5',
      'd6',
      'Nf3',
      'Nxe4',
      'd4',
      'd5',
      'Bd3',
      'Nc6',
      'O-O',
      'Be7',
      'c4',
    ],
  },

  // --- Noirs contre 1. e4 : 1…e5 -------------------------------------------------------------
  {
    id: 'b-italian-quiet',
    color: 'b',
    group: '1…e5 contre 1. e4',
    title: 'Contre l’Italienne tranquille',
    idea: 'Le fou c5 vise f2 ; …d6, …a6 et …Fa7 mettent le fou à l’abri d’un futur d4 ou Ca4.',
    moves: [...GIUOCO, 'd3', 'd6', 'O-O', 'O-O', 'Re1', 'a6', 'Bb3', 'Ba7'],
  },
  {
    id: 'b-italian-d4',
    color: 'b',
    group: '1…e5 contre 1. e4',
    title: 'Contre l’Italienne avec d4',
    idea: 'Prendre en d4, échec en b4, échanger les fous puis …d5 ! frappe le centre blanc avant qu’il ne s’installe.',
    moves: [...GIUOCO, 'd4', 'exd4', 'cxd4', 'Bb4+', 'Bd2', 'Bxd2+', 'Nbxd2', 'd5', 'exd5', 'Nxd5'],
  },
  {
    id: 'b-scotch',
    color: 'b',
    group: '1…e5 contre 1. e4',
    title: 'Contre l’Écossaise',
    idea: 'Après 3. d4, prendre, développer avec gain de temps (…Cf6, …Fb4) puis …d5 libère le jeu.',
    moves: [
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'd4',
      'exd4',
      'Nxd4',
      'Nf6',
      'Nc3',
      'Bb4',
      'Nxc6',
      'bxc6',
      'Bd3',
      'd5',
      'exd5',
      'cxd5',
      'O-O',
      'O-O',
    ],
  },
  {
    id: 'b-ruy-closed',
    color: 'b',
    group: '1…e5 contre 1. e4',
    title: 'Contre l’Espagnole',
    idea: '…a6 et …b5 chassent le fou, …Fe7 et le roque : la partie espagnole fermée, solide pour les Noirs.',
    moves: [
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bb5',
      'a6',
      'Ba4',
      'Nf6',
      'O-O',
      'Be7',
      'Re1',
      'b5',
      'Bb3',
      'd6',
      'c3',
      'O-O',
    ],
  },
  {
    id: 'b-ruy-exchange',
    color: 'b',
    group: '1…e5 contre 1. e4',
    title: 'Contre l’Espagnole d’échange',
    idea: 'Après Fxc6, reprendre vers le centre (…dxc6) ; …f6 tient e5 et la paire de fous compense les pions doublés.',
    moves: [
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bb5',
      'a6',
      'Bxc6',
      'dxc6',
      'O-O',
      'f6',
      'd4',
      'exd4',
      'Nxd4',
      'c5',
      'Nb3',
      'Qxd1',
      'Rxd1',
      'Bg4',
    ],
  },
  {
    id: 'b-early-queen',
    color: 'b',
    group: '1…e5 contre 1. e4',
    title: 'Contre le coup du berger',
    idea: 'Contre Dh5 et Fc4, …g6 coupe la ligne vers f7 ; on développe ensuite en chassant la dame.',
    moves: [
      'e4',
      'e5',
      'Qh5',
      'Nc6',
      'Bc4',
      'g6',
      'Qf3',
      'Nf6',
      'Ne2',
      'Bg7',
      'Nbc3',
      'd6',
      'd3',
      'Bg4',
      'Qg3',
      'Nd4',
    ],
  },
  {
    id: 'b-scandinavian',
    color: 'b',
    group: 'Scandinave (surprise)',
    title: 'Scandinave : la dame en a5',
    idea: 'Reprendre en d5 puis …Da5 : la dame surveille la 5e rangée ; …c6, …Ff5 et …e6 donnent une position solide.',
    moves: [
      'e4',
      'd5',
      'exd5',
      'Qxd5',
      'Nc3',
      'Qa5',
      'd4',
      'Nf6',
      'Nf3',
      'c6',
      'Bc4',
      'Bf5',
      'Bd2',
      'e6',
    ],
  },

  // --- Noirs contre 1. d4 : 1…d5 -------------------------------------------------------------
  {
    id: 'b-qgd',
    color: 'b',
    group: '1…d5 contre 1. d4',
    title: 'Gambit dame refusé',
    idea: '…e6 tient d5 ; développement, roque, puis …dxc4 et …Cd5 pour se libérer par des échanges (idée de Capablanca).',
    moves: [
      'd4',
      'd5',
      'c4',
      'e6',
      'Nc3',
      'Nf6',
      'Bg5',
      'Be7',
      'e3',
      'O-O',
      'Nf3',
      'Nbd7',
      'Rc1',
      'c6',
      'Bd3',
      'dxc4',
      'Bxc4',
      'Nd5',
    ],
  },
  {
    id: 'b-london',
    color: 'b',
    group: '1…d5 contre 1. d4',
    title: 'Contre le système de Londres',
    idea: 'Contre Ff4, …c5 conteste d4 tout de suite ; …Cc6, …e6 et …Fd6 neutralisent le fou f4.',
    moves: [
      'd4',
      'd5',
      'Bf4',
      'Nf6',
      'e3',
      'c5',
      'c3',
      'Nc6',
      'Nd2',
      'e6',
      'Ngf3',
      'Bd6',
      'Bg3',
      'O-O',
      'Bd3',
      'b6',
    ],
  },
  {
    id: 'b-colle',
    color: 'b',
    group: '1…d5 contre 1. d4',
    title: 'Contre le système Colle',
    idea: 'Contre e3 et Fd3, …c5 et …Cc6 pressent d4 ; le fou d6 et le roque complètent un développement harmonieux.',
    moves: [
      'd4',
      'd5',
      'Nf3',
      'Nf6',
      'e3',
      'e6',
      'Bd3',
      'c5',
      'b3',
      'Nc6',
      'O-O',
      'Bd6',
      'Bb2',
      'O-O',
    ],
  },
];

const BY_ID = new Map(OPENING_LINES.map((l) => [l.id, l]));

export function openingLineById(id: string): OpeningLine | undefined {
  return BY_ID.get(id);
}

/** Un demi-coup d'une ligne, rejoué par chess.js. */
export interface OpeningLineStep {
  uci: string;
  san: string;
  /** Position avant le coup. */
  fenBefore: string;
  /** Position après le coup. */
  fen: string;
}

/** Rejoue une ligne ; lève une erreur si un coup est illégal (vérifié par les tests). */
export function openingLineSteps(line: OpeningLine): OpeningLineStep[] {
  const chess = new Chess();
  return line.moves.map((san) => {
    const fenBefore = chess.fen();
    const m = chess.move(san);
    return { uci: m.lan, san: m.san, fenBefore, fen: chess.fen() };
  });
}

/** SAN sans échec, mat ni annotation (« Nxf7+!? » → « Nxf7 »). */
function bareSan(san: string): string {
  return san.replace(/[+#!?]+$/, '');
}

/**
 * Écart d'une partie avec le répertoire du camp `color` : premier demi-coup où le coup joué n'est
 * prévu par aucune ligne encore suivie. `null` si la partie suit le répertoire jusqu'au bout
 * d'une ligne (ou s'arrête avant). `moves` : SAN depuis la position initiale.
 */
export function repertoireDeviation(
  moves: readonly string[],
  color: Color,
): OpeningDeviation | null {
  let candidates = OPENING_LINES.filter((l) => l.color === color);
  for (let i = 0; i < moves.length; i++) {
    const expected = [...new Set(candidates.flatMap((l) => l.moves.slice(i, i + 1)))];
    // Une ligne est arrivée à son terme : la partie a suivi le répertoire.
    if (expected.length === 0 || candidates.some((l) => l.moves.length === i)) return null;
    const played = moves[i] as string;
    const next = candidates.filter((l) => bareSan(l.moves[i] ?? '') === bareSan(played));
    if (next.length === 0) {
      const mover: Color = i % 2 === 0 ? 'w' : 'b';
      return {
        ply: i + 1,
        moveNumber: Math.floor(i / 2) + 1,
        by: mover === color ? 'player' : 'opponent',
        played,
        expected,
      };
    }
    candidates = next;
  }
  return null;
}

/** Intervalles de révision par défaut (jours), les mêmes que ceux des puzzles. */
export const OPENING_INTERVALS_DAYS: readonly number[] = [1, 3, 7, 21];
const DAY = 24 * 3600 * 1000;

/** État de révision d'une ligne : étape (indice dans les intervalles) et prochaine échéance. */
export interface OpeningSchedule {
  step: number;
  dueAt: number;
}

/**
 * Répétition espacée : une réussite passe à l'intervalle suivant (le dernier, 21 jours, se
 * répète : une ligne apprise reste à entretenir) ; un échec renvoie au premier intervalle. Une
 * ligne nouvelle réussie commence au premier intervalle.
 */
export function nextOpeningSchedule(
  previous: OpeningSchedule | null,
  success: boolean,
  now: number,
  intervals: readonly number[] = OPENING_INTERVALS_DAYS,
): OpeningSchedule {
  const last = intervals.length - 1;
  const step = !success || !previous ? 0 : Math.min(previous.step + 1, last);
  return { step, dueAt: now + (intervals[step] ?? 1) * DAY };
}

/** Une ligne a atteint le dernier intervalle de révision. */
export function openingLearned(
  schedule: OpeningSchedule | null,
  intervals: readonly number[] = OPENING_INTERVALS_DAYS,
): boolean {
  return schedule !== null && schedule.step >= intervals.length - 1;
}

/**
 * Recommandation « Que faire maintenant ? » du coach quand des lignes d'ouverture sont dues
 * (`null` sinon). À intégrer dans `buildDashboard` avec le nombre de lignes dues.
 */
export function openingsRecommendation(due: number): Recommendation | null {
  if (due <= 0) return null;
  return {
    text:
      due === 1
        ? 'Révise ta ligne d’ouverture du jour (2 min).'
        : `Révise tes ${due} lignes d’ouverture dues (${Math.min(2 * due, 15)} min).`,
    href: '#/openings',
  };
}
