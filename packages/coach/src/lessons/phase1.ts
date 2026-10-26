import type { Lesson } from './types.js';

/*
 * Phase 1 du plan : « ne plus rien donner ». Dix leçons courtes : la routine anti-gaffe, les
 * pièces en prise, les motifs tactiques de base, les mats de base, les principes d'ouverture.
 */

export const PHASE_1: Lesson[] = [
  {
    id: 'routine',
    phase: 1,
    title: 'La routine anti-gaffe : échecs, prises, menaces',
    summary: 'Avant chaque coup, trois questions qui évitent la plupart des gaffes.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'À ton niveau, la plupart des parties se décident sur une pièce laissée en prise ou une menace non vue. ' +
          'La parade est une habitude : **avant chaque coup**, et surtout avant de jouer celui qui te tente, ' +
          'pose-toi trois questions, d’abord pour l’adversaire, puis pour toi.',
      },
      {
        kind: 'text',
        title: 'Les trois questions',
        body:
          '1. **Échecs** : quels échecs l’adversaire peut-il donner après mon coup ? Et moi ?\n' +
          '2. **Prises** : quelles pièces peuvent être prises ? Sont-elles défendues ?\n' +
          '3. **Menaces** : que veut faire l’adversaire avec son dernier coup ? Qu’est-ce que je menace ?',
      },
      {
        kind: 'example',
        fen: '2b3k1/5ppp/8/3n4/8/8/5PPP/3R2K1 w - - 0 1',
        caption:
          'Question « prises » : le cavalier d5 n’est défendu par rien. Il suffit de le prendre.',
        arrows: [['d1', 'd5']],
      },
      {
        kind: 'walkthrough',
        title: 'La routine en action : le mat du berger',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          { uci: 'e2e4', comment: 'Un coup central normal.' },
          { uci: 'e7e5', comment: 'Les Noirs répondent de la même façon.' },
          {
            uci: 'd1h5',
            comment:
              'Dernier coup adverse : la dame sort tôt. **Question 3 — menace ?** Elle vise e5 et surtout f7, en coopération avec le fou.',
          },
          { uci: 'b8c6', comment: 'Les Noirs défendent e5 mais n’ont pas regardé f7.' },
          {
            uci: 'f1c4',
            comment:
              'Le fou et la dame visent f7, défendu par le seul roi. **Question 2 — prises ?** Une prise en f7 avec échec serait mortelle.',
          },
          {
            uci: 'g8f6',
            comment:
              'La gaffe : les Noirs attaquent la dame au lieu de parer la menace. Ils ont sauté la routine.',
          },
          {
            uci: 'h5f7',
            comment:
              'Qxf7 est mat : le roi n’a aucune case et le fou protège la dame. **Question 1 — échecs ?** Les Noirs devaient se demander ce que Blancs pouvaient donner comme échec.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Le dernier coup adverse',
        body:
          'Le réflexe le plus rentable : regarder **ce que le dernier coup adverse attaque**. Une pièce qui avance ' +
          'vise souvent une de tes pièces, ou prépare un mat. Parer une menace passe avant tes propres projets.',
      },
    ],
    exercises: [
      {
        fen: '2b3k1/5ppp/8/3n4/8/8/5PPP/3R2K1 w - - 0 1',
        prompt: 'Prises : une pièce noire est offerte. Prends-la.',
        mode: 'exact',
        solution: ['d1d5'],
        explanation: 'Le cavalier d5 n’avait aucun défenseur : la tour le prend gratuitement.',
      },
      {
        fen: '6k1/5ppp/8/8/1b6/P1N5/5PPP/6K1 w - - 0 1',
        prompt: 'Le fou noir attaque ton cavalier. Quelle est la meilleure réponse ?',
        mode: 'exact',
        solution: ['a3b4'],
        explanation:
          'Avant de fuir, regarde si tu peux prendre l’attaquant : le pion a3 prend le fou, qui n’était pas défendu.',
      },
      {
        fen: '3r2k1/5ppp/8/8/8/1B6/5PPP/6K1 w - - 0 1',
        prompt: 'Menaces : que veut faire la tour noire ? Joue un coup qui pare la menace.',
        mode: 'engine',
        solution: ['h2h3'],
        tolerance: 10,
        traps: ['b3f7'],
        explanation:
          'La tour menace Td1, mat du couloir. Un pion du roque (h3, g3…) donne une case de fuite au roi. ' +
          'Fxf7+ ne change rien : après Rxf7, la tour mate quand même en d1.',
      },
      {
        fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
        prompt:
          'Question « prises » : quelles pièces noires peuvent être prises sans qu’aucune ne les défende ? Désigne-les.',
        mode: 'squares',
        solution: [],
        squares: ['e5', 'h4'],
        hints: [
          'Compte les attaquants de chaque pièce noire : qui est attaqué par un cavalier blanc ?',
          'Une des deux pièces est la plus puissante des noires. L’autre est un pion.',
          'Le cavalier f3 attaque deux pièces noires à la fois.',
        ],
        explanation:
          'Le cavalier f3 attaque la dame h4 et le pion e5, tous deux sans défenseur. Cxh4 gagne la dame.',
      },
      {
        fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P1P1/5N2/PPPP1P1P/RNBQK2R b KQkq - 0 4',
        prompt:
          'Question « menaces » : quelles pièces blanches sont attaquées et sans défenseur ? Désigne-les.',
        mode: 'squares',
        solution: [],
        squares: ['e4', 'g4'],
        hints: [
          'Regarde ce que le cavalier f6 attaque.',
          'Deux pions blancs sont attaqués, et aucune pièce blanche ne les protège.',
          'Les deux pions sont sur la 4e rangée.',
        ],
        explanation:
          'Le cavalier f6 attaque e4 et g4, que rien ne défend. Le pion g4 était une avance imprudente.',
      },
      {
        fen: 'r1bqkb1r/pppp1ppp/5n2/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5',
        prompt: 'Une seule pièce noire est attaquée et sans défenseur. Laquelle ?',
        mode: 'squares',
        solution: [],
        squares: ['e5'],
        hints: [
          'Le cavalier d4 est attaqué, mais un pion le défend.',
          'Ton cavalier f3 attaque une pièce.',
          'C’est un pion du centre.',
        ],
        explanation:
          'Le pion e5 n’est défendu par aucune pièce : Cxe5 le gagne. Le cavalier d4, lui, est protégé par ce même pion.',
      },
    ],
  },
  {
    id: 'pieces-en-prise',
    phase: 1,
    title: 'Les pièces en prise : compter attaquants et défenseurs',
    summary: 'Savoir si une prise gagne ou perd du matériel, en comptant.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Une pièce est **en prise** quand elle est attaquée plus de fois qu’elle n’est défendue, ou quand elle est ' +
          'attaquée par une pièce de moindre valeur. Valeurs à connaître : pion 1, cavalier 3, fou 3, tour 5, dame 9.',
      },
      {
        kind: 'text',
        title: 'Compter',
        body:
          'Sur une case disputée, compte les **attaquants** et les **défenseurs**, puis imagine les prises une à une, ' +
          'en commençant par la pièce la moins précieuse. Si tu as plus d’attaquants, et que les échanges ne te font ' +
          'pas perdre une grosse pièce contre une petite, la prise gagne.',
      },
      {
        kind: 'walkthrough',
        title: 'Compter avant de prendre',
        fen: '6k1/5ppp/2n5/4n3/8/5N2/5PPP/4R1K1 w - - 0 1',
        moves: [
          {
            uci: 'f3e5',
            comment:
              'Le cavalier e5 est attaqué deux fois (Cf3 et Te1) et défendu une fois (Cc6). On commence par la pièce la moins précieuse : le cavalier.',
          },
          {
            uci: 'c6e5',
            comment: 'Les Noirs reprennent avec le cavalier c6 : e5 n’a plus de défenseur.',
          },
          {
            uci: 'e1e5',
            comment:
              'La tour reprend. Bilan : deux cavaliers pris contre un perdu, soit une pièce de gagnée.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: '6k1/3n1ppp/8/4n3/3P4/8/5PPP/4R1K1 w - - 0 1',
        prompt:
          'Le cavalier e5 est attaqué par le pion d4 et la tour e1, défendu par le cavalier d7. Gagne du matériel ' +
          'en commençant par la bonne pièce.',
        mode: 'exact',
        solution: ['d4e5', 'd7e5', 'e1e5'],
        hints: [
          'Compte les attaquants et les défenseurs du cavalier e5.',
          'Parmi tes attaquants, quelle pièce est la moins précieuse ? C’est elle qui prend en premier.',
          'Prends avec le pion d4, puis reprends avec la tour.',
        ],
        explanation:
          'dxe5 Cxe5 Txe5 : deux cavaliers (6) pour un pion (1). Commencer par Txe5 aurait rapporté bien moins ' +
          '(une tour pour deux cavaliers) : on prend d’abord avec la pièce la moins précieuse.',
      },
      {
        fen: '3q2k1/5ppp/4p3/3p4/8/2N5/5PPP/3Q2K1 w - - 0 1',
        prompt: 'Le pion d5 a l’air faible. Compte avant de le prendre, puis joue un coup sensé.',
        mode: 'engine',
        solution: ['g2g3'],
        tolerance: 10,
        traps: ['c3d5'],
        hints: [
          'Qui défend le pion d5 ?',
          'Si ton cavalier prend en d5, que peut répondre le pion e6 ?',
          'Une pièce prise par un pion coûte plus cher que le pion : choisis un coup tranquille, comme g3.',
        ],
        explanation:
          'd5 est défendu par le pion e6 : Cxd5 ?? exd5 donne un cavalier pour un pion. Une pièce défendue par un ' +
          'pion n’est presque jamais bonne à prendre avec une pièce.',
      },
      {
        fen: 'r5k1/5ppp/8/3b4/8/2N5/5PPP/3Q2K1 w - - 0 1',
        prompt: 'Le fou d5 est attaqué deux fois et défendu zéro fois. Gagne-le.',
        mode: 'choice',
        solution: ['c3d5'],
        accepted: ['c3d5', 'd1d5'],
        hints: [
          'Combien de pièces blanches attaquent le fou ? Combien de noires le défendent ?',
          'Une pièce sans aucun défenseur se prend avec n’importe quelle attaquante.',
          'Le cavalier c3 ou la dame d1 peuvent prendre.',
        ],
        explanation:
          'Une pièce sans défenseur attaquée par une pièce adverse se gagne : Cxd5 (ou Dxd5).',
      },
      {
        fen: 'r2qk2r/ppp2ppp/2n5/8/4n1b1/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 1',
        prompt: 'Désigne les pièces noires en prise : attaquées et sans aucun défenseur.',
        mode: 'squares',
        squares: ['e4', 'g4'],
        solution: [],
        hints: [
          'Passe en revue les pièces noires qui sont sorties : lesquelles sont attaquées ?',
          'Le cavalier c3 et la dame d1 attaquent chacun une pièce.',
          'Deux pièces noires avancées ne sont protégées par rien.',
        ],
        explanation:
          'Le cavalier e4 est attaqué par Cc3 et le fou g4 par la dame d1 (la diagonale d1-g4 est libre) ; ni l’un ni l’autre n’a de défenseur. Un joueur qui tient la routine voit ces deux cibles avant de jouer.',
      },
      {
        fen: 'r1bq1rk1/ppp2ppp/2nb4/4P3/8/5N2/PPP2PPP/R1BQ1RK1 w - - 0 1',
        prompt:
          'Ton pion e5 est attaqué deux fois et défendu zéro fois. Avant de le défendre, cherche mieux.',
        mode: 'exact',
        solution: ['e5d6'],
        hints: [
          'Que peut prendre ton pion e5 ?',
          'Une pièce de grande valeur est à sa portée.',
          'Le pion peut prendre le fou d6.',
        ],
        explanation:
          'exd6 : le pion, la pièce la moins précieuse, prend le fou. Après cxd6 ou Dxd6, les Blancs ont gagné une pièce contre un pion.',
      },
      {
        fen: 'r1bqk2r/ppp2ppp/2n2n2/3p4/8/2NBPN2/PPP2PPP/R1BQK2R w KQkq - 0 1',
        prompt: 'Le pion d5 est attaqué une fois et défendu deux fois. Joue un coup sensé.',
        mode: 'engine',
        solution: ['e1g1'],
        tolerance: 10,
        traps: ['c3d5'],
        hints: [
          'Compte les défenseurs du pion d5.',
          'Si tu prends avec le cavalier, comment les Noirs reprennent-ils ?',
          'Cxd5 coûterait un cavalier pour un pion : développe ou roque plutôt.',
        ],
        explanation:
          'd5 est défendu par le cavalier f6 et la dame : Cxd5 ? Cxd5 perd une pièce pour un pion. Le roque met le roi à l’abri et ne risque rien.',
      },
    ],
  },
  {
    id: 'attaque-double',
    phase: 1,
    title: 'L’attaque double',
    summary: 'Un coup, deux menaces : l’adversaire ne peut en parer qu’une.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Une **attaque double** crée deux menaces en un seul coup. L’adversaire ne peut en parer qu’une : tu exécutes ' +
          'l’autre. La dame, qui va dans toutes les directions, est la championne de l’attaque double ; les cibles ' +
          'idéales sont les pièces **non défendues** et le roi. La tour sait aussi le faire sur une rangée ou une colonne.',
      },
      {
        kind: 'walkthrough',
        title: 'Une attaque double en trois coups',
        fen: '6k1/5pp1/7p/8/n6b/8/5PPP/3R2K1 w - - 0 1',
        moves: [
          {
            uci: 'd1d4',
            comment: 'Td4 attaque d’un coup le cavalier a4 et le fou h4, tous deux sans défenseur.',
          },
          {
            uci: 'a4b6',
            comment:
              'Les Noirs sauvent le cavalier, mais ils ne peuvent pas parer les deux menaces.',
          },
          {
            uci: 'd4h4',
            comment:
              'Txh4 : le fou tombe. Une attaque double gagne une pièce quand l’adversaire n’en sauve qu’une.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Repérer les cibles',
        body:
          'Fais l’inventaire des pièces adverses **non défendues** : chacune est une cible. Dès que deux cibles sont ' +
          'alignées avec une case accessible à ta dame, cherche l’attaque double.',
      },
    ],
    exercises: [
      {
        fen: '6k1/5pp1/7p/8/n6b/8/5PPP/3R2K1 w - - 0 1',
        prompt: 'Deux pièces noires sont sans défense. Attaque-les en même temps.',
        mode: 'exact',
        solution: ['d1d4'],
        hints: [
          'Quelles pièces noires ne sont pas défendues ?',
          'Cherche une rangée où ta tour verrait deux de ces cibles à la fois.',
          'Les deux pièces sont sur la 4e rangée.',
        ],
        explanation: 'Td4 vise le cavalier a4 et le fou h4 : l’un des deux tombe au coup suivant.',
      },
      {
        fen: 'r5k1/6pp/8/8/8/8/5PPP/3Q2K1 w - - 0 1',
        prompt: 'Une attaque double avec échec : gagne la tour.',
        mode: 'exact',
        solution: ['d1d5', 'g8h8', 'd5a8'],
        hints: [
          'Quel coup de dame donne échec ?',
          'Une même diagonale mène de d5 au roi g8 et dans l’autre sens à la tour a8.',
          'Dd5+ : le roi doit bouger, la tour a8 tombe.',
        ],
        explanation:
          'Dd5+ attaque le roi (par la diagonale f7-g8) et la tour a8 : le roi doit bouger, puis Dxa8+.',
      },
      {
        fen: '2r3k1/pp1n1ppp/8/3p4/1b1P4/2N1B3/PP3PPP/R2Q1RK1 w - - 0 1',
        prompt:
          'Inventaire des cibles : désigne les pièces noires (sauf les pions) qui n’ont aucun défenseur.',
        mode: 'squares',
        squares: ['b4', 'c8', 'd7'],
        solution: [],
        hints: [
          'Pour chaque pièce noire, cherche une autre pièce ou un pion qui la protège.',
          'Un fou, une tour et un cavalier restent seuls.',
          'Regarde la rangée de la tour, la colonne d et le fou avancé.',
        ],
        explanation:
          'La tour c8, le cavalier d7 et le fou b4 ne sont protégés par rien : trois cibles. Une dame qui touche deux d’entre elles gagne du matériel (Da4 vise b4 et d7).',
      },
      {
        fen: 'r5k1/6pp/8/8/2n5/8/5PPP/3Q2K1 w - - 0 1',
        prompt: 'Une attaque double avec échec : trouve-la.',
        mode: 'engine',
        solution: ['d1d5'],
        tolerance: 5,
        traps: ['d1d8'],
        hints: [
          'Quelles pièces noires ne sont pas défendues ?',
          'Cherche une case d’où ta dame touche le roi ET une autre pièce.',
          'La diagonale d5-g8 est ouverte : et depuis d5, que voit-on d’autre ?',
        ],
        explanation:
          'Dd5+ attaque le roi g8, la tour a8 et le cavalier c4. Dd8+ ? attire l’attention mais Txd8 prend la dame : un échec n’est bon que s’il gagne quelque chose.',
      },
      {
        fen: '6k1/5ppp/8/2n1b3/8/8/5PPP/2R3K1 w - - 0 1',
        prompt:
          'Deux pièces noires sont sans défense. Quel coup en prend une tout en menaçant l’autre ?',
        mode: 'engine',
        solution: ['c1c5'],
        tolerance: 10,
        traps: ['c1e1'],
        hints: [
          'Compte les défenseurs du cavalier c5 et du fou e5.',
          'Une prise qui crée aussitôt une seconde menace vaut mieux qu’une prise tranquille.',
          'Après la prise, ta tour regarde aussi le long de la 5e rangée.',
        ],
        explanation:
          'Txc5 prend le cavalier et attaque aussitôt le fou e5 : les Noirs ne peuvent pas tout sauver. Te1 ? n’attaque que le fou, qui s’échappe.',
      },
      {
        fen: 'r3k2r/p4ppp/4n3/3Q4/8/8/PPP2PPP/R3K2R b KQkq - 0 1',
        prompt: 'La dame blanche vient d’arriver en d5. Désigne les pièces noires qu’elle attaque.',
        mode: 'squares',
        squares: ['a8', 'e6'],
        solution: [],
        hints: [
          'Dans quelles directions la dame voit-elle ?',
          'Regarde la diagonale qui mène vers a8 et celle qui touche e6.',
          'Une des deux pièces est une tour.',
        ],
        explanation:
          'La dame d5 attaque la tour a8 (la diagonale d5-a8 est libre) et le cavalier e6 (défendu, lui, par le pion f7). Deux cibles d’un coup : l’attaque double.',
      },
    ],
  },
  {
    id: 'fourchette',
    phase: 1,
    title: 'La fourchette',
    summary: 'Le cavalier, le pion et la dame attaquent deux pièces à la fois.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'La **fourchette** est une attaque double où une seule pièce attaque deux pièces adverses. La plus ' +
          'redoutable est celle du **cavalier**, qui saute et attaque des pièces qui ne peuvent pas le lui rendre. ' +
          'Avec un **échec**, elle est imparable : le roi doit bouger, l’autre pièce tombe.',
      },
      {
        kind: 'walkthrough',
        title: 'La fourchette royale',
        fen: 'r3k3/7p/8/1N6/8/8/8/4K3 w - - 0 1',
        moves: [
          { uci: 'b5c7', comment: 'Cc7+ : le cavalier attaque le roi e8 et la tour a8 à la fois.' },
          {
            uci: 'e8d7',
            comment:
              'Le roi doit bouger : en d7, il attaque même le cavalier, mais la tour a8 est perdue.',
          },
          {
            uci: 'c7a8',
            comment:
              'Cxa8 : le cavalier prend la tour. Un échec qui fourche une pièce gagne toujours la pièce.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Les cases de fourchette',
        body:
          'Le cavalier attaque les cases de l’autre couleur que la sienne, en « L ». Pour repérer une fourchette, ' +
          'cherche une case d’où il toucherait deux cibles (le roi, la dame, une tour, une pièce non défendue), et ' +
          'vérifie qu’il n’y sera pas pris aussitôt. Les **pions** font aussi d’excellentes fourchettes.',
      },
    ],
    exercises: [
      {
        fen: 'r3k3/7p/8/1N6/8/8/8/4K3 w - - 0 1',
        prompt: 'Fourchette royale : gagne la tour.',
        mode: 'exact',
        solution: ['b5c7', 'e8d7', 'c7a8'],
        hints: [
          'Cherche une case d’où le cavalier touche le roi e8 et la tour a8.',
          'Depuis b5, le cavalier peut aller en a3, a7, c3, c7, d4 ou d6.',
          'Une de ces cases attaque à la fois e8 et a8.',
        ],
        explanation: 'Cc7+ : le roi doit bouger, puis Cxa8.',
      },
      {
        fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1N3/5N2/PPPP1PPP/R1BQK2R b KQkq - 0 5',
        prompt:
          'Les Noirs jouent. Un pion peut attaquer deux pièces à la fois : trouve la fourchette.',
        mode: 'exact',
        solution: ['d7d5'],
        hints: [
          'Quels pions noirs peuvent avancer ? Que toucheraient-ils ?',
          'Un pion attaque en diagonale vers l’avant : regarde les cases c4 et e4.',
          '…d5 attaque le fou c4 et le cavalier e4 à la fois.',
        ],
        explanation:
          '…d5 attaque le fou c4 et le cavalier e4 : les Noirs récupèrent la pièce sacrifiée. C’est le « truc de la ' +
          'fourchette », fréquent dans les ouvertures ouvertes.',
      },
      {
        fen: '3q3k/6pp/8/4N3/8/8/5PPP/6K1 w - - 0 1',
        prompt: 'Fourchette royale : gagne la dame.',
        mode: 'exact',
        solution: ['e5f7', 'h8g8', 'f7d8'],
        hints: [
          'Quels coups du cavalier donnent échec ?',
          'Le roi h8 et la dame d8 ont une case de saut en commun.',
          'Le cavalier e5 peut aller en f7 : que touche-t-il depuis là ?',
        ],
        explanation: 'Cf7+ attaque le roi h8 et la dame d8 : après le coup du roi, Cxd8.',
      },
      {
        fen: 'r3k3/2N3p1/8/1p1p4/8/8/8/4K3 b - - 0 1',
        prompt: 'Le cavalier blanc vient de sauter en c7. Désigne les pièces noires qu’il attaque.',
        mode: 'squares',
        squares: ['a8', 'b5', 'd5', 'e8'],
        solution: [],
        hints: [
          'Un cavalier saute en « L » : compte ses huit cases depuis c7.',
          'Certaines cases sont vides, d’autres portent une pièce noire.',
          'Un roi, une tour et deux pions.',
        ],
        explanation:
          'Le cavalier c7 touche a8, e8, b5 et d5 : le roi, la tour et deux pions. Le roi est en échec, donc la tour a8 tombera ensuite : c’est la fourchette royale.',
      },
      {
        fen: '6k1/5ppp/8/8/3n4/8/5PPP/2Q3K1 b - - 0 1',
        prompt: 'Les Noirs jouent : fourchette sur le roi et la dame.',
        mode: 'exact',
        solution: ['d4e2', 'g1h1', 'e2c1'],
        hints: [
          'Où se trouvent la dame et le roi blancs, l’un par rapport à l’autre ?',
          'Quelle case est à un saut de cavalier de g1 comme de c1 ?',
          '…Ce2+ : le roi doit bouger, puis …Cxc1.',
        ],
        explanation:
          '…Ce2+ attaque le roi g1 et la dame c1. Le roi ne peut pas prendre le cavalier (il n’y touche pas) : après son coup, …Cxc1 gagne la dame.',
      },
      {
        fen: '2r1k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
        prompt: 'Fourchette sur le roi et la tour : trouve le bon saut.',
        mode: 'engine',
        solution: ['b5d6'],
        tolerance: 10,
        traps: ['b5c7'],
        hints: [
          'Quels sauts du cavalier donnent échec ?',
          'Le roi e8 et la tour c8 ont une case de saut en commun.',
          'Parmi d6 et c7, une seule attaque aussi la tour c8.',
        ],
        explanation:
          'Cd6+ attaque le roi e8 et la tour c8 : après le coup du roi, Cxc8. Cc7+ ? donne bien échec, mais n’attaque pas la tour : le roi prend le temps de venir attaquer le cavalier.',
      },
    ],
  },
  {
    id: 'clouage',
    phase: 1,
    title: 'Le clouage',
    summary: 'Une pièce qui ne peut pas bouger sans exposer plus précieux qu’elle.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Une pièce est **clouée** quand elle se trouve entre une pièce adverse à longue portée (fou, tour, dame) et ' +
          'une pièce plus précieuse de son camp. Clouée sur le **roi**, elle ne peut plus bouger du tout (clouage ' +
          'absolu). Clouée sur la dame, elle peut bouger, mais la dame tombe.',
      },
      {
        kind: 'walkthrough',
        title: 'Exploiter un clouage',
        fen: '4k3/1p3ppp/2n5/1B6/3P4/8/5PPP/6K1 w - - 0 1',
        moves: [
          {
            uci: 'd4d5',
            comment:
              'Le pion attaque le cavalier cloué : il ne peut pas fuir sans exposer le roi e8.',
          },
          {
            uci: 'e8d8',
            comment:
              'Les Noirs sortent le roi de la ligne pour libérer le cavalier, mais c’est trop tard.',
          },
          {
            uci: 'd5c6',
            comment:
              'dxc6 : le pion prend le cavalier. Un clouage se gagne souvent avec un simple pion.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Exploiter un clouage',
        body:
          'Une pièce clouée est une **cible immobile** : attaque-la encore, de préférence avec un **pion**. Elle ne ' +
          'peut ni fuir ni s’échanger sans perte.',
      },
    ],
    exercises: [
      {
        fen: '4k3/1p3ppp/2n5/1B6/3P4/8/5PPP/6K1 w - - 0 1',
        prompt: 'Le cavalier c6 est cloué. Gagne-le.',
        mode: 'exact',
        solution: ['d4d5'],
        hints: [
          'Que peut faire le cavalier c6 s’il est attaqué ?',
          'S’il bouge, que se passe-t-il pour le roi e8 ?',
          'Attaque-le avec un pion : d5.',
        ],
        explanation: 'd5 attaque le cavalier cloué : il ne peut pas fuir, il est perdu.',
      },
      {
        fen: '4k3/p6p/8/4q3/8/8/1P3KP1/R7 w - - 0 1',
        prompt: 'Cloue la dame noire sur son roi.',
        mode: 'exact',
        solution: ['a1e1'],
        hints: [
          'Quelle ligne relie ta tour, la dame noire et son roi ?',
          'La dame e5 et le roi e8 sont sur la même colonne.',
          'Place ta tour sur cette colonne : Te1.',
        ],
        explanation:
          'Te1 cloue la dame sur le roi e8 : elle ne peut que prendre la tour, et Rxe1 gagne la dame contre la tour.',
      },
      {
        fen: 'r2qk2r/ppp2ppp/2n1bn2/1B1p4/3P4/2N2N2/PPP2PPP/R1BQR1K1 w kq - 0 1',
        prompt:
          'Désigne les pièces noires clouées sur leur roi (clouage absolu : elles ne peuvent pas bouger).',
        mode: 'squares',
        squares: ['c6', 'e6'],
        solution: [],
        hints: [
          'Cherche tes pièces à longue portée (fou, tour, dame) qui visent le roi e8.',
          'Qu’y a-t-il entre chacune d’elles et le roi noir ?',
          'Un cavalier et un fou sont dans ce cas.',
        ],
        explanation:
          'Le cavalier c6 est cloué par le fou b5 sur le roi e8 ; le fou e6 est cloué par la tour e1 sur la même colonne. Le cavalier f6, lui, peut bouger librement.',
      },
      {
        fen: '4k3/4n3/8/3K4/8/8/4R3/8 w - - 0 1',
        prompt: 'Le cavalier e7 est cloué sur le roi. Gagne-le sans le laisser s’échapper.',
        mode: 'exact',
        solution: ['d5d6', 'e8f7', 'e2e7'],
        hints: [
          'Combien de défenseurs le cavalier e7 a-t-il ? Combien d’attaquants peux-tu amener ?',
          'Ton roi peut s’approcher pour joindre l’attaque.',
          'Rd6 : le roi attaque aussi e7.',
        ],
        explanation:
          'Rd6 ! Le cavalier est attaqué deux fois (tour et roi) et défendu une fois ; il est cloué, donc il ne peut pas fuir. Après le coup du roi noir, Txe7+ gagne la pièce (le roi ne peut pas reprendre : le roi d6 protège e7).',
      },
      {
        fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4',
        prompt: 'Cloue le cavalier f6 sur la dame d8.',
        mode: 'choice',
        solution: ['c1g5'],
        accepted: ['c1g5'],
        hints: [
          'Quelle diagonale va de ton fou c1 à la dame d8 ?',
          'Le cavalier f6 se trouve sur cette diagonale.',
          'Le fou se place en g5.',
        ],
        explanation:
          'Fg5 cloue le cavalier f6 sur la dame : s’il bouge, la dame est attaquée. C’est un clouage relatif (la dame peut céder), mais le cavalier ne défend plus ses cases.',
      },
      {
        fen: '4r1k1/ppp2ppp/2n2n2/3p4/1b1P4/2N2N2/PPP1BPPP/R1BQK2R w KQ - 0 1',
        prompt: 'Côté blanc : désigne les pièces blanches clouées sur ton roi.',
        mode: 'squares',
        squares: ['c3', 'e2'],
        solution: [],
        hints: [
          'Quelles pièces noires à longue portée visent ton roi e1 ?',
          'Il y en a deux : une sur une diagonale, une sur une colonne.',
          'Les pièces clouées sont entre ces attaquants et ton roi.',
        ],
        explanation:
          'Le cavalier c3 est cloué par le fou b4 (diagonale b4-e1) et le fou e2 par la tour e8 (colonne e). Penser au clouage, c’est aussi voir celui qu’on subit.',
      },
    ],
  },
  {
    id: 'enfilade',
    phase: 1,
    title: 'L’enfilade',
    summary: 'Le clouage à l’envers : la pièce précieuse devant, la victime derrière.',
    minutes: 10,
    sections: [
      {
        kind: 'text',
        body:
          'L’**enfilade** attaque une pièce précieuse (souvent le roi, par un échec) qui, en s’écartant, découvre une ' +
          'autre pièce placée derrière elle sur la même ligne. C’est l’inverse du clouage : la pièce la plus précieuse ' +
          'est devant.',
      },
      {
        kind: 'walkthrough',
        title: 'L’enfilade en trois coups',
        fen: '1r2k3/8/8/8/8/8/3K3R/8 b - - 0 1',
        moves: [
          {
            uci: 'b8b2',
            comment:
              'Tb2+ : échec le long de la 2e rangée. La tour h2 est derrière le roi, sur la même ligne.',
          },
          {
            uci: 'd2e3',
            comment: 'Le roi doit quitter la 2e rangée : il ne peut plus protéger la tour.',
          },
          {
            uci: 'b2h2',
            comment:
              'Txh2 : la tour est prise. C’est l’inverse du clouage : la pièce précieuse était devant.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: '1r2k3/8/8/8/8/8/3K3R/8 b - - 0 1',
        prompt: 'Les Noirs jouent : trouve l’enfilade.',
        mode: 'exact',
        solution: ['b8b2', 'd2e3', 'b2h2'],
        hints: [
          'Quelle rangée contient le roi blanc et la tour h2 ?',
          'Un échec le long de cette rangée oblige le roi à s’écarter.',
          'Donne échec depuis la colonne b : Tb2+.',
        ],
        explanation: 'Tb2+ met le roi en échec ; il s’écarte et Txh2 gagne la tour.',
      },
      {
        fen: 'q7/8/8/3k4/8/8/8/5BK1 w - - 0 1',
        prompt: 'Le roi et la dame noirs sont sur la même diagonale. Profites-en.',
        mode: 'exact',
        solution: ['f1g2', 'd5c5', 'g2a8'],
        hints: [
          'Quelle diagonale relie le roi d5 et la dame a8 ?',
          'Un échec qui force le roi à quitter cette diagonale laisse la dame sans protection.',
          'Fg2+ : le fou donne échec sur la grande diagonale.',
        ],
        explanation: 'Fg2+ : le roi quitte la grande diagonale et Fxa8 gagne la dame.',
      },
      {
        fen: '4k3/8/q7/3B4/8/4K2R/8/8 b - - 0 1',
        prompt: 'Les Noirs jouent. Le roi et la tour blancs sont sur la même rangée : enfile-les.',
        mode: 'exact',
        solution: ['a6a3', 'e3e4', 'a3h3'],
        hints: [
          'Quelle rangée contient le roi blanc et la tour h3 ?',
          'Ta dame a6 peut atteindre cette rangée avec échec.',
          'Da3+ : après le coup du roi, la tour h3 est à ta portée.',
        ],
        explanation:
          '…Da3+ : le roi quitte la 3e rangée et …Dxh3 prend la tour. …De6+ ? semblait aussi donner échec, mais le fou d5 la prend : il fallait choisir la case sûre.',
      },
      {
        fen: '4q3/8/8/8/4k3/8/8/R5K1 w - - 0 1',
        prompt: 'Le roi noir est devant sa dame, sur la colonne e. Profites-en.',
        mode: 'exact',
        solution: ['a1e1', 'e4d5', 'e1e8'],
        hints: [
          'Quelle colonne contient le roi noir et sa dame ?',
          'Ta tour doit donner échec sur cette colonne, depuis l’autre côté.',
          'Te1+ : le roi bouge, Txe8.',
        ],
        explanation:
          'Te1+ : le roi doit quitter la colonne e et la dame e8, restée en ligne, tombe : Txe8. Le roi était devant, la dame derrière : une enfilade.',
      },
      {
        fen: '7q/8/8/4k3/8/8/8/2B3K1 w - - 0 1',
        prompt:
          'Le roi et la dame noirs sont sur la même diagonale. Trouve l’échec qui gagne la dame.',
        mode: 'choice',
        solution: ['c1b2'],
        accepted: ['c1b2'],
        hints: [
          'Quelle diagonale relie le roi e5 à la dame h8 ?',
          'Ton fou doit donner échec sur cette diagonale.',
          'Fb2+ : le roi doit bouger, puis Fxh8.',
        ],
        explanation:
          'Fb2+ : le roi quitte la grande diagonale et Fxh8 prend la dame. C’est la même idée que la tour sur une colonne : le roi devant, la dame derrière.',
      },
      {
        fen: '8/r3k3/8/8/8/8/8/3K2R1 w - - 0 1',
        prompt: 'Les Blancs jouent : trouve l’enfilade.',
        mode: 'exact',
        solution: ['g1g7', 'e7f6', 'g7a7'],
        hints: [
          'Quelle rangée contient le roi noir et sa tour ?',
          'Un échec le long de cette rangée oblige le roi à s’écarter.',
          'Donne échec depuis la colonne g : Tg7+.',
        ],
        explanation:
          'Tg7+ : le roi quitte la 7e rangée et Txa7 gagne la tour, restée derrière lui.',
      },
    ],
  },
  {
    id: 'mat-du-couloir',
    phase: 1,
    title: 'Le mat du couloir',
    summary: 'Le roi enfermé derrière ses pions, mat par une tour ou une dame.',
    minutes: 10,
    sections: [
      {
        kind: 'text',
        body:
          'Un roi roqué derrière ses trois pions intacts n’a plus de case de fuite : une tour ou une dame qui arrive sur ' +
          'la dernière rangée le **mate**. Pense-y dans les deux sens : cherche-le chez l’adversaire, et donne une ' +
          '**case de fuite** (h3, g3…) à ton roi quand la dernière rangée devient dangereuse.',
      },
      {
        kind: 'example',
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        caption: 'Ta8# : le roi g8 est prisonnier de ses pions f7, g7, h7.',
        arrows: [['a1', 'a8']],
      },
      {
        kind: 'text',
        title: 'Éliminer les défenseurs',
        body:
          'Si une pièce défend la dernière rangée, on peut parfois l’**échanger** ou la **dévier** avant de mater : ' +
          'chaque prise avec échec retire un défenseur.',
      },
    ],
    exercises: [
      {
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        prompt: 'Mat en 1.',
        mode: 'exact',
        solution: ['a1a8'],
        hints: [
          'Quelles cases restent au roi g8 ?',
          'Ses trois pions l’enferment : seule la dernière rangée compte.',
          'Amène ta tour au bout de la colonne a.',
        ],
        explanation: 'Ta8# : le classique mat du couloir.',
      },
      {
        fen: '3qr1k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1',
        prompt: 'Mat en 2 : élimine d’abord un défenseur.',
        mode: 'exact',
        solution: ['e2e8', 'd8e8', 'e1e8'],
        hints: [
          'Combien de pièces noires défendent la 8e rangée ?',
          'Offre une tour pour éliminer le défenseur.',
          'Txe8+ : la dame doit reprendre, et ensuite ?',
        ],
        explanation:
          'Txe8+ Dxe8 Txe8# : la dame noire, seule défenseure, a été attirée puis prise.',
      },
      {
        fen: '3r2k1/5ppp/8/8/8/1B6/5PPP/6K1 w - - 0 1',
        prompt: 'C’est l’adversaire qui menace le mat du couloir. Mets ton roi à l’abri.',
        mode: 'engine',
        solution: ['g2g3'],
        tolerance: 10,
        traps: ['b3f7'],
        hints: [
          'Que menace la tour d8 ? Que se passe-t-il après …Td1+ ?',
          'Ton roi n’a aucune case de fuite derrière ses pions.',
          'Un seul coup de pion (g3, h3 ou h4) lui en donne une.',
        ],
        explanation:
          'Une case de fuite (h3, g3, h4…) suffit : la tour ne mate plus en d1. Ne perds pas de temps avec Fxf7+.',
      },
      {
        fen: '3r2k1/2n2ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
        prompt: 'Ta tour veut mater en e8. Désigne les pièces noires qui défendent la case e8.',
        mode: 'squares',
        squares: ['c7', 'd8'],
        solution: [],
        hints: [
          'Quelles pièces noires peuvent se rendre sur e8 ?',
          'Pense à une tour et à un cavalier.',
          'La tour d8 voit toute la rangée ; le cavalier saute depuis c7.',
        ],
        explanation:
          'La tour d8 et le cavalier c7 contrôlent e8 : Te8+ serait simplement prise. Pour mater, il faudrait d’abord éliminer ou dévier un défenseur.',
      },
      {
        fen: '3qr1k1/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1',
        prompt: 'Mat en 2 : tes deux tours sont doublées sur la colonne d.',
        mode: 'exact',
        solution: ['d2d8', 'e8d8', 'd1d8'],
        hints: [
          'La dame d8 est attaquée par ta tour. Peut-elle être défendue ?',
          'Les deux tours forment une batterie sur la colonne d.',
          'Prends la dame, reprends la tour : la dernière prise est un mat.',
        ],
        explanation:
          'Txd8 gagne la dame ; si Txd8, la seconde tour reprend avec Txd8# : le roi g8 est enfermé par ses pions. Les tours doublées ont éliminé les deux défenseurs.',
      },
      {
        fen: '3r2k1/5ppp/8/8/8/2N5/5PPP/6K1 w - - 0 1',
        prompt: 'Les Noirs menacent …Td1#. Défends-toi.',
        mode: 'engine',
        solution: ['h2h3'],
        tolerance: 10,
        traps: ['c3e2'],
        hints: [
          'Que se passe-t-il après …Td1+ ? Ton roi a-t-il une case ?',
          'Tu peux défendre d1 ou donner de l’air au roi.',
          'Un pion du roque (h3, g3) suffit : Ce2 ?, lui, ne couvre pas d1.',
        ],
        explanation:
          'Une case de fuite (h3, g3, h4…) évite le mat. Ce2 ? ne défend pas d1 : …Td1+ est mat, car le cavalier, en e2, n’interpose rien sur la 1re rangée.',
      },
    ],
  },
  {
    id: 'mats-de-base',
    phase: 1,
    title: 'Mats en 1 et en 2 : les motifs de base',
    summary: 'Le mat du baiser, l’escalier, la diagonale : les motifs qui reviennent toujours.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Les mats se ressemblent : apprendre quelques **motifs** permet de les voir en un instant. ' +
          '**Mat du baiser** : la dame, soutenue, se colle au roi. **Escalier** : deux tours (ou dame et tour) ' +
          'repoussent le roi rangée après rangée. **Grande diagonale** : un fou soutient la dame en g7 ou h7.',
      },
      {
        kind: 'example',
        fen: '5rk1/5pp1/8/7Q/8/3B4/5PPP/6K1 w - - 0 1',
        caption: 'Mat du baiser : Dh7#, la dame est protégée par le fou d3.',
        arrows: [
          ['h5', 'h7'],
          ['d3', 'h7'],
        ],
      },
      {
        kind: 'walkthrough',
        title: 'L’escalier en trois coups',
        fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1',
        moves: [
          {
            uci: 'a2a7',
            comment:
              'Ta7 : la première tour coupe la 7e rangée. Le roi noir ne dispose plus que de la 8e.',
          },
          {
            uci: 'g8f8',
            comment: 'Le roi s’écarte (…Rh8 n’y changerait rien : Tb8# mate aussi).',
          },
          {
            uci: 'b1b8',
            comment: 'Tb8# : une tour par rangée, c’est l’escalier. Le roi n’a plus aucune case.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: '5rk1/5pp1/8/7Q/8/3B4/5PPP/6K1 w - - 0 1',
        prompt: 'Mat en 1.',
        mode: 'exact',
        solution: ['h5h7'],
        hints: [
          'Quelle pièce défend la dame sur h7 ?',
          'Une dame protégée ne peut pas être prise par le roi.',
          'Dh7 : le fou d3 la protège.',
        ],
        explanation: 'Dh7# : le roi ne peut pas prendre la dame, défendue par le fou.',
      },
      {
        fen: '6k1/R7/1R6/8/8/8/8/K7 w - - 0 1',
        prompt: 'Mat en 1 avec les deux tours.',
        mode: 'exact',
        solution: ['b6b8'],
        hints: [
          'La tour a7 contrôle quelle rangée ?',
          'Le roi g8 n’a plus de case sur la 7e : cherche un échec sur la 8e.',
          'Amène l’autre tour en b8.',
        ],
        explanation: 'Tb8# : la tour a7 enlève toute la 7e rangée au roi.',
      },
      {
        fen: '6k1/5p1p/8/4Q3/8/8/1B3PPP/6K1 w - - 0 1',
        prompt: 'Mat en 1 : la dame et le fou travaillent ensemble.',
        mode: 'exact',
        solution: ['e5g7'],
        hints: [
          'Quelle diagonale relie ton fou au roi noir ?',
          'La dame peut se placer sur cette diagonale, protégée par le fou.',
          'Dg7 : le roi ne peut pas prendre.',
        ],
        explanation: 'Dg7# : la dame est soutenue par le fou b2 sur la grande diagonale.',
      },
      {
        fen: '5rk1/5ppp/8/7Q/8/3B4/5PPP/6K1 w - - 0 1',
        prompt: 'Mat du baiser : désigne les pièces blanches qui attaquent le pion h7.',
        mode: 'squares',
        squares: ['d3', 'h5'],
        solution: [],
        hints: [
          'Compte les pièces blanches qui voient la case h7.',
          'Une est sur la diagonale, l’autre sur la colonne.',
          'Une dame et un fou.',
        ],
        explanation:
          'La dame h5 et le fou d3 visent h7 : le pion est attaqué deux fois et défendu une fois seulement (par le roi). Dxh7# est donc mat : le roi ne peut pas prendre une dame protégée.',
      },
      {
        fen: '7k/R7/5N2/8/8/8/8/6K1 w - - 0 1',
        prompt: 'Mat en 1 : la tour est soutenue par le cavalier.',
        mode: 'exact',
        solution: ['a7h7'],
        hints: [
          'Quelles cases le roi h8 peut-il encore atteindre ?',
          'Le cavalier f6 contrôle g8 et h7.',
          'Une tour sur h7, protégée par le cavalier, mate.',
        ],
        explanation:
          'Th7# (mat arabe) : le cavalier protège la tour et contrôle g8, la tour contrôle g7 et h8. Le roi ne peut ni prendre ni fuir.',
      },
      {
        fen: '8/4N1pk/8/8/8/8/2K5/R7 w - - 0 1',
        prompt: 'Mat en 1 : le cavalier e7 prive le roi des cases g8 et g6.',
        mode: 'choice',
        solution: ['a1h1'],
        accepted: ['a1h1'],
        hints: [
          'Quelles cases le cavalier e7 contrôle-t-il autour du roi ?',
          'Il ne reste au roi que la colonne h : coupe-la.',
          'Th1 donne échec sur la colonne h.',
        ],
        explanation:
          'Th1# (mat d’Anastasie) : le cavalier contrôle g8 et g6, le pion g7 bloque le roi lui-même, la tour ferme la colonne h.',
      },
    ],
  },
  {
    id: 'principes-ouverture',
    phase: 1,
    title: 'Les principes d’ouverture',
    summary: 'Centre, développement, roque : trois règles qui suffisent pour bien commencer.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Pas besoin d’apprendre des variantes par cœur pour bien commencer. Trois principes :\n' +
          '1. **Le centre** : occupe-le ou contrôle-le avec tes pions (e4, d4) et tes pièces.\n' +
          '2. **Le développement** : sors les cavaliers et les fous vers le centre, une pièce par coup. Pas la dame ' +
          'trop tôt : elle se ferait chasser en faisant gagner du temps à l’adversaire.\n' +
          '3. **Le roque** : mets ton roi à l’abri dans les dix premiers coups.',
      },
      {
        kind: 'walkthrough',
        title: 'Les trois principes en sept coups',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          { uci: 'e2e4', comment: 'Un pion au centre ouvre des diagonales au fou et à la dame.' },
          { uci: 'e7e5', comment: 'Les Noirs occupent le centre à leur tour.' },
          {
            uci: 'g1f3',
            comment: 'Développement : le cavalier sort vers le centre et attaque e5.',
          },
          { uci: 'b8c6', comment: 'Les Noirs défendent e5 tout en développant une pièce.' },
          { uci: 'f1c4', comment: 'Le fou se développe sur une belle diagonale et vise f7.' },
          { uci: 'f8c5', comment: 'Les Noirs font de même.' },
          {
            uci: 'e1g1',
            comment:
              'Le roque : le roi est à l’abri, la tour entre en jeu. Centre, développement, roque : les trois principes en sept coups.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        prompt: 'Premier coup : occupe ou contrôle le centre.',
        mode: 'choice',
        solution: ['e2e4'],
        accepted: ['e2e4', 'd2d4', 'g1f3', 'c2c4', 'b1c3'],
        hints: [
          'Quelles cases du centre peux-tu occuper avec un pion ?',
          'Les pions e et d sont les plus utiles.',
          'e4 ou d4 : n’importe quel coup central est accepté.',
        ],
        explanation:
          'e4 et d4 occupent le centre ; Cf3, Cc3 et c4 le contrôlent. Tous respectent le principe.',
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        prompt: 'Développe une nouvelle pièce vers le centre.',
        mode: 'choice',
        solution: ['f1c4'],
        accepted: ['f1c4', 'f1b5', 'b1c3', 'd2d4'],
        hints: [
          'Quelles pièces n’ont pas encore bougé ?',
          'Un fou ou un cavalier vers le centre, pas la dame.',
          'Le fou f1 peut viser f7 depuis c4.',
        ],
        explanation:
          'Fc4, Fb5 et Cc3 développent une pièce ; d4 ouvre le centre. Dh5 ou De2 sortiraient la dame trop tôt.',
      },
      {
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
        prompt: 'Tes pièces du roi sont sorties. Que manque-t-il ?',
        mode: 'choice',
        solution: ['e1g1'],
        accepted: ['e1g1', 'b1c3', 'c2c3'],
        hints: [
          'Où est ton roi ? Est-il en sécurité ?',
          'Tes pièces du roi sont sorties : quel coup spécial met le roi à l’abri ?',
          'Le roque : e1g1.',
        ],
        explanation:
          'Le roque met ton roi à l’abri et met la tour en jeu. Cc3 et c3 (pour préparer d4) sont aussi bons.',
      },
      {
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 1',
        prompt: 'Quelles pièces mineures blanches (fous et cavaliers) n’ont pas encore bougé ?',
        mode: 'squares',
        squares: ['c1', 'f1'],
        solution: [],
        hints: [
          'Les cavaliers sont déjà sortis : regarde le reste.',
          'Reste les deux fous.',
          'Le fou de la case blanche et celui de la case noire.',
        ],
        explanation:
          'Les fous c1 et f1 sont encore chez eux : ce sont tes prochaines pièces à développer (Fc4 ou Fb5, puis Fe3 ou Fg5), avant le roque.',
      },
      {
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
        prompt: 'Les Noirs ont répondu 3…Fc5. Que joues-tu ?',
        mode: 'choice',
        solution: ['e1g1'],
        accepted: ['e1g1', 'c2c3', 'd2d3', 'b1c3'],
        hints: [
          'Compte tes pièces sorties : il t’en reste combien ?',
          'Un coup qui développe, qui prépare le centre ou qui met le roi à l’abri.',
          'Le roque, c3, d3 ou Cc3 conviennent.',
        ],
        explanation:
          'Roque, c3 (pour préparer d4), d3 ou Cc3 respectent les principes. À éviter : une sortie prématurée de la dame (Dh5 ?).',
      },
      {
        fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
        prompt: 'Les Blancs ont ouvert 1. d4. Réponds en respectant les principes.',
        mode: 'choice',
        solution: ['d7d5'],
        accepted: ['d7d5', 'g8f6', 'e7e6', 'c7c5'],
        hints: [
          'Quel est le principe à appliquer en premier ?',
          'Occupe ou contrôle le centre, comme les Blancs.',
          '…d5 occupe le centre ; …Cf6, …e6 et …c5 le contrôlent.',
        ],
        explanation:
          'Occuper le centre (…d5) ou le contrôler (…Cf6, …e6, …c5) : les principes sont respectés. Un coup de bord comme …a5 perdrait un temps.',
      },
    ],
  },
  {
    id: 'mats-elementaires',
    phase: 1,
    title: 'Mats élémentaires : roi et dame, roi et tour',
    summary: 'Savoir conclure une partie gagnée, sans pat.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Avec une dame ou une tour de plus contre le roi seul, la partie est gagnée… à condition de savoir mater. ' +
          'La méthode : **repousser le roi adverse vers un bord** (la dame ou la tour forment une « boîte » qui ' +
          'rétrécit), puis **approcher ton roi**, indispensable pour le mat final.',
      },
      {
        kind: 'text',
        title: 'Attention au pat',
        body:
          'Si le roi adverse n’a plus aucun coup légal **sans être en échec**, c’est **pat** : partie nulle ! ' +
          'Avant chaque coup de dame près du roi adverse, vérifie qu’il lui reste une case.',
      },
      {
        kind: 'walkthrough',
        title: 'Approcher le roi, puis mater',
        fen: '7k/8/8/6K1/8/8/8/1Q6 w - - 0 1',
        moves: [
          {
            uci: 'g5g6',
            comment:
              'Le roi blanc s’approche : il contrôle g7 et h7. Attention : la dame, elle, ne doit pas retirer la dernière case du roi noir (pat).',
          },
          { uci: 'h8g8', comment: 'Le roi noir n’a qu’un coup : Rg8.' },
          {
            uci: 'b1b8',
            comment: 'Db8# : la dame mate sur la 8e rangée, et le roi blanc couvre f7, g7 et h7.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1',
        prompt: 'Mat en 1 avec la dame.',
        mode: 'exact',
        solution: ['b1b8'],
        hints: [
          'Que contrôle déjà ton roi ?',
          'Il couvre g7 et h7 : le roi noir est coincé dans son coin.',
          'Un échec sur la 8e rangée est mat.',
        ],
        explanation: 'Db8# : le roi blanc contrôle g7 et h7, la dame toute la 8e rangée.',
      },
      {
        fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1',
        prompt: 'Mat en 1 avec la tour.',
        mode: 'exact',
        solution: ['h1h8'],
        hints: [
          'Quelles cases ton roi enlève-t-il au roi noir ?',
          'Il reste un échec à donner sur la 8e rangée.',
          'Amène la tour en h8.',
        ],
        explanation: 'Th8# : le roi b6 enlève a7 et b7, la tour donne l’échec sur la rangée.',
      },
      {
        fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1',
        prompt: 'Gagne, mais attention au pat !',
        mode: 'engine',
        solution: ['f6f7'],
        tolerance: 5,
        traps: ['g1g6'],
        hints: [
          'Compte les cases libres du roi noir après chaque coup candidat.',
          'Un coup sans échec qui prive le roi de toute case, c’est le pat.',
          'Avance ton roi ou donne échec avec la dame depuis loin.',
        ],
        explanation:
          'Dg6 ?? serait pat : le roi noir n’aurait plus de coup. Rf7 (ou Dg5, Dh2+…) garde le gain : mat au coup suivant.',
      },
      {
        fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1',
        prompt: 'Mat en 1 avec la dame : attention aux coups qui font pat.',
        mode: 'engine',
        solution: ['f1f8'],
        tolerance: 5,
        traps: ['f1f7'],
        hints: [
          'Compte les cases libres du roi noir après ton coup.',
          'Un coup de dame qui ne donne pas échec peut priver le roi de toute case.',
          'Donne échec sur la 8e rangée.',
        ],
        explanation:
          'Df8# est mat. Df7 ?? serait pat : le roi h8 n’aurait plus aucune case et ne serait pas en échec, donc partie nulle.',
      },
      {
        fen: 'k7/8/1K6/8/8/8/8/6Q1 w - - 0 1',
        prompt: 'Mat en 1 avec la dame.',
        mode: 'exact',
        solution: ['g1g8'],
        hints: [
          'Quelles cases ton roi retire-t-il au roi noir ?',
          'Il ne manque qu’un échec sur la 8e rangée.',
          'Dg8# (ou Dh8#) : la dame donne échec de loin.',
        ],
        explanation:
          'Dg8# : le roi b6 couvre a7 et b7, la dame couvre toute la 8e rangée. (Dh8# mate aussi.)',
      },
      {
        fen: '8/8/8/4k3/8/8/4K3/3R4 w - - 0 1',
        prompt: 'Roi et tour contre roi : joue sans laisser ta tour en prise.',
        mode: 'engine',
        solution: ['e2e3'],
        tolerance: 10,
        traps: ['d1d5'],
        hints: [
          'Ton roi défend-il ta tour quand elle s’approche du roi adverse ?',
          'Une tour qui donne échec à côté du roi adverse peut être prise.',
          'Fais un coup tranquille avec ton roi : Re3.',
        ],
        explanation:
          'Re3 rapproche le roi sans rien risquer. Td5+ ?? donne échec mais le roi prend la tour (elle n’est pas protégée) : on perd tout le gain.',
      },
    ],
  },
];
