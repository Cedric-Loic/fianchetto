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
        kind: 'example',
        fen: '6k1/5ppp/2n5/4n3/8/5N2/5PPP/4R1K1 w - - 0 1',
        caption:
          'Le cavalier e5 est attaqué deux fois (Cf3, Te1) et défendu une fois (Cc6) : Cxe5 Cxe5 Txe5 gagne une pièce.',
        arrows: [
          ['f3', 'e5'],
          ['e1', 'e5'],
          ['c6', 'e5'],
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
        explanation:
          'Une pièce sans défenseur attaquée par une pièce adverse se gagne : Cxd5 (ou Dxd5).',
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
        kind: 'example',
        fen: '6k1/5pp1/7p/8/n6b/8/5PPP/3R2K1 w - - 0 1',
        caption:
          'Td4 attaque le cavalier a4 et le fou h4, tous deux sans défense, sur la même rangée.',
        arrows: [
          ['d1', 'd4'],
          ['d4', 'a4'],
          ['d4', 'h4'],
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
        explanation: 'Td4 vise le cavalier a4 et le fou h4 : l’un des deux tombe au coup suivant.',
      },
      {
        fen: 'r5k1/6pp/8/8/8/8/5PPP/3Q2K1 w - - 0 1',
        prompt: 'Une attaque double avec échec : gagne la tour.',
        mode: 'exact',
        solution: ['d1d5', 'g8h8', 'd5a8'],
        explanation:
          'Dd5+ attaque le roi (par la diagonale f7-g8) et la tour a8 : le roi doit bouger, puis Dxa8+.',
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
        kind: 'example',
        fen: 'r3k3/7p/8/1N6/8/8/8/4K3 w - - 0 1',
        caption: 'Cc7+ attaque le roi e8 et la tour a8 : après le coup du roi, Cxa8.',
        arrows: [
          ['b5', 'c7'],
          ['c7', 'e8'],
          ['c7', 'a8'],
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
        explanation: 'Cc7+ : le roi doit bouger, puis Cxa8.',
      },
      {
        fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1N3/5N2/PPPP1PPP/R1BQK2R b KQkq - 0 5',
        prompt:
          'Les Noirs jouent. Un pion peut attaquer deux pièces à la fois : trouve la fourchette.',
        mode: 'exact',
        solution: ['d7d5'],
        explanation:
          '…d5 attaque le fou c4 et le cavalier e4 : les Noirs récupèrent la pièce sacrifiée. C’est le « truc de la ' +
          'fourchette », fréquent dans les ouvertures ouvertes.',
      },
      {
        fen: '3q3k/6pp/8/4N3/8/8/5PPP/6K1 w - - 0 1',
        prompt: 'Fourchette royale : gagne la dame.',
        mode: 'exact',
        solution: ['e5f7', 'h8g8', 'f7d8'],
        explanation: 'Cf7+ attaque le roi h8 et la dame d8 : après le coup du roi, Cxd8.',
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
        kind: 'example',
        fen: '4k3/1p3ppp/2n5/1B6/3P4/8/5PPP/6K1 w - - 0 1',
        caption: 'Le cavalier c6 est cloué sur le roi e8 par le fou b5 : il ne peut plus fuir.',
        arrows: [['b5', 'e8']],
        marks: ['c6'],
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
        explanation: 'd5 attaque le cavalier cloué : il ne peut pas fuir, il est perdu.',
      },
      {
        fen: '4k3/p6p/8/4q3/8/8/1P3KP1/R7 w - - 0 1',
        prompt: 'Cloue la dame noire sur son roi.',
        mode: 'exact',
        solution: ['a1e1'],
        explanation:
          'Te1 cloue la dame sur le roi e8 : elle ne peut que prendre la tour, et Rxe1 gagne la dame contre la tour.',
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
        kind: 'example',
        fen: '1r2k3/8/8/8/8/8/3K3R/8 b - - 0 1',
        caption: 'Tb2+ : le roi blanc doit quitter la 2e rangée, et la tour h2 tombe.',
        arrows: [
          ['b8', 'b2'],
          ['b2', 'h2'],
        ],
      },
    ],
    exercises: [
      {
        fen: '1r2k3/8/8/8/8/8/3K3R/8 b - - 0 1',
        prompt: 'Les Noirs jouent : trouve l’enfilade.',
        mode: 'exact',
        solution: ['b8b2', 'd2e3', 'b2h2'],
        explanation: 'Tb2+ met le roi en échec ; il s’écarte et Txh2 gagne la tour.',
      },
      {
        fen: 'q7/8/8/3k4/8/8/8/5BK1 w - - 0 1',
        prompt: 'Le roi et la dame noirs sont sur la même diagonale. Profites-en.',
        mode: 'exact',
        solution: ['f1g2', 'd5c5', 'g2a8'],
        explanation: 'Fg2+ : le roi quitte la grande diagonale et Fxa8 gagne la dame.',
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
        explanation: 'Ta8# : le classique mat du couloir.',
      },
      {
        fen: '3qr1k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1',
        prompt: 'Mat en 2 : élimine d’abord un défenseur.',
        mode: 'exact',
        solution: ['e2e8', 'd8e8', 'e1e8'],
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
        explanation:
          'Une case de fuite (h3, g3, h4…) suffit : la tour ne mate plus en d1. Ne perds pas de temps avec Fxf7+.',
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
        kind: 'example',
        fen: '6k1/R7/1R6/8/8/8/8/K7 w - - 0 1',
        caption: 'Escalier : la tour a7 tient la 7e rangée, la tour b6 mate en b8.',
        arrows: [['b6', 'b8']],
      },
    ],
    exercises: [
      {
        fen: '5rk1/5pp1/8/7Q/8/3B4/5PPP/6K1 w - - 0 1',
        prompt: 'Mat en 1.',
        mode: 'exact',
        solution: ['h5h7'],
        explanation: 'Dh7# : le roi ne peut pas prendre la dame, défendue par le fou.',
      },
      {
        fen: '6k1/R7/1R6/8/8/8/8/K7 w - - 0 1',
        prompt: 'Mat en 1 avec les deux tours.',
        mode: 'exact',
        solution: ['b6b8'],
        explanation: 'Tb8# : la tour a7 enlève toute la 7e rangée au roi.',
      },
      {
        fen: '6k1/5p1p/8/4Q3/8/8/1B3PPP/6K1 w - - 0 1',
        prompt: 'Mat en 1 : la dame et le fou travaillent ensemble.',
        mode: 'exact',
        solution: ['e5g7'],
        explanation: 'Dg7# : la dame est soutenue par le fou b2 sur la grande diagonale.',
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
        kind: 'example',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        caption:
          'Après 1. e4 e5 2. Cf3 Cc6 : Fc4 ou Fb5 développent une pièce et préparent le roque.',
        arrows: [
          ['f1', 'c4'],
          ['f1', 'b5'],
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
        explanation:
          'e4 et d4 occupent le centre ; Cf3, Cc3 et c4 le contrôlent. Tous respectent le principe.',
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        prompt: 'Développe une nouvelle pièce vers le centre.',
        mode: 'choice',
        solution: ['f1c4'],
        accepted: ['f1c4', 'f1b5', 'b1c3', 'd2d4'],
        explanation:
          'Fc4, Fb5 et Cc3 développent une pièce ; d4 ouvre le centre. Dh5 ou De2 sortiraient la dame trop tôt.',
      },
      {
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
        prompt: 'Tes pièces du roi sont sorties. Que manque-t-il ?',
        mode: 'choice',
        solution: ['e1g1'],
        accepted: ['e1g1', 'b1c3', 'c2c3'],
        explanation:
          'Le roque met ton roi à l’abri et met la tour en jeu. Cc3 et c3 (pour préparer d4) sont aussi bons.',
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
        kind: 'example',
        fen: '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1',
        caption: 'Le roi blanc enlève g7 et h7 ; la dame mate sur la 8e rangée : Db8#.',
        arrows: [['b1', 'b8']],
      },
    ],
    exercises: [
      {
        fen: '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1',
        prompt: 'Mat en 1 avec la dame.',
        mode: 'exact',
        solution: ['b1b8'],
        explanation: 'Db8# : le roi blanc contrôle g7 et h7, la dame toute la 8e rangée.',
      },
      {
        fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1',
        prompt: 'Mat en 1 avec la tour.',
        mode: 'exact',
        solution: ['h1h8'],
        explanation: 'Th8# : le roi b6 enlève a7 et b7, la tour donne l’échec sur la rangée.',
      },
      {
        fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1',
        prompt: 'Gagne, mais attention au pat !',
        mode: 'engine',
        solution: ['f6f7'],
        tolerance: 5,
        traps: ['g1g6'],
        explanation:
          'Dg6 ?? serait pat : le roi noir n’aurait plus de coup. Rf7 (ou Dg5, Dh2+…) garde le gain : mat au coup suivant.',
      },
    ],
  },
];
