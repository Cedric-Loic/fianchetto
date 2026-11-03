import type { Lesson } from './types.js';

/*
 * Cours de finales, palier 3 (1400-1600). Même format que les paliers précédents : une question
 * d'abord, l'explication ensuite, un pas à pas commenté, des exercices (cases, choix, coup exact,
 * moteur). Les annotations sont originales.
 *
 * Vérification : Stockfish (`pnpm test:stress`, apps/server/test/{lessons,endgames}.stress.ts).
 * Les chapitres dont l'évaluation du moteur n'est pas fiable (forteresses) n'ont pas de partie
 * contre le bot : leçon et quiz de concepts seulement.
 */

const VANCURA: Lesson = {
  id: 'fin-vancura',
  phase: 3,
  title: 'La position de Vancura',
  summary:
    'Pion de tour en 6e rangée, tour adverse devant lui : ta tour attaque par le côté et donne des échecs de loin.',
  minutes: 20,
  sections: [
    {
      kind: 'text',
      body:
        'Les Blancs ont un pion de tour, a6, soutenu par leur tour placée devant lui, en a8. Tu défends avec une tour seule. ' +
        '**Question : comment un pion si avancé peut-il ne pas gagner ?** Parce que ta tour attaque le pion **par le côté**, ' +
        'sur la 6e rangée : la tour blanche est liée à sa défense, et si elle quitte la colonne a, tu prends le pion.\n\n' +
        'Le roi blanc, lui, doit venir aider. Mais tu as une arme : les **échecs latéraux, de loin**.',
    },
    {
      kind: 'example',
      fen: 'R7/6k1/Pr6/8/8/3K4/8/8 b - - 0 1',
      caption:
        'Position de Vancura : la tour noire attaque a6 par le côté, le roi noir reste loin du pion, en g7. La tour blanche ' +
        'est liée à la colonne a. Les Blancs ne peuvent pas progresser sans lâcher le pion.',
      marks: ['a6', 'a8', 'b6', 'g7'],
    },
    {
      kind: 'text',
      title: 'Trois consignes',
      body:
        '1. **Ta tour garde la 6e rangée** : elle attaque a6 par le côté, de loin (f6 plutôt que b6) pour éviter d’être attaquée.\n' +
        '2. **Ton roi reste loin du pion**, côté roi (g7) : un roi qui se rapproche se met sur la route de sa propre tour.\n' +
        '3. **Quand le roi blanc s’approche**, tu donnes échec depuis le côté, de loin, sur la colonne f : Tf4+, Tf5+, Tf6+. ' +
        'Il ne trouve aucun abri.',
    },
    {
      kind: 'walkthrough',
      title: 'Les échecs latéraux',
      fen: 'R7/6k1/Pr6/8/8/3K4/8/8 b - - 0 1',
      moves: [
        {
          uci: 'b6f6',
          comment:
            'La tour s’éloigne du pion mais reste sur la 6e rangée : elle attaque toujours a6, sans craindre le roi blanc.',
        },
        { uci: 'd3d4', comment: 'Le roi blanc approche, dans l’espoir de soutenir son pion.' },
        { uci: 'f6c6', comment: 'La tour garde la 6e rangée, à bonne distance du roi.' },
        { uci: 'd4d5', comment: 'Le roi blanc attaque la tour c6.' },
        { uci: 'c6f6', comment: 'La tour recule sur la colonne f, toujours sur la 6e rangée.' },
        { uci: 'd5c4', comment: 'Le roi blanc change d’itinéraire, vers la colonne b.' },
        {
          uci: 'f6f4',
          comment:
            'Échec latéral, de loin : le roi blanc ne peut pas avancer en b5 sans que la tour le suive.',
        },
        { uci: 'c4b5', comment: 'Le roi blanc se rapproche du pion.' },
        { uci: 'f4f5', comment: 'Un autre échec, sur la 5e rangée.' },
        { uci: 'b5c6', comment: 'Le roi blanc s’éloigne du pion pour échapper aux échecs.' },
        {
          uci: 'f5f6',
          comment: 'Échec encore : le roi blanc ne trouve aucun abri, et la position est nulle.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: 'R7/6k1/Pr6/8/8/3K4/8/8 b - - 0 1',
      prompt: 'Clique sur la pièce blanche qui ne peut pas quitter la défense du pion a6.',
      mode: 'squares',
      solution: [],
      squares: ['a8'],
      hints: [
        'Quelle pièce défend directement le pion a6 ?',
        'Le roi blanc est trop loin : c’est une tour.',
        'La tour a8.',
      ],
      explanation:
        'La tour a8 protège a6 le long de la colonne a. Si elle part sur la 8e rangée, ta tour prend le pion et la finale est nulle.',
    },
    {
      fen: 'R7/6k1/Pr6/8/8/3K4/8/8 b - - 0 1',
      prompt: 'Les Noirs jouent et tiennent la nulle. Que fais-tu ?',
      mode: 'engine',
      solution: ['b6f6'],
      tolerance: 10,
      traps: ['b6b1', 'b6b5', 'g7g6', 'g7f7'],
      hints: [
        'Ta tour doit rester sur la 6e rangée, mais pas près du roi blanc.',
        'Le roi noir reste à sa place, loin du pion, et la tour s’éloigne en restant sur la 6e rangée.',
        'Tf6 (Tc6, Te6 et Th6 conviennent aussi).',
      ],
      explanation:
        'Tf6 ! garde la 6e rangée. Tb1 ? et Tb5 ? quittent la 6e rangée ; Rg6 ? et Rf7 ? rapprochent le roi du pion : dans tous ces ' +
        'cas, les Blancs reprennent l’initiative et la finale est perdue.',
    },
    {
      fen: 'R7/6k1/P7/1K6/5r2/8/8/8 b - - 0 1',
      prompt: 'Le roi blanc est en b5, juste devant le pion. Comment l’empêches-tu d’avancer ?',
      mode: 'engine',
      solution: ['f4f5'],
      tolerance: 10,
      traps: ['f4f6', 'f4f1', 'f4h4'],
      hints: [
        'Une tour peut donner un échec sans s’approcher du roi.',
        'Le roi est sur la 5e rangée : ta tour est sur la colonne f.',
        'Tf5+ : échec latéral, de loin.',
      ],
      explanation:
        'Tf5+ ! L’échec latéral oblige le roi blanc à s’éloigner du pion. Tf6, Tf1 et Th4 ne donnent pas échec : le roi blanc ' +
        'avance, et le pion avec lui.',
    },
    {
      fen: 'R7/6k1/P7/2K5/8/8/8/5r2 b - - 0 1',
      prompt: 'Le roi blanc est en c5. Quel coup de tour tient la nulle ?',
      mode: 'engine',
      solution: ['f1f5'],
      tolerance: 10,
      traps: ['f1c1', 'f1a1', 'g7f7'],
      hints: [
        'Reste à distance du roi blanc, sans te mettre sur une colonne qui le gêne.',
        'La tour doit donner échec depuis la colonne f ou garder la 6e rangée.',
        'Tf5+ (Tf6 convient aussi).',
      ],
      explanation:
        'Tf5+ ! La tour continue à harceler le roi depuis la colonne f. Tc1+ ? et Ta1 ? rapprochent la tour du roi et du pion : ' +
        'le roi blanc gagne un temps et le pion passe.',
    },
    {
      fen: 'R7/6k1/P4r2/8/3K4/8/8/8 b - - 0 1',
      prompt: 'Le roi blanc est en d4. Quelle tour garde la 6e rangée, sans erreur ?',
      mode: 'engine',
      solution: ['f6c6'],
      tolerance: 10,
      traps: ['f6f1', 'f6f5', 'g7g6'],
      hints: [
        'Le roi blanc s’approche. Où ta tour est-elle en sécurité sur la 6e rangée ?',
        'Reste sur la 6e rangée, loin de d4.',
        'Tc6, Tb6, Te6 ou Th6 conviennent.',
      ],
      explanation:
        'Tc6 ! (ou Tb6, Te6, Th6) garde la 6e rangée sans se laisser attaquer. Tf1 ? et Tf5 ? l’abandonnent, et Rg6 ? ' +
        'rapproche le roi : dans tous ces cas, les Blancs gagnent.',
    },
  ],
};

const FOUS_OPPOSES: Lesson = {
  id: 'fin-fous-opposes',
  phase: 3,
  title: 'Les fous de couleurs opposées',
  summary:
    'La finale la plus nulle de toutes : un pion de plus ne suffit pas, il faut deux pions liés ou éloignés.',
  minutes: 22,
  sections: [
    {
      kind: 'text',
      body:
        'Chaque camp a un fou, mais l’un est sur les cases claires et l’autre sur les cases sombres. **Question : ' +
        'avec un pion de plus, es-tu mieux ?** Presque jamais : un fou ne peut pas attaquer les cases de l’autre couleur, ' +
        'si bien que le défenseur peut **bloquer** les pions sur ses propres cases, et son fou ne se fait jamais chasser.\n\n' +
        'Pour gagner, l’attaquant a besoin de **deux pions de plus**, bien placés.',
    },
    {
      kind: 'example',
      fen: '8/6k1/8/4PP2/4K3/3B4/8/6b1 w - - 0 1',
      caption:
        'Deux pions liés, e5 et f5, soutenus par le roi : les Blancs gagnent. Le fou noir ne peut pas arrêter les deux ' +
        'pions, qui avancent ensemble, protégés par le roi.',
      marks: ['e5', 'f5'],
    },
    {
      kind: 'example',
      fen: '8/6k1/8/4P1P1/4K3/3B4/8/6b1 w - - 0 1',
      caption:
        'Deux pions séparés d’une colonne, e5 et g5 : c’est nulle. Le roi noir et le fou noir bloquent les pions, dont aucun ne ' +
        'peut en protéger un autre.',
      marks: ['e5', 'g5'],
    },
    {
      kind: 'example',
      fen: '8/6k1/8/P4P2/4K3/3B4/8/6b1 w - - 0 1',
      caption:
        'Deux pions très éloignés, a5 et f5 : les Blancs gagnent, car le fou et le roi noirs ne peuvent pas arrêter les deux ' +
        'pions à la fois, comme en finale de pions avec un pion passé éloigné.',
      marks: ['a5', 'f5'],
    },
    {
      kind: 'text',
      title: 'La défense',
      body:
        '1. **Bloque** les pions sur les cases de la couleur de ton fou : le fou adverse ne peut pas t’en chasser.\n' +
        '2. **Place ton fou sur une grande diagonale**, où il attaque plusieurs cases à la fois.\n' +
        '3. **Garde ton roi devant les pions**, sur les cases de l’autre couleur : il bloque ce que le fou ne voit pas.\n' +
        '4. Ne mets jamais ton fou en prise : tu n’as pas de pièce pour le défendre.',
    },
    {
      kind: 'walkthrough',
      title: 'Bloquer deux pions séparés',
      fen: '8/6k1/8/8/4P1P1/3B4/6K1/6b1 b - - 0 1',
      moves: [
        {
          uci: 'g1d4',
          comment:
            'Le fou prend la grande diagonale : il contrôle e5 et empêche le pion e4 d’avancer, sans être attaquable par le roi ou le fou blanc.',
        },
        { uci: 'g2g3', comment: 'Le roi blanc avance pour soutenir g4.' },
        {
          uci: 'g7f6',
          comment: 'Le roi noir se place devant les pions, sur f6 : il contrôle e5, f5 et g5.',
        },
        { uci: 'g3h4', comment: 'Le roi blanc cherche à gagner de l’espace.' },
        { uci: 'd4f2', comment: 'Échec : le fou donne échec depuis la diagonale f2-h4.' },
        {
          uci: 'h4h5',
          comment: 'Le roi blanc s’avance, mais il n’y a toujours aucun progrès possible.',
        },
        { uci: 'f2e3', comment: 'Le fou revient sur la diagonale e3-h6 : il surveille f4 et g5.' },
        { uci: 'd3b5', comment: 'Le fou blanc cherche un autre angle d’attaque.' },
        { uci: 'e3f4', comment: 'Le fou noir se place de façon à garder les cases g5 et e5.' },
      ],
    },
  ],
  exercises: [
    {
      fen: '8/6k1/8/4PP2/4K3/3B4/8/6b1 w - - 0 1',
      prompt: 'Désigne les deux pions liés (côte à côte, sur des colonnes voisines).',
      mode: 'squares',
      solution: [],
      squares: ['e5', 'f5'],
      hints: [
        'Des pions liés sont sur deux colonnes voisines.',
        'Les deux pions blancs sont l’un à côté de l’autre.',
        'e5 et f5.',
      ],
      explanation:
        'Les pions e5 et f5 sont liés : ils se protègent l’un l’autre et avancent ensemble, sous la protection du roi blanc.',
    },
    {
      fen: '8/6k1/8/P4P2/4K3/3B4/8/6b1 w - - 0 1',
      prompt:
        'Les deux fous sont de couleurs opposées. Clique sur le fou blanc, celui qui joue sur les cases claires.',
      mode: 'squares',
      solution: [],
      squares: ['d3'],
      hints: [
        'a1 est sombre, b1 est claire, c1 est sombre, d1 est claire…',
        'd3 est sur la même couleur que d1.',
        'Le fou blanc est en d3.',
      ],
      explanation:
        'La case d3 est claire (comme d1 et b1) ; le fou noir g1 est sur une case sombre. C’est ce qui fait de la finale une position à fous de couleurs opposées.',
    },
    {
      fen: '8/6k1/8/4PP2/4K3/3B4/8/6b1 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent avec leurs deux pions liés. Quel pion avance ?',
      mode: 'engine',
      solution: ['f5f6'],
      tolerance: 10,
      traps: ['e5e6'],
      hints: [
        'Les pions doivent avancer ensemble, le roi derrière eux.',
        'Quel pion peut avancer en donnant échec au roi noir ?',
        'f6+ !',
      ],
      explanation:
        'f6+ ! ouvre la voie, avec échec : le roi noir doit s’écarter. e6 ? laisse le fou noir se placer devant le pion et le bloquer.',
    },
    {
      fen: '8/6k1/8/P4P2/4K3/3B4/8/6b1 w - - 0 1',
      prompt: 'Deux pions éloignés, a5 et f5. Quel est le bon coup ?',
      mode: 'engine',
      solution: ['e4e5'],
      tolerance: 10,
      traps: ['f5f6'],
      hints: [
        'Quel pion est le plus en danger ?',
        'Ton roi doit venir soutenir le pion f5.',
        'Re5.',
      ],
      explanation:
        'Re5 ! Le roi soutient le pion f, tandis que le pion a oblige le fou noir à s’en occuper. f6 ? avance trop tôt : le fou noir bloque.',
    },
    {
      fen: '8/6k1/8/8/4P1P1/3B4/6K1/6b1 b - - 0 1',
      prompt: 'Les Noirs jouent et tiennent la nulle. Où place-t-on le fou ?',
      mode: 'engine',
      solution: ['g1d4'],
      tolerance: 5,
      traps: ['g7f7', 'g7g6', 'g1h2'],
      hints: [
        'Le fou noir doit contrôler la case d’avance du pion e4, e5.',
        'La grande diagonale est la meilleure : elle passe par e5.',
        'Fd4 !',
      ],
      explanation:
        'Fd4 ! prend la grande diagonale, contrôle e5, et ne peut pas être attaqué par le fou blanc (couleur opposée). Rf7 ?, ' +
        'Rg6 ? et Fh2 ? laissent le pion e avancer : les Blancs gagnent.',
    },
  ],
};

const PETIT_COTE: Lesson = {
  id: 'fin-petit-cote',
  phase: 3,
  title: 'La défense par le petit côté',
  summary:
    'Roi sur le côté court du pion, tour loin sur le côté long pour donner des échecs : le plan de base contre un pion central.',
  minutes: 20,
  sections: [
    {
      kind: 'text',
      body:
        'Tu défends une tour contre tour et pion, avec un pion central, par exemple e5, et le roi blanc devant lui, en e6. ' +
        '**Question : de quel côté du pion placer ton roi et ta tour ?** Compte les colonnes de part et d’autre du pion : pour le ' +
        'pion e, il y en a trois à droite (f, g, h) et quatre à gauche (a, b, c, d). Le côté qui a le moins de colonnes est ' +
        'le **petit côté**.\n\n' +
        'Le plan : ton **roi reste sur le petit côté**, près du pion, et ta **tour va sur le grand côté**, loin, d’où elle ' +
        'donne des échecs à distance, sans jamais être attaquée par le roi blanc.',
    },
    {
      kind: 'example',
      fen: 'r7/7k/4K3/4P3/8/8/8/4R3 b - - 0 1',
      caption:
        'Le pion e5 est soutenu par son roi e6 et sa tour e1. Le roi noir est en h7, sur le petit côté (f, g, h) ; la tour ' +
        'noire est en a8, très loin, sur le grand côté. C’est nulle, à condition de ne jamais lâcher cette organisation.',
      marks: ['h7', 'a8'],
    },
    {
      kind: 'text',
      title: 'Ce qu’il ne faut pas faire',
      body:
        '1. **Mettre la tour du côté du roi** : elle gêne le roi, et le roi blanc entre par le côté opposé.\n' +
        '2. **Rapprocher la tour du roi blanc** : il l’attaque en gagnant des temps.\n' +
        '3. **Quitter le petit côté** avec le roi : le roi blanc entre derrière.\n\n' +
        'Quand ce n’est pas ton tour de jouer, le coup d’attente est un coup de **roi** sur le petit côté (h7 vers g7), ' +
        'jamais un coup de tour.',
    },
    {
      kind: 'walkthrough',
      title: 'Roi au petit côté, tour au grand côté',
      fen: 'r7/7k/4K3/4P3/8/8/8/4R3 b - - 0 1',
      moves: [
        {
          uci: 'h7g7',
          comment:
            'Un coup d’attente de roi sur le petit côté. La tour a8 ne bouge pas : elle est bien placée.',
        },
        {
          uci: 'e1g1',
          comment: 'Échec sur la colonne g : les Blancs cherchent à déloger le roi noir.',
        },
        {
          uci: 'g7f8',
          comment: 'Le roi noir reste sur le petit côté (côté du pion), sur la 8e rangée.',
        },
        { uci: 'g1d1', comment: 'La tour blanche change de colonne, prête à monter en d6.' },
        { uci: 'f8e8', comment: 'Le roi noir se place devant le pion, en e8.' },
        { uci: 'd1d6', comment: 'La tour blanche s’avance, soutenue par le roi e6.' },
        {
          uci: 'a8a7',
          comment: 'La tour noire passe sur la 7e rangée, d’où elle donne des échecs de loin.',
        },
        { uci: 'd6b6', comment: 'Les Blancs préparent un abri pour leur roi.' },
        { uci: 'a7e7', comment: 'Échec depuis la 7e rangée : le roi blanc doit bouger.' },
        { uci: 'e6f5', comment: 'Le roi blanc sort de l’échec.' },
        { uci: 'e7f7', comment: 'La tour noire change de colonne, sans cesser de donner échec.' },
        {
          uci: 'f5e6',
          comment: 'Les Blancs reviennent : les échecs vont se répéter, c’est nulle.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: '8/8/8/4P3/8/8/8/K6k w - - 0 1',
      prompt:
        'Le pion blanc est en e5. Clique les cases de la 8e rangée qui appartiennent au petit côté.',
      mode: 'squares',
      solution: [],
      squares: ['f8', 'g8', 'h8'],
      hints: [
        'Compte les colonnes à gauche et à droite du pion e.',
        'À gauche : a, b, c, d (quatre colonnes). À droite : f, g, h.',
        'Le petit côté est celui de droite : f8, g8 et h8.',
      ],
      explanation:
        'Trois colonnes (f, g, h) contre quatre (a, b, c, d) : le petit côté du pion e est à droite. Le roi défenseur y reste.',
    },
    {
      fen: '8/8/8/2P5/8/8/8/K6k w - - 0 1',
      prompt:
        'Cette fois, le pion blanc est en c5. Clique les cases de la 8e rangée du petit côté.',
      mode: 'squares',
      solution: [],
      squares: ['a8', 'b8'],
      hints: [
        'Compte les colonnes à gauche et à droite du pion c.',
        'À gauche : a et b (deux colonnes). À droite : d, e, f, g, h.',
        'Le petit côté est à gauche : a8 et b8.',
      ],
      explanation:
        'Deux colonnes (a, b) contre cinq : le petit côté du pion c est à gauche. Selon le pion, le petit côté change.',
    },
    {
      fen: 'r7/7k/4K3/4P3/8/8/8/4R3 b - - 0 1',
      prompt:
        'Les Noirs jouent et tiennent la nulle. Ton roi est sur le petit côté, ta tour sur le grand côté. Que joues-tu ?',
      mode: 'engine',
      solution: ['h7g7'],
      tolerance: 5,
      traps: ['a8a3', 'a8b8', 'h7h6', 'a8h8'],
      hints: [
        'Ta position est bonne : ne change rien d’essentiel.',
        'Un coup d’attente de roi, sans quitter le petit côté.',
        'Rg7 (Rg8 convient aussi).',
      ],
      explanation:
        'Rg7 ! est un coup d’attente de roi. Ta tour reste très loin sur le grand côté. Ta3 ?, Tb8 ? et Th8 ? la déplacent ' +
        'et lâchent la défense ; Rh6 ? quitte le petit côté.',
    },
    {
      fen: 'r7/7k/4K3/4P3/8/8/8/3R4 b - - 0 1',
      prompt: 'Les Blancs ont placé leur tour en d1. À toi : quel coup tient la nulle ?',
      mode: 'engine',
      solution: ['h7g7'],
      tolerance: 5,
      traps: ['h7g8', 'a8a3', 'a8b8'],
      hints: [
        'Le plan reste le même : roi sur le petit côté, tour au loin.',
        'N’avance pas la tour, qui est bien à sa place en a8.',
        'Rg7.',
      ],
      explanation:
        'Rg7 ! conserve l’organisation. Rg8 ?, Ta3 ? et Tb8 ? ne tiennent plus : le roi blanc trouve une entrée.',
    },
    {
      fen: '6r1/7k/4K3/4P3/8/8/8/4R3 b - - 0 1',
      prompt: 'Ta tour est en g8, du côté du roi. Où doit-elle aller ?',
      mode: 'engine',
      solution: ['g8a8'],
      tolerance: 8,
      traps: ['g8h8'],
      hints: [
        'Une tour du côté de son roi le gêne. Il faut la mettre sur l’autre côté.',
        'Le grand côté du pion e est à gauche, du côté de la colonne a.',
        'Ta8 (Tb8 ou Tc8 conviennent aussi).',
      ],
      explanation:
        'Ta8 ! met la tour sur le grand côté, d’où elle donnera des échecs de loin. Th8 ? l’empile derrière son roi : le roi ' +
        'blanc entre par l’autre côté.',
    },
  ],
};

const COUPER_ROI: Lesson = {
  id: 'fin-couper-roi',
  phase: 3,
  title: 'Couper le roi adverse',
  summary:
    'Une tour qui coupe le roi adverse sur une colonne ou une rangée le laisse hors de la partie : ton pion court seul.',
  minutes: 20,
  sections: [
    {
      kind: 'text',
      body:
        'Dans une finale de tours, ton pion passé est stoppé par une seule chose : le roi adverse. **Question : et si ta ' +
        'tour lui interdisait de traverser une colonne ?** Il resterait coupé de ton pion. La tour qui coupe est placée ' +
        '**loin du roi adverse**, pour ne pas être attaquée, sur une colonne (ou une rangée) voisine de lui. Ton roi et ton ' +
        'pion avancent ensuite de l’autre côté.\n\n' +
        'Le défenseur raisonne à l’envers : il doit **traverser la colonne avant que la tour n’y arrive**.',
    },
    {
      kind: 'example',
      fen: '8/5k2/8/1K6/P7/8/7r/3R4 w - - 0 1',
      caption:
        'Le roi noir est en f7, à trois colonnes du pion a4. Re1 ! lui interdit la colonne e : il ne peut plus s’approcher, ' +
        'et le pion avance avec l’aide du roi blanc. Tous les autres coups laissent nulle.',
      arrows: [['d1', 'e1']],
      marks: ['e8', 'e7', 'e6'],
    },
    {
      kind: 'text',
      title: 'Les trois idées',
      body:
        '1. **Coupe loin** : la tour au bout de la colonne (e1), pas à côté du roi adverse.\n' +
        '2. **Avance ensuite** : le roi et le pion marchent, la tour garde la coupure.\n' +
        '3. **Défends en traversant** : si c’est toi qui défends, vas vite sur la colonne coupée, avant que la tour n’y soit.',
    },
    {
      kind: 'walkthrough',
      title: 'La tour garde la coupure',
      fen: '8/5k2/8/1K6/P7/8/7r/3R4 w - - 0 1',
      moves: [
        { uci: 'd1e1', comment: 'La coupure ! Le roi noir ne peut plus franchir la colonne e.' },
        {
          uci: 'h2b2',
          comment: 'Les Noirs donnent échec sur la colonne b : c’est leur seul espoir.',
        },
        { uci: 'b5c5', comment: 'Le roi blanc quitte la colonne b, et se rapproche du centre.' },
        { uci: 'b2c2', comment: 'Un nouvel échec, cette fois sur la colonne c.' },
        { uci: 'c5b4', comment: 'Le roi blanc revient vers le pion.' },
        { uci: 'c2b2', comment: 'Les Noirs donnent échec sur la colonne b.' },
        { uci: 'b4a3', comment: 'Le roi blanc attaque la tour b2 : les échecs prennent fin.' },
        { uci: 'b2f2', comment: 'La tour noire quitte la colonne b.' },
        {
          uci: 'e1e4',
          comment:
            'La tour blanche protège le pion a4 par la rangée, sans lâcher la coupure : le roi noir reste de l’autre côté.',
        },
        { uci: 'f2g2', comment: 'Les Noirs cherchent un nouvel échec.' },
        {
          uci: 'a4a5',
          comment: 'Le pion avance, protégé par la tour e4 et par le roi qui revient.',
        },
        { uci: 'g2g6', comment: 'La tour noire surveille la 6e rangée.' },
        { uci: 'a3b4', comment: 'Le roi blanc soutient le pion.' },
        { uci: 'f7f6', comment: 'Le roi noir avance, mais il est toujours coupé de la colonne a.' },
      ],
    },
  ],
  exercises: [
    {
      fen: '8/5k2/8/1K6/P7/8/7r/4R3 b - - 0 1',
      prompt:
        'Les Blancs viennent de jouer Te1. Désigne les cases voisines du roi f7 que la tour interdit.',
      mode: 'squares',
      solution: [],
      squares: ['e8', 'e7', 'e6'],
      hints: [
        'Regarde sur quelle colonne se trouve la tour blanche.',
        'La tour e1 contrôle toute la colonne e.',
        'e6, e7 et e8.',
      ],
      explanation:
        'Les cases e6, e7 et e8, voisines du roi, sont sur la colonne e que la tour contrôle. Le roi noir est coupé : il ne peut ' +
        'plus revenir vers le pion.',
    },
    {
      fen: '8/5k2/8/1K6/P7/8/7r/3R4 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent. Comment fais-tu avancer le pion ?',
      mode: 'engine',
      solution: ['d1e1'],
      tolerance: 10,
      traps: ['a4a5', 'b5b4', 'd1d7', 'd1f1'],
      hints: [
        'Avant de pousser le pion, empêche le roi noir de s’en approcher.',
        'La tour peut lui couper une colonne, depuis le bas de l’échiquier.',
        'Te1 !',
      ],
      explanation:
        'Te1 ! coupe le roi noir sur la colonne e. a5 ? ou Rb4 ? laissent le roi noir revenir ; Td7+ ? et Tf1 ? gâchent la ' +
        'coupure : c’est nulle.',
    },
    {
      fen: '8/5k2/8/1K6/P7/8/3R4/7r w - - 0 1',
      prompt:
        'La tour noire est en h1, derrière ton pion à la 1re rangée. Où coupes-tu le roi noir ?',
      mode: 'engine',
      solution: ['d2e2'],
      tolerance: 10,
      traps: ['d2b2', 'a4a5', 'd2d7'],
      hints: [
        'La colonne qui sépare le roi noir du pion est la même.',
        'La tour doit se placer en bas de la colonne, loin du roi noir.',
        'Te2 !',
      ],
      explanation:
        'Te2 ! coupe la colonne e. Tb2 ?, a5 ? et Td7+ ? permettent au roi noir de traverser ou de gagner du temps, et la finale est nulle.',
    },
    {
      fen: '8/5k2/8/1K6/P7/8/7r/3R4 b - - 0 1',
      prompt:
        'Cette fois, tu défends : c’est aux Noirs de jouer. Que fais-tu avant que la tour ne coupe ?',
      mode: 'engine',
      solution: ['f7e6'],
      tolerance: 10,
      traps: ['f7g6', 'f7g7', 'f7f6'],
      hints: [
        'La tour blanche veut aller en e1. Peux-tu l’en empêcher ?',
        'Il faut traverser la colonne e avant elle.',
        'Re6 (Re7 convient aussi).',
      ],
      explanation:
        'Re6 ! traverse la colonne e avant la coupure : le roi noir se rapproche du pion. Rg6 ?, Rg7 ? et Rf6 ? restent à ' +
        'droite : après Te1 le roi est coupé et les Blancs gagnent.',
    },
    {
      fen: '8/5k2/8/1K6/P7/8/1r6/4R3 w - - 0 1',
      prompt:
        'Les Noirs viennent de donner échec depuis b2. La coupure tient : où va ton roi pour échapper aux échecs ?',
      mode: 'choice',
      solution: ['b5c5'],
      accepted: ['b5c5', 'b5a6', 'b5a5', 'b5c6'],
      hints: [
        'Ta tour e1 garde la coupure : le roi peut bouger librement.',
        'Quitte la colonne b, en restant près de ton pion.',
        'Rc5, Ra6, Ra5 ou Rc6 gagnent tous.',
      ],
      explanation:
        'Tant que la tour e1 coupe le roi noir, plusieurs coups de roi gagnent. L’essentiel est de quitter la colonne b et ' +
        'de retourner vers le pion, pour l’escorter.',
    },
  ],
};

const TOURS_DEUX_COTES: Lesson = {
  id: 'fin-tours-deux-cotes',
  phase: 3,
  title: 'Tours et pions des deux côtés : l’activité de la tour',
  summary:
    'Une tour active vaut mieux qu’un pion : prends la colonne ouverte, entre en 7e rangée, ne reste pas passif.',
  minutes: 20,
  sections: [
    {
      kind: 'text',
      body:
        'Tour contre tour, avec des pions sur les deux ailes : c’est la finale la plus fréquente. **Question : qu’est-ce ' +
        'qui compte le plus, un pion de plus ou une tour bien placée ?** La plupart du temps, la tour. Une tour passive, ' +
        'collée à ses pions, ne contrôle rien ; une tour active attaque les pions et enferme le roi.\n\n' +
        'Quatre habitudes :\n' +
        '1. **Prends la colonne ouverte** avant l’adversaire.\n' +
        '2. **Entre en 7e rangée** (pour les Noirs, la 2e) : la tour y attaque les pions de loin.\n' +
        '3. **Coupe le roi adverse** en même temps, si possible.\n' +
        '4. **Sacrifie un pion** plutôt que de te laisser enfermer en défense passive.',
    },
    {
      kind: 'example',
      fen: '5r2/pp2kppp/8/8/8/8/PPR2PPP/6K1 w - - 0 1',
      caption:
        'La tour blanche est sur la colonne c ouverte, la tour noire est repliée derrière ses pions. Tc7+ ! entre en 7e ' +
        'rangée avec échec : la tour attaque b7 et f7 en même temps.',
      arrows: [['c2', 'c7']],
      marks: ['c7', 'b7'],
    },
    {
      kind: 'walkthrough',
      title: 'Entrer en 7e rangée',
      fen: '5r2/pp2kppp/8/8/8/8/PPR2PPP/6K1 w - - 0 1',
      moves: [
        {
          uci: 'c2c7',
          comment: 'La tour entre en 7e rangée avec échec : elle attaque b7 et f7 à la fois.',
        },
        { uci: 'e7e6', comment: 'Le roi noir s’écarte et défend f7 en se rapprochant du centre.' },
        { uci: 'c7b7', comment: 'La tour prend un pion : la 7e rangée rapporte déjà du matériel.' },
        { uci: 'f8d8', comment: 'La tour noire prend enfin une colonne, mais trop tard.' },
        {
          uci: 'g2g3',
          comment: 'Un coup de pion pour donner de l’air au roi blanc, évitant le mat du couloir.',
        },
        {
          uci: 'd8d2',
          comment:
            'La tour noire entre en 2e rangée : à son tour d’attaquer, mais les Blancs ont un pion de plus.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: 'r7/pp2kppp/8/8/8/8/PPR2PPP/6K1 w - - 0 1',
      prompt: 'Désigne la tour la plus active : celle qui contrôle une colonne ouverte.',
      mode: 'squares',
      solution: [],
      squares: ['c2'],
      hints: [
        'Une colonne est ouverte quand aucun pion ne s’y trouve.',
        'Regarde les colonnes où il n’y a plus de pion.',
        'La tour blanche c2, sur la colonne c.',
      ],
      explanation:
        'La colonne c n’a plus de pion : la tour c2 y est active. La tour noire a8, derrière ses pions, ne contrôle rien.',
    },
    {
      fen: '5r2/pp2kppp/8/8/8/8/PPR2PPP/6K1 w - - 0 1',
      prompt: 'Les Blancs jouent. Quel coup exploite la colonne ouverte ?',
      mode: 'engine',
      solution: ['c2c7'],
      tolerance: 5,
      traps: ['g1f1', 'c2c3', 'g2g4'],
      hints: [
        'Ta tour peut aller plus loin sur la colonne c.',
        'Quelle rangée est riche en cibles pour une tour ?',
        'Tc7+ !',
      ],
      explanation:
        'Tc7+ ! attaque b7 et f7 avec échec. Rf1 ?, Tc3 ? et g4 ? laissent les Noirs organiser leur défense.',
    },
    {
      fen: '4r3/pp2kppp/8/8/8/8/PPR2PPP/5K2 w - - 0 1',
      prompt: 'Les Blancs jouent. Quel est le coup actif ?',
      mode: 'engine',
      solution: ['c2c7'],
      tolerance: 5,
      traps: ['c2d2', 'f1e2', 'g2g4'],
      hints: [
        'Ta tour est active sur la colonne c : quelle case de cette colonne mène à des pions adverses ?',
        'La 7e rangée.',
        'Tc7+.',
      ],
      explanation:
        'Tc7+ ! gagne un pion en 7e rangée. Td2 ?, Re2 ? et g4 ? sont passifs : les Noirs reprennent la colonne c.',
    },
    {
      fen: 'r7/pp2kppp/8/8/8/2R5/PP3PPP/6K1 w - - 0 1',
      prompt: 'Même idée, tour en c3. Que joues-tu ?',
      mode: 'engine',
      solution: ['c3c7'],
      tolerance: 5,
      traps: ['g1f1', 'c3b3', 'g2g4'],
      hints: [
        'La colonne c est ouverte : où conduit-elle ?',
        'Tu peux entrer avec échec.',
        'Tc7+.',
      ],
      explanation:
        'Tc7+ ! L’activité compte plus que de garder la tour derrière les pions. Rf1 ?, Tb3 ? et g4 ? sont passifs.',
    },
    {
      fen: '6k1/ppr2ppp/8/8/8/8/PP2KPPP/5R2 b - - 0 1',
      prompt: 'Les Noirs jouent : même idée, avec les couleurs inversées. Quel est le coup actif ?',
      mode: 'engine',
      solution: ['c7c2'],
      tolerance: 5,
      traps: ['g8f8', 'c7c6', 'g7g5'],
      hints: [
        'Les pions blancs sont sur la 2e rangée : ta tour peut y entrer.',
        'L’échec est possible sur la rangée.',
        'Tc2+ !',
      ],
      explanation:
        'Tc2+ ! entre en 2e rangée avec échec et attaque b2 et f2. Rf8 ?, Tc6 ? et g5 ? sont passifs.',
    },
    {
      fen: '5r2/ppR2ppp/4k3/8/8/8/PP3PPP/6K1 w - - 0 1',
      prompt: 'La tour blanche est entrée en c7. Désigne les pions noirs qu’elle attaque.',
      mode: 'squares',
      solution: [],
      squares: ['b7', 'f7'],
      hints: [
        'La tour attaque sur la rangée, de part et d’autre.',
        'Elle voit la case b7 à gauche, et la rangée vers la droite.',
        'b7 et f7 (a7 est cachée derrière b7).',
      ],
      explanation:
        'La tour c7 attaque b7 (à gauche) et f7 (à droite). b7 n’est pas protégé : Txb7 gagne un pion, tandis que f7 est ' +
        'protégé par le roi et par la tour noire.',
    },
  ],
};

const FOU_CAVALIER: Lesson = {
  id: 'fin-fou-cavalier',
  phase: 3,
  title: 'Fou contre cavalier',
  summary:
    'Le fou domine quand les pions sont sur les deux ailes, le cavalier quand la position est fermée : à toi de choisir la structure.',
  minutes: 18,
  sections: [
    {
      kind: 'text',
      body:
        'Fou et cavalier valent trois pions chacun, mais ils ne se comportent pas pareil. **Question : qu’est-ce qui ' +
        'change leur valeur ?** La structure de pions.\n\n' +
        '1. **Le fou** voit loin : il est meilleur quand les pions sont sur **les deux ailes** et que la position est ' +
        'ouverte. Il attaque une aile pendant que le cavalier défend l’autre.\n' +
        '2. **Le cavalier** saute : il est meilleur dans une position **fermée**, avec des pions bloqués, ou avec des cases ' +
        'fortes (des postes avancés) où aucun pion ne peut le chasser.\n' +
        '3. **Un fou ne change jamais de couleur de case** ; le cavalier en change à chaque coup. Le fou ne voit jamais les ' +
        'pions placés sur l’autre couleur.',
    },
    {
      kind: 'example',
      fen: '6k1/p4pp1/3n3p/8/3B4/7P/PP3PP1/6K1 w - - 0 1',
      caption:
        'Le fou d4 attaque a7 et g7 en même temps, à deux ailes opposées. Le cavalier d6 ne protège ni l’un ni l’autre : ' +
        'c’est la force du fou. Bxa7 gagne un pion, alors que Bxg7 serait pris par le roi.',
      arrows: [
        ['d4', 'a7'],
        ['d4', 'g7'],
      ],
      marks: ['a7', 'g7'],
    },
    {
      kind: 'text',
      title: 'Que faire dans chaque cas ?',
      body:
        '**Tu as le fou** : ouvre la position, change les pions de couleur (place-les sur la couleur **opposée** à ton fou : ' +
        'ils ne le gênent plus), crée un pion passé loin, que le cavalier ne rattrape pas.\n\n' +
        '**Tu as le cavalier** : ferme la position, installe-le sur une case forte protégée par un pion, et mets les pions ' +
        'adverses sur la couleur de leur fou : il devient un fou « mauvais ».',
    },
    {
      kind: 'walkthrough',
      title: 'Le fou attaque deux ailes',
      fen: '6k1/p4pp1/3n3p/8/3B4/7P/PP3PP1/6K1 w - - 0 1',
      moves: [
        {
          uci: 'd4a7',
          comment:
            'Le fou prend le pion a7 : le cavalier ne le défendait pas. C’est l’avantage d’un fou, qui agit sur l’aile dame comme sur l’aile roi.',
        },
        { uci: 'd6c4', comment: 'Le cavalier cherche du contre-jeu contre b2.' },
        {
          uci: 'a7d4',
          comment: 'Le fou revient au centre : il garde les deux ailes, et protège b2.',
        },
        {
          uci: 'f7f6',
          comment:
            'Les Noirs renforcent leurs pions. Les Blancs ont un pion de plus et la pièce la mieux placée.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: '6k1/p1p2p1p/1p6/8/8/3B4/PP3PPP/6K1 w - - 0 1',
      prompt:
        'Ton fou est en d3. Désigne les pions noirs que ton fou pourra attaquer un jour (ceux qui sont sur des cases claires).',
      mode: 'squares',
      solution: [],
      squares: ['f7', 'h7'],
      hints: [
        'd3 est une case claire : le fou ne quittera jamais les cases claires.',
        'Cherche les pions sur des cases de la même couleur que d3 (a1 est sombre, b1 claire…).',
        'f7 et h7.',
      ],
      explanation:
        'f7 et h7 sont sur des cases claires, comme d3 : le fou peut les attaquer. Les pions a7, b6 et c7, sur des cases sombres, ' +
        'resteront hors de sa portée.',
    },
    {
      fen: '8/8/8/8/3N4/8/8/K6k w - - 0 1',
      prompt: 'Le cavalier est en d4, une case sombre. Désigne les cases où il peut aller.',
      mode: 'squares',
      solution: [],
      squares: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'],
      hints: [
        'Le cavalier saute de deux cases dans une direction et d’une case sur le côté.',
        'Il change de couleur à chaque coup : il ira sur des cases claires.',
        'b3, b5, c2, c6, e2, e6, f3 et f5.',
      ],
      explanation:
        'Du centre, le cavalier a huit cases, toutes claires, alors qu’il est sur une case sombre : c’est la grande différence ' +
        'avec le fou, qui ne change jamais de couleur.',
    },
    {
      fen: '6k1/pp3ppp/8/8/8/2P1P3/PP1B1PPP/6K1 w - - 0 1',
      prompt:
        'Ton fou est en d2, sur une case sombre. Désigne les pions blancs qui sont sur des cases sombres.',
      mode: 'squares',
      solution: [],
      squares: ['b2', 'c3', 'e3', 'f2', 'h2'],
      hints: [
        'Compte les pions qui sont sur la même couleur que le fou.',
        'a1 est sombre, a2 est claire, b2 est sombre…',
        'b2, c3, e3, f2 et h2.',
      ],
      explanation:
        'Cinq pions sont sur des cases sombres : ils gênent le fou d2, qui est « mauvais ». Mieux vaut placer les pions sur les ' +
        'cases claires, ou échanger ce fou.',
    },
    {
      fen: '6k1/p4pp1/3n3p/8/3B4/7P/PP3PP1/6K1 w - - 0 1',
      prompt: 'Les Blancs jouent. Exploite la portée du fou.',
      mode: 'engine',
      solution: ['d4a7'],
      tolerance: 5,
      traps: ['d4g7', 'h3h4', 'b2b3'],
      hints: [
        'Le fou attaque deux pions à la fois. Un seul est sans protection.',
        'Le pion g7 est protégé par le roi.',
        'Fxa7.',
      ],
      explanation:
        'Fxa7 ! gagne un pion : le cavalier d6 ne le protège pas. Fxg7 ? perd le fou (Rxg7), et les coups de pion tranquilles ' +
        'laissent le cavalier venir défendre.',
    },
    {
      fen: '6k1/p4pp1/3n3p/8/3B4/7P/PP3PP1/6K1 b - - 0 1',
      prompt: 'Cette fois, les Noirs jouent. Comment le cavalier aide-t-il son camp ?',
      mode: 'engine',
      solution: ['d6b5'],
      tolerance: 5,
      traps: ['d6f5', 'd6b7', 'g8h7'],
      hints: [
        'Le fou attaque a7. Ton cavalier peut y aller, en gagnant du temps.',
        'Un saut attaque le fou en protégeant le pion.',
        'Cb5 !',
      ],
      explanation:
        'Cb5 ! protège a7 et attaque le fou. Cf5 ?, Cb7 ? et Rh7 ? laissent le fou prendre le pion ou n’attaquent rien.',
    },
  ],
};

const FORTERESSES: Lesson = {
  id: 'fin-forteresses',
  phase: 3,
  title: 'Reconnaître une forteresse',
  summary:
    'Savoir qu’une position est nulle même avec un fou de plus : le pion de tour et le fou de la mauvaise couleur, en miroir.',
  minutes: 18,
  sections: [
    {
      kind: 'text',
      body:
        'Une forteresse est une position où le camp le plus fort ne peut pas progresser. **Question : comment reconnaître ' +
        'une forteresse avant de s’y casser les dents ?** Trois signes :\n' +
        '1. le **roi défenseur** ne peut pas être chassé de sa case, ni mis en zugzwang ;\n' +
        '2. les **pièces adverses** n’ont aucune case d’entrée qui change le résultat ;\n' +
        '3. le **pat** guette l’attaquant.\n\n' +
        'La forteresse la plus connue : un fou et un pion de tour contre un roi, quand le fou n’est pas de la couleur de la case de ' +
        'promotion. Le pion de tour a peut se retrouver de l’autre côté du plateau : le raisonnement est le même, en miroir.',
    },
    {
      kind: 'example',
      fen: 'k7/8/1K6/P7/8/8/8/2B5 b - - 0 1',
      caption:
        'Le pion a5 promeut en a8, une case claire. Le fou c1 est sur une case sombre : il ne contrôlera jamais a8. Le roi ' +
        'noir, dans le coin, tient la nulle.',
      marks: ['a8', 'c1'],
    },
    {
      kind: 'walkthrough',
      title: 'Le pat dans le coin',
      fen: 'k7/8/2K5/P7/8/8/8/2B5 w - - 0 1',
      moves: [
        {
          uci: 'c6b6',
          comment: 'Le roi blanc prend a7 et b7. Le roi noir n’a plus qu’une case : b8.',
        },
        { uci: 'a8b8', comment: 'Seul coup.' },
        { uci: 'a5a6', comment: 'Le pion avance ; le roi noir peut retourner en a8.' },
        { uci: 'b8a8', comment: 'Le roi noir retourne dans le coin, la seule case sûre.' },
        {
          uci: 'c1e3',
          comment:
            'Un coup d’attente du fou : il ne peut pas attaquer a8, case claire. Le roi noir a encore b8.',
        },
        { uci: 'a8b8', comment: 'Seul coup : le roi noir revient en b8.' },
        {
          uci: 'a6a7',
          comment: 'Échec du pion. Le roi noir doit retourner en a8 : Rc8 ? perdrait.',
        },
        { uci: 'b8a8', comment: 'Seul coup, et le bon : la dame blanche ne naît jamais.' },
        {
          uci: 'e3c5',
          comment:
            'Quel que soit le coup du fou, le roi noir n’a plus de case et n’est pas en échec : pat. Les Blancs ne peuvent ' +
            'pas éviter la nulle.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: 'k7/8/1K6/P7/8/8/8/2B5 b - - 0 1',
      prompt: 'Les Noirs jouent. Dans quel coin ton roi tient-il la nulle ? Clique sur la case.',
      mode: 'squares',
      solution: [],
      squares: ['a8'],
      hints: [
        'C’est la case de promotion du pion.',
        'Le pion a promeut sur la colonne a, en haut de l’échiquier.',
        'a8.',
      ],
      explanation:
        'Ra8 : le roi noir reste dans le coin que le fou ne contrôle jamais. Les Blancs ne peuvent ni le mater ni le déloger.',
    },
    {
      fen: '1k6/P7/1K6/8/8/8/8/2B5 b - - 0 1',
      prompt: 'Le pion vient d’avancer en a7, avec échec. Où va ton roi ?',
      mode: 'choice',
      solution: ['b8a8'],
      accepted: ['b8a8'],
      hints: [
        'Une promotion en a8 est-elle possible si ton roi y est ?',
        'La case a8 doit rester occupée par ton roi.',
        'Ra8.',
      ],
      explanation:
        'Ra8 est le seul coup : Rc8 ? permet a8=D+, et le fou n’a pas besoin d’attaquer a8 puisque la dame promeut. Avec le roi en a8, les ' +
        'Blancs ne peuvent pas progresser.',
    },
    {
      fen: 'k7/P7/1K6/8/8/8/8/2B5 b - - 0 1',
      prompt:
        'Le roi noir n’a aucune case et n’est pas en échec. Désigne les cases voisines qui lui sont interdites.',
      mode: 'squares',
      solution: [],
      squares: ['b8', 'b7', 'a7'],
      hints: [
        'Le roi noir est en a8 : regarde ses trois voisines.',
        'b8 est attaquée par le pion a7, b7 par le roi b6.',
        'b8, b7 et a7 (le pion a7 est protégé par le roi).',
      ],
      explanation:
        'b8 est prise par le pion, b7 par le roi, et a7 est occupée par un pion protégé : c’est pat, donc nulle.',
    },
    {
      fen: '7k/8/6K1/7P/8/8/8/1BBBB3 w - - 0 1',
      prompt: 'Le pion h promeut en h8. Désigne les fous de la mauvaise couleur (cases claires).',
      mode: 'squares',
      solution: [],
      squares: ['b1', 'd1'],
      hints: [
        'Quelle est la couleur de h8 ?',
        'h8 est une case sombre : les mauvais fous sont sur des cases claires.',
        'Les fous b1 et d1.',
      ],
      explanation:
        'h8 est sombre : les fous de cases claires (b1, d1) ne gagnent pas avec ce pion, alors que c1 et e1 le feraient.',
    },
    {
      fen: 'k7/8/1K6/P7/8/8/8/BBBB4 w - - 0 1',
      prompt: 'Et pour le pion a, qui promeut en a8 ? Désigne les fous de la mauvaise couleur.',
      mode: 'squares',
      solution: [],
      squares: ['a1', 'c1'],
      hints: [
        'Quelle est la couleur de a8 ?',
        'a8 est une case claire : les mauvais fous sont sur des cases sombres.',
        'Les fous a1 et c1.',
      ],
      explanation:
        'a8 est claire : les fous de cases sombres (a1, c1) ne contrôleront jamais la case de promotion. Le coin change avec le ' +
        'côté du pion.',
    },
  ],
};

export const ENDGAMES_COURSE_3: Lesson[] = [
  VANCURA,
  PETIT_COTE,
  COUPER_ROI,
  FOUS_OPPOSES,
  FOU_CAVALIER,
  FORTERESSES,
  TOURS_DEUX_COTES,
];
