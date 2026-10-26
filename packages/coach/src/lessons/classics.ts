import type { Lesson } from './types.js';

/*
 * Parties classiques commentées (domaine public) : chaque leçon rejoue une partie célèbre coup par
 * coup, puis pose des questions « que jouerais-tu ici ? » aux moments clés. Les coups sont ceux de
 * la partie historique ; les commentaires sont originaux. Phase 2 : miniatures ; phase 3 : attaques.
 */

export const CLASSICS_2: Lesson[] = [
  {
    id: 'classique-opera',
    phase: 2,
    title: 'La partie de l’Opéra (Morphy, 1858)',
    summary: 'Une miniature célèbre : développement, clouages et mat en 17 coups.',
    minutes: 18,
    sections: [
      {
        kind: 'text',
        body: 'En 1858, à Paris, Paul Morphy joue pendant une représentation d’opéra contre deux amateurs qui conseillent le duc de Brunswick et le comte Isouard. Il gagne en 17 coups en appliquant sans faille les principes d’ouverture : **chaque coup apporte une pièce** et profite du retard adverse.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) combien de pièces Morphy a sorties quand son adversaire n’en a qu’une ; (2) chaque fois qu’une menace apparaît, la question « que menace-t-il ? » ; (3) le thème final : un cavalier cloué, puis dévié.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment:
              'Morphy ouvre au centre : le pion occupe une case clé et libère le fou f1 et la dame.',
          },
          {
            uci: 'e7e5',
            comment: 'Les Noirs répondent symétriquement, le plus simple.',
          },
          {
            uci: 'g1f3',
            comment:
              'Le cavalier sort en attaquant e5 : développer en menaçant, c’est gagner un temps.',
          },
          {
            uci: 'd7d6',
            comment: 'Défense Philidor : solide, mais elle enferme un peu le fou f8.',
          },
          {
            uci: 'd2d4',
            comment:
              'Morphy attaque le centre noir avant que les Noirs aient développé quoi que ce soit.',
          },
          {
            uci: 'c8g4',
            comment:
              'Le fou sort tôt et cloue le cavalier f3 contre la dame. Une seule pièce sortie, et déjà en avant : attention.',
          },
          {
            uci: 'd4e5',
            comment:
              'Prise d’un pion central. Rien ne presse pour les Noirs : l’échange va suivre.',
          },
          {
            uci: 'g4f3',
            comment: 'Le fou prend le cavalier cloué : sinon les Noirs perdent un pion pour rien.',
          },
          {
            uci: 'd1f3',
            comment: 'La dame reprend en se développant, et vise déjà f7.',
          },
          {
            uci: 'd6e5',
            comment:
              'Les Noirs reprennent le pion : l’égalité matérielle est rétablie, mais leur roi est encore au centre.',
          },
          {
            uci: 'f1c4',
            comment:
              'Le fou et la dame visent f7, défendu par le seul roi. **Question « menaces »** : Dxf7 serait mat !',
          },
          {
            uci: 'g8f6',
            comment:
              'Parade obligatoire : le cavalier bloque la colonne f et sauve le roi. Sans la question « quelle est la menace ? », les Noirs étaient perdus.',
          },
          {
            uci: 'f3b3',
            comment: 'Double menace : Dxb7 d’un côté, et la batterie dame-fou sur f7 de l’autre.',
          },
          {
            uci: 'd8e7',
            comment:
              'Les Noirs défendent f7 avec la dame. Morphy ne se laisse pas tenter par b7 : il préfère finir son développement.',
          },
          {
            uci: 'b1c3',
            comment:
              'Le dernier cavalier sort. Chaque coup apporte une pièce de plus dans la partie : c’est le vrai secret de Morphy.',
          },
          {
            uci: 'c7c6',
            comment:
              'Le pion c6 protège b5 et d5, mais il n’aide pas le développement des Noirs, toujours sans roque.',
          },
          {
            uci: 'c1g5',
            comment:
              'Le fou cloue le cavalier f6 contre la dame e7 : le cavalier ne peut plus bouger sans perdre la dame.',
          },
          {
            uci: 'b7b5',
            comment:
              'Les Noirs veulent chasser le fou c4, mais ils ouvrent leur aile dame alors que le roi est au centre : l’adversaire va en profiter.',
          },
          {
            uci: 'c3b5',
            comment:
              'Sacrifice de cavalier : Morphy ouvre les lignes autour d’un roi non roqué. Il a vérifié les échecs et les prises, puis il a calculé.',
          },
          {
            uci: 'c6b5',
            comment:
              'Les Noirs prennent la pièce, mais le pion c6 disparaît : la diagonale a4-e8 est ouverte.',
          },
          {
            uci: 'c4b5',
            comment: 'Échec ! Le fou reprend le pion avec gain de tempo sur la diagonale ouverte.',
          },
          {
            uci: 'b8d7',
            comment:
              'Parade forcée : le cavalier b8 s’interpose. Il est maintenant cloué par le fou b5 contre le roi.',
          },
          {
            uci: 'e1c1',
            comment:
              'Le roque long met la tour sur la colonne d, d’un seul coup : développer en attaquant le cavalier cloué.',
          },
          {
            uci: 'a8d8',
            comment:
              'Les Noirs défendent d7 avec la tour, mais le cavalier reste cloué : il ne peut pas bouger.',
          },
          {
            uci: 'd1d7',
            comment:
              'La tour prend le cavalier cloué : elle donne une pièce d’échange contre le cavalier, mais le clouage reste sur la colonne d.',
          },
          {
            uci: 'd8d7',
            comment:
              'Reprise forcée : la tour d7 est maintenant elle-même clouée par le fou b5 contre le roi e8.',
          },
          {
            uci: 'h1d1',
            comment:
              'La seconde tour arrive : la tour d7 (clouée) est attaquée deux fois, par la tour d1 et par le fou b5.',
          },
          {
            uci: 'e7e6',
            comment:
              'La dame défend d7 une fois de plus, et propose l’échange des dames sur la diagonale b3-e6.',
          },
          {
            uci: 'b5d7',
            comment:
              'Sacrifice de fou : les Noirs peuvent reprendre avec la dame ou avec le cavalier. Avec le cavalier, ils vont bloquer eux-mêmes la colonne d.',
          },
          {
            uci: 'f6d7',
            comment:
              'Le cavalier reprend en d7, mais il est maintenant le seul pièce qui masque la colonne d devant le roi.',
          },
          {
            uci: 'b3b8',
            comment:
              'Sacrifice de dame : le cavalier d7 doit prendre, et il abandonne la colonne d. C’est une déviation.',
          },
          {
            uci: 'd7b8',
            comment: 'Seule prise possible, et la colonne d s’ouvre pour la tour.',
          },
          {
            uci: 'd1d8',
            comment:
              'Mat : la tour d8 est protégée par le fou g5 ; d7 et e7 sont contrôlés, et f8 et f7 sont occupés par les propres pièces noires.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : sortir des pièces vaut mieux que prendre des pions ; un roi resté au centre est une cible ; avant de jouer un coup tentant, je demande « que menace l’adversaire ? ». Les Noirs ont perdu parce qu’ils ont joué avec une seule pièce.',
      },
    ],
    exercises: [
      {
        fen: 'rn1qkb1r/ppp2ppp/5n2/4p3/2B1P3/5Q2/PPP2PPP/RNB1K2R w KQkq - 2 7',
        prompt:
          'Les Noirs viennent de parer Dxf7# par Cf6. Comment poursuivre l’initiative sans rien laisser en prise ?',
        mode: 'engine',
        solution: ['f3b3'],
        tolerance: 7,
        traps: ['f3f6', 'c4f7'],
        hints: [
          'Quelle pièce n’a pas encore sa place ? Pas de prise : cherche un coup de menace.',
          'La dame et le fou visent déjà f7 : ajoute une deuxième menace.',
          'Db3 attaque b7 et garde la pression sur f7.',
        ],
        explanation:
          'Db3 menace b7 et f7 à la fois. Dxf6? gxf6 coûte la dame pour un cavalier, et Fxf7+? Rxf7 donne une pièce pour un pion.',
      },
      {
        fen: 'rn2kb1r/pp2qppp/2p2n2/4p3/2B1P3/1QN5/PPP2PPP/R1B1K2R w KQkq - 0 9',
        prompt:
          'Les Noirs ont joué c6. Que jouerais-tu pour développer la dernière pièce mineure avec gain de temps ?',
        mode: 'engine',
        solution: ['c1g5'],
        tolerance: 7,
        traps: ['b3b7'],
        hints: [
          'Quelles pièces blanches ne sont pas développées ?',
          'Une pièce qui cloue en développant fait deux choses à la fois.',
          'Fg5 cloue le cavalier f6 contre la dame e7.',
        ],
        explanation:
          'Fg5 sort le fou avec clouage. Dxb7? Db4+ puis Dxb2 : le pion empoisonné fait perdre le contrôle de la partie.',
      },
      {
        fen: 'rn2kb1r/p3qppp/2p2n2/1p2p1B1/2B1P3/1QN5/PPP2PPP/R3K2R w KQkq - 0 10',
        prompt: 'Les Noirs ont joué b5 pour chasser le fou. Quel sacrifice ouvre le roi noir ?',
        mode: 'engine',
        solution: ['c3b5'],
        tolerance: 8,
        traps: ['g5f6'],
        hints: [
          'Le roi noir est encore au centre : cherche une ligne à ouvrir.',
          'Quelle pièce peut prendre b5 et faire sauter le pion c6 ?',
          'Cxb5 : si cxb5, Fxb5+ avec échec sur la diagonale.',
        ],
        explanation:
          'Cxb5 donne une pièce mais ouvre la diagonale a4-e8 et la colonne b. Fxf6? gxf6 est sans intérêt.',
      },
      {
        fen: 'r3kb1r/p2nqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/R3K2R w KQkq - 1 12',
        prompt:
          'Le cavalier d7 est cloué par le fou b5. Quel coup met la tour sur la colonne d tout en mettant le roi à l’abri ?',
        mode: 'engine',
        solution: ['e1c1'],
        tolerance: 8,
        hints: [
          'Que peut faire le roi pour libérer une tour d’un seul coup ?',
          'Roquer, mais de quel côté ?',
          'Le grand roque met la tour sur d1.',
        ],
        explanation:
          'O-O-O développe la tour sur la colonne d et attaque le cavalier cloué : on ajoute un attaquant sans rien laisser en prise.',
      },
      {
        fen: '4kb1r/p2r1ppp/4qn2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 2 15',
        prompt:
          'Mat en 3. Les Blancs ont une dame, une tour et un fou pour attaquer. Donne la suite complète : tu joues, l’adversaire répond de force, etc.',
        mode: 'exact',
        solution: ['b5d7', 'f6d7', 'b3b8', 'd7b8', 'd1d8'],
        hints: [
          'Quel sacrifice enlève la pièce qui bloque la colonne d ?',
          'Après Fxd7+ Cxd7, la dame peut-elle venir sur b8 ?',
          'Fxd7+ Cxd7, Db8+ Cxb8, Td8#.',
        ],
        explanation:
          'Fxd7+ Cxd7 Db8+! Cxb8 Td8# : le cavalier est dévié de la colonne d, et le fou g5 protège la tour.',
      },
    ],
  },
  {
    id: 'classique-legal',
    phase: 2,
    title: 'Le mat de Légal (1750)',
    summary:
      'Un sacrifice de dame qui réussit parce que le cavalier n’était cloué que contre la dame.',
    minutes: 12,
    sections: [
      {
        kind: 'text',
        body: 'Le mat de Légal, ancien de près de trois siècles, se rejoue encore. Il montre qu’un clouage contre la dame n’est pas un clouage absolu : le cavalier peut bouger, à condition qu’on ait vu la suite.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) le clouage du cavalier f3 contre la dame ; (2) pourquoi les Noirs prennent la dame sans regarder les échecs ; (3) le mat final avec trois pièces seulement.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment: 'Ouverture classique : le pion occupe le centre.',
          },
          {
            uci: 'e7e5',
            comment: 'Réponse symétrique des Noirs.',
          },
          {
            uci: 'g1f3',
            comment: 'Le cavalier attaque e5 en se développant.',
          },
          {
            uci: 'd7d6',
            comment: 'Les Noirs défendent e5 d’un pion : solide, mais cela bloque le fou f8.',
          },
          {
            uci: 'f1c4',
            comment: 'Le fou vise f7, case faible tant que le roi noir n’a pas roqué.',
          },
          {
            uci: 'c8g4',
            comment:
              'Le fou noir cloue le cavalier f3 contre la dame. Tentant, mais il quitte la défense de f7 et sort sans raison tactique.',
          },
          {
            uci: 'b1c3',
            comment: 'Le cavalier c3 développe une pièce et prépare le piège : il contrôle d5.',
          },
          {
            uci: 'g7g6',
            comment:
              'Les Noirs préparent un fianchetto mais n’ont pas posé la question des menaces : que veulent les Blancs ?',
          },
          {
            uci: 'f3e5',
            comment:
              'Sacrifice de dame ! Le cavalier f3 n’est cloué que contre la dame, pas contre le roi : il peut partir.',
          },
          {
            uci: 'g4d1',
            comment:
              'Les Noirs prennent la dame : gagner une dame est tentant, mais ils n’ont pas regardé les échecs.',
          },
          {
            uci: 'c4f7',
            comment:
              'Échec : le fou prend f7, et le roi ne peut pas reprendre car le cavalier e5 protège f7.',
          },
          {
            uci: 'e8e7',
            comment: 'Le roi est forcé d’aller en e7.',
          },
          {
            uci: 'c3d5',
            comment:
              'Mat : le cavalier d5 donne l’échec, et le roi est enfermé par sa propre dame, son fou f8 et son pion d6.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : avant de prendre une pièce, je regarde les échecs que l’adversaire peut donner ensuite. Un clouage contre la dame n’empêche pas de bouger la pièce clouée : c’est un sacrifice.',
      },
    ],
    exercises: [
      {
        fen: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
        prompt:
          'Les Noirs viennent de défendre e5. Quel développement naturel vise f7, le point faible des Noirs ?',
        mode: 'engine',
        solution: ['f1c4'],
        tolerance: 7,
        traps: ['f3e5'],
        hints: [
          'Quelle pièce mineure n’est pas encore sortie ?',
          'Le fou roi a une belle diagonale.',
          'Fc4 vise f7.',
        ],
        explanation: 'Fc4 développe le fou vers f7. Cxe5? dxe5 donne un cavalier pour un pion.',
      },
      {
        fen: 'rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 3 4',
        prompt:
          'Que jouerais-tu avec les Noirs ? Pense à ce que menacent les Blancs avant de fianchetter.',
        mode: 'engine',
        solution: ['g8f6'],
        tolerance: 8,
        traps: ['g7g6'],
        hints: [
          'Quelle menace les Blancs ont-ils ? Regarde e5.',
          'Le cavalier f3 est cloué, mais seulement contre la dame : il peut partir.',
          'Mieux vaut développer un cavalier : Cf6 ou Cc6.',
        ],
        explanation:
          'g6 ? permet Cxe5! Fxd1 Fxf7+ Re7 Cd5#. Un développement normal comme Cf6 ou Cc6 évite le piège.',
      },
      {
        fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
        prompt:
          'Les Noirs ont joué g6. Les Blancs ont une pièce clouée. Quel coup sacrifie la dame pour mater ?',
        mode: 'engine',
        solution: ['f3e5'],
        tolerance: 8,
        traps: ['c4f7'],
        hints: [
          'Le cavalier f3 est-il vraiment cloué ?',
          'Que se passe-t-il si le cavalier prend un pion en e5 ?',
          'Cxe5 offre la dame : si Fxd1, Fxf7+ puis Cd5#.',
        ],
        explanation: 'Cxe5 ! Si Fxd1, Fxf7+ Re7 Cd5#. Fxf7+? Rxf7 perd une pièce sans raison.',
      },
      {
        fen: 'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6',
        prompt: 'Les Noirs ont pris la dame. Trouve le mat en 2 (ta suite complète).',
        mode: 'exact',
        solution: ['c4f7', 'e8e7', 'c3d5'],
        hints: [
          'Quel échec peux-tu donner avec le fou ?',
          'Le roi n’a qu’une case de fuite.',
          'Fxf7+ Re7, Cd5#.',
        ],
        explanation:
          'Fxf7+ Re7 Cd5# : le roi est enfermé par sa propre dame, son fou f8 et son pion d6.',
      },
    ],
  },
  {
    id: 'classique-reti',
    phase: 2,
    title: 'Réti–Tartakower (Vienne, 1910)',
    summary: 'Un mat au sixième coup contre la défense Caro-Kann.',
    minutes: 10,
    sections: [
      {
        kind: 'text',
        body: 'Richard Réti bat Savielly Tartakower en six coups à Vienne en 1910. La partie est une leçon sur la menace cachée : un cavalier qui se dévoile avec échec en démasquant une pièce.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) la dame placée derrière le cavalier e4 ; (2) la case d6 et le roque impossible ; (3) pourquoi Cgf6 ne résout rien.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment: 'Le pion roi occupe le centre.',
          },
          {
            uci: 'c7c6',
            comment:
              'La défense Caro-Kann : les Noirs préparent d5 en gardant une structure solide.',
          },
          {
            uci: 'd2d4',
            comment: 'Les Blancs prennent aussi le centre.',
          },
          {
            uci: 'd7d5',
            comment: 'Les Noirs attaquent e4 : le centre va se découvrir.',
          },
          {
            uci: 'b1c3',
            comment: 'Le cavalier défend e4 et se développe : un coup naturel.',
          },
          {
            uci: 'd5e4',
            comment: 'Les Noirs échangent le pion central.',
          },
          {
            uci: 'c3e4',
            comment: 'Le cavalier reprend le pion et se place au centre.',
          },
          {
            uci: 'b8d7',
            comment:
              'Le cavalier d7 prépare Cgf6 sans risquer d’échange en f6. Un coup courant, mais il bloque la dame.',
          },
          {
            uci: 'd1e2',
            comment:
              'Piège : la dame se place derrière le cavalier e4. Il menace de partir avec échec en d6, démasquant la dame sur e7.',
          },
          {
            uci: 'g8f6',
            comment:
              'Les Noirs attaquent le cavalier au lieu de regarder la menace. Ils ont oublié de demander « que menace-t-il ? ».',
          },
          {
            uci: 'e4d6',
            comment:
              'Mat : le cavalier d6 donne échec, et le roi e8 est entouré de ses pièces (d8, f8, d7, e7, f7).',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : demander « quelle est la menace ? » avant chaque coup. Un coup de développement automatique (Cgf6) peut être une gaffe si la case d6 est libre pour un cavalier.',
      },
    ],
    exercises: [
      {
        fen: 'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3',
        prompt:
          'Les Noirs vont jouer d5xe4 : le pion e4 doit être défendu. Quel développement le protège ?',
        mode: 'choice',
        solution: ['b1c3'],
        accepted: ['b1c3', 'b1d2'],
        hints: [
          'Quelle pièce mineure défend e4 en se développant ?',
          'Deux cavaliers peuvent aller en c3 ou d2.',
          'Cc3 ou Cd2.',
        ],
        explanation:
          'Cc3 défend e4 en développant un cavalier. Cd2 aussi, mais il bloque le fou c1.',
      },
      {
        fen: 'r1bqkbnr/pp1npppp/2p5/8/3PN3/8/PPP1QPPP/R1B1KBNR b KQkq - 2 5',
        prompt:
          'Cd6 menace d’être mat. Désigne toutes les pièces noires qui touchent le roi e8 et l’emprisonnent.',
        mode: 'squares',
        squares: ['d8', 'f8', 'd7', 'e7', 'f7'],
        solution: [],
        hints: [
          'Regarde les huit cases autour du roi.',
          'Combien sont occupées par ses propres pièces ?',
          'Les cinq cases voisines sont occupées.',
        ],
        explanation:
          'Toutes les cases voisines du roi sont occupées par ses propres pièces : un échec de cavalier en d6 serait mat.',
      },
      {
        fen: 'r1bqkbnr/pp1npppp/2p5/8/3PN3/8/PPP1QPPP/R1B1KBNR b KQkq - 2 5',
        prompt:
          'Les Blancs menacent Cd6# après le départ du cavalier e4. Que jouerais-tu avec les Noirs ?',
        mode: 'engine',
        solution: ['d7f6'],
        tolerance: 10,
        traps: ['g8f6'],
        hints: [
          'Que peut faire le cavalier e4 en deux coups ?',
          'La case d6 est-elle contrôlée ? Le roi a-t-il une case de fuite ?',
          'Cdf6 libère d7 pour le roi ; Dc7 ou e6 contrôlent aussi d6.',
        ],
        explanation:
          'Il faut libérer une case de fuite ou contrôler d6 : Cdf6, Dc7 ou e6. Cgf6?? laisse le cavalier d7 en place et permet Cd6#.',
      },
      {
        fen: 'r1bqkb1r/pp1npppp/2p2n2/8/3PN3/8/PPP1QPPP/R1B1KBNR w KQkq - 3 6',
        prompt: 'Les Noirs ont joué Cgf6. Trouve le mat en un coup.',
        mode: 'exact',
        solution: ['e4d6'],
        hints: [
          'Le cavalier e4 découvre la dame sur e7.',
          'Quelle case donne échec au roi e8 ?',
          'Cd6#.',
        ],
        explanation:
          'Cd6# : le roi est entouré de ses propres pièces, et le cavalier d6 ne peut pas être pris.',
      },
    ],
  },
];

export const CLASSICS_3: Lesson[] = [
  {
    id: 'classique-lasker-bauer',
    phase: 3,
    title: 'Lasker–Bauer (Amsterdam, 1889)',
    summary: 'Le double sacrifice de fou : Fxh7+ puis Fxg7 contre un roi roqué.',
    minutes: 22,
    sections: [
      {
        kind: 'text',
        body: 'Emanuel Lasker joue contre Johann Bauer à Amsterdam en 1889. La partie est l’une des premières à montrer clairement le « sacrifice grec » : le fou prend h7 avec échec, le roi prend, puis la dame arrive avec échec. Lasker en ajoute un second sur g7 : un modèle pour toute attaque sur un roque.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) les plans des Blancs : fou b2 vers la grande diagonale, fou d3 vers h7, cavalier en e5 ; (2) le coup lent des Noirs (…a6) ; (3) comment chaque pièce blanche rejoint l’attaque.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'f2f4',
            comment: 'L’ouverture Bird : f4 contrôle la case e5 depuis le flanc roi.',
          },
          {
            uci: 'd7d5',
            comment: 'Les Noirs occupent le centre avec d5.',
          },
          {
            uci: 'e2e3',
            comment: 'e3 solidifie le centre et ouvre la diagonale du fou f1.',
          },
          {
            uci: 'g8f6',
            comment: 'Le cavalier sort et surveille e4.',
          },
          {
            uci: 'b2b3',
            comment: 'Plan des Blancs : le fou ira en b2 pour viser la grande diagonale.',
          },
          {
            uci: 'e7e6',
            comment: 'Les Noirs ouvrent la diagonale du fou f8.',
          },
          {
            uci: 'c1b2',
            comment: 'Le fou b2 regarde vers e5 et g7 : il est déjà bien placé.',
          },
          {
            uci: 'f8e7',
            comment: 'Le fou noir se prépare à roquer.',
          },
          {
            uci: 'f1d3',
            comment: 'Le fou d3 vise h7 : le plan d’attaque contre le roque se dessine.',
          },
          {
            uci: 'b7b6',
            comment: 'Les Noirs fianchettent aussi, mais ne pensent pas à la défense de h7.',
          },
          {
            uci: 'b1c3',
            comment: 'Le cavalier sort sans bloquer le fou b2 : un pion de moins dans le chemin.',
          },
          {
            uci: 'c8b7',
            comment:
              'Le fou b7 contrôle la grande diagonale, mais il est pour l’instant sans cible.',
          },
          {
            uci: 'g1f3',
            comment: 'Le second cavalier sort : le roque est proche.',
          },
          {
            uci: 'b8d7',
            comment: 'Le cavalier d7 surveille e5 mais enferme le fou b7.',
          },
          {
            uci: 'e1g1',
            comment: 'Roque blanc : le roi est en sécurité, toutes les pièces sont développées.',
          },
          {
            uci: 'e8g8',
            comment: 'Roque noir : à partir de maintenant, le roi noir sera la cible.',
          },
          {
            uci: 'c3e2',
            comment: 'Le cavalier se dirige vers g3, puis vers e5 ou h5.',
          },
          {
            uci: 'c7c5',
            comment: 'Les Noirs prennent de l’espace à l’aile dame, loin de l’action réelle.',
          },
          {
            uci: 'e2g3',
            comment:
              'Le cavalier g3 prépare e5 ou h5 : un bel exemple de pièce amenée vers le roque adverse.',
          },
          {
            uci: 'd8c7',
            comment:
              'La dame noire cherche une meilleure case, mais elle quitte la défense de l’aile roi.',
          },
          {
            uci: 'f3e5',
            comment:
              'Le cavalier arrive en e5 : un avant-poste soutenu par f4 et par le fou b2. Les Noirs ne pourraient le chasser que par f6, qui affaiblirait e6.',
          },
          {
            uci: 'd7e5',
            comment:
              'Les Noirs échangent le cavalier gênant ; mais la reprise donne au fou b2 un poste idéal.',
          },
          {
            uci: 'b2e5',
            comment: 'Le fou e5 domine la grande diagonale : il vise g7 et c7.',
          },
          {
            uci: 'c7c6',
            comment: 'La dame noire quitte la diagonale, sinon Fxc7 gagnerait du temps.',
          },
          {
            uci: 'd1e2',
            comment:
              'La dame se place derrière le fou d3 : elle prépare Cxh5 et le sacrifice en h7.',
          },
          {
            uci: 'a7a6',
            comment:
              'Un coup lent : les Noirs perdent un temps à l’aile dame, au lieu de renforcer le roque.',
          },
          {
            uci: 'g3h5',
            comment: 'Le cavalier saute en h5, attaque le cavalier f6 et gêne le roque noir.',
          },
          {
            uci: 'f6h5',
            comment:
              'Les Noirs prennent le cavalier, mais ouvrent la diagonale b1-h7 devant le fou d3 et laissent la dame e2 libre de prendre h5.',
          },
          {
            uci: 'd3h7',
            comment:
              'Le sacrifice classique du fou sur h7 : il détourne le roi et ouvre la colonne h.',
          },
          {
            uci: 'g8h7',
            comment: 'Le roi doit prendre, sinon il perd un pion sans compensation.',
          },
          {
            uci: 'e2h5',
            comment:
              'La dame reprend avec échec, et le cavalier h5 tombe : les Blancs ont récupéré toute leur pièce.',
          },
          {
            uci: 'h7g8',
            comment: 'Le roi retourne en g8, mais il a perdu son pion h7 : son roque est ouvert.',
          },
          {
            uci: 'e5g7',
            comment: 'Second sacrifice de fou : le fou e5 détruit le dernier bouclier du roi.',
          },
          {
            uci: 'g8g7',
            comment: 'Le roi prend, sinon le fou continue à gagner du matériel avec attaque.',
          },
          {
            uci: 'h5g4',
            comment:
              'Échec en g4 (et non en g5, où le fou e7 prendrait la dame) : le roi est repoussé vers h7.',
          },
          {
            uci: 'g7h7',
            comment: 'Le roi se met sur h7 : Kh8 donnait aussi lieu à une attaque.',
          },
          {
            uci: 'f1f3',
            comment: 'La tour entre en jeu par la troisième rangée : elle prépare Th3+.',
          },
          {
            uci: 'e6e5',
            comment: 'Les Noirs veulent libérer leur dame, mais ils ouvrent d’autres diagonales.',
          },
          {
            uci: 'f3h3',
            comment:
              'La tour arrive sur la colonne h avec échec : l’attaque est écrasante, et chaque pièce blanche participe.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : pour attaquer un roque, rassemble d’abord les pièces (fou d3, dame, cavalier h5), puis sacrifie. Calcule le sacrifice : Fxh7+ n’est bon que si la dame ou le cavalier peut suivre avec échec.',
      },
    ],
    exercises: [
      {
        fen: 'r4rk1/pbqnbppp/1p2pn2/2pp4/5P2/1P1BPNN1/PBPP2PP/R2Q1RK1 w - - 2 11',
        prompt:
          'Les deux camps ont roqué. Quel coup place un cavalier sur la case centrale que contrôlent déjà f4 et le fou b2 ?',
        mode: 'engine',
        solution: ['f3e5'],
        tolerance: 8,
        hints: [
          'Quelle case centrale est contrôlée par f4 et par le fou b2 ?',
          'Un cavalier solide au centre est une pièce de plus pour l’attaque.',
          'Ce5.',
        ],
        explanation:
          'Ce5 : un avant-poste soutenu par f4 et le fou b2. Les Noirs devront l’échanger ou affaiblir leur camp.',
      },
      {
        fen: 'r4rk1/1b2bppp/ppq1pn2/2ppB3/5P2/1P1BP1N1/P1PPQ1PP/R4RK1 w - - 0 14',
        prompt:
          'Les Noirs ont perdu un temps avec a6. Comment augmenter la pression sur le roque noir ?',
        mode: 'engine',
        solution: ['g3h5'],
        tolerance: 8,
        traps: ['d3h7'],
        hints: [
          'Quelle pièce n’attaque pas encore le roque ?',
          'Le cavalier g3 peut sauter vers l’aile roi.',
          'Ch5 attaque le cavalier f6 et fixe le roque.',
        ],
        explanation:
          'Ch5 menace Cxf6+ et force les Noirs à se décider. Fxh7+? tout de suite perd un fou : le cavalier n’est pas encore en h5 pour soutenir la dame.',
      },
      {
        fen: 'r4rk1/1b2bppp/ppq1p3/2ppB2n/5P2/1P1BP3/P1PPQ1PP/R4RK1 w - - 0 15',
        prompt:
          'Les Noirs ont pris le cavalier h5. Tu peux prendre ce cavalier avec la dame, mais un coup plus fort ouvre le roque. Lequel ?',
        mode: 'engine',
        solution: ['d3h7'],
        tolerance: 10,
        traps: ['e2h5'],
        hints: [
          'Le fou d3 vise quel pion ?',
          'Un sacrifice sur h7 peut-il être suivi d’un échec ?',
          'Fxh7+ Rxh7 Dxh5+.',
        ],
        explanation:
          'Fxh7+ Rxh7 Dxh5+ récupère la pièce et le pion avec une attaque. Dxh5? tout de suite ne donne qu’une égalité approximative.',
      },
      {
        fen: 'r4rk1/1b2bpp1/ppq1p3/2ppB2Q/5P2/1P2P3/P1PP2PP/R4RK1 w - - 1 17',
        prompt: 'Le roi noir est revenu sur g8. Quel second sacrifice détruit son abri ?',
        mode: 'engine',
        solution: ['e5g7'],
        tolerance: 10,
        traps: ['f1f3'],
        hints: ['Quel pion protège encore le roi ?', 'Le fou e5 vise g7.', 'Fxg7 Rxg7, puis Dg4+.'],
        explanation:
          'Fxg7! détruit le dernier bouclier du roi. Tf3? ne menace rien de précis et laisse les Noirs respirer.',
      },
      {
        fen: 'r4r2/1b2bpk1/ppq1p3/2pp3Q/5P2/1P2P3/P1PP2PP/R4RK1 w - - 0 18',
        prompt: 'Le roi noir a pris le fou g7. Quel échec continue l’attaque sans rien perdre ?',
        mode: 'engine',
        solution: ['h5g4'],
        tolerance: 10,
        traps: ['h5g5'],
        hints: [
          'Deux échecs sont possibles avec la dame : lequel est protégé par une pièce adverse ?',
          'Le fou e7 voit la case g5.',
          'Dg4+ ; Dg5+ perdrait la dame.',
        ],
        explanation:
          'Dg4+ chasse le roi. Dg5+? Fxg5 : le fou e7 prend la dame. Vérifie toujours si ta case d’échec est défendue.',
      },
      {
        fen: 'r4r2/1b2bp1k/ppq1p3/2pp4/5PQ1/1P2P3/P1PP2PP/R4RK1 w - - 2 19',
        prompt:
          'Le roi noir est sur h7, la dame est en g4. Quelle pièce apporte du renfort à l’attaque ?',
        mode: 'engine',
        solution: ['f1f3'],
        tolerance: 10,
        hints: [
          'Quelle pièce blanche n’a pas encore participé ?',
          'La tour f1 peut passer par la troisième rangée.',
          'Tf3 prépare Th3+.',
        ],
        explanation: 'Tf3 apporte la dernière pièce : Th3+ suit. Les Noirs sont perdus.',
      },
    ],
  },
  {
    id: 'classique-immortelle',
    phase: 3,
    title: 'L’Immortelle (Anderssen–Kieseritzky, 1851)',
    summary:
      'Trois pièces mineures contre deux tours, une dame et deux fous : le sacrifice absolu.',
    minutes: 25,
    sections: [
      {
        kind: 'text',
        body: 'Adolf Anderssen joue à Londres contre Lionel Kieseritzky une partie amicale, en marge du premier tournoi international. Il sacrifie fous, tours et dame pour mater avec trois pièces mineures. C’est devenu la partie « immortelle » parce que l’attaque l’emporte sur le matériel.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) le pion g4 et le cavalier f5 : des avant-postes qui ne peuvent pas être chassés ; (2) les deux tours laissées en prise ; (3) comment les cavaliers et le fou se coordonnent pour le mat final.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment: 'Anderssen ouvre par le pion roi, comme toujours à son époque.',
          },
          {
            uci: 'e7e5',
            comment: 'Les Noirs répondent symétriquement.',
          },
          {
            uci: 'f2f4',
            comment:
              'Le gambit du roi : un pion est offert pour ouvrir la colonne f et dominer le centre.',
          },
          {
            uci: 'e5f4',
            comment: 'Les Noirs acceptent le gambit et prennent le pion.',
          },
          {
            uci: 'f1c4',
            comment: 'Le fou vise f7, la case la plus faible du camp noir.',
          },
          {
            uci: 'd8h4',
            comment:
              'La dame sort avec échec sur la diagonale e1-h4, ouverte parce que le pion f2 est parti.',
          },
          {
            uci: 'e1f1',
            comment:
              'Le roi perd le droit de roquer ; Anderssen accepte ce prix pour garder son fou et son initiative.',
          },
          {
            uci: 'b7b5',
            comment: 'Les Noirs offrent un pion pour chasser le fou c4 de sa diagonale.',
          },
          {
            uci: 'c4b5',
            comment: 'Le fou prend le pion b5 et garde un œil sur e8.',
          },
          {
            uci: 'g8f6',
            comment: 'Les Noirs développent le cavalier et attaquent e4.',
          },
          {
            uci: 'g1f3',
            comment: 'Le cavalier sort avec gain de temps : il attaque la dame noire.',
          },
          {
            uci: 'h4h6',
            comment: 'La dame se retire en h6, tout en protégeant le pion f4.',
          },
          {
            uci: 'd2d3',
            comment: 'Un coup tranquille : d3 protège e4 et libère le fou c1.',
          },
          {
            uci: 'f6h5',
            comment: 'Le cavalier h5 protège f4 et menace Cg3+.',
          },
          {
            uci: 'f3h4',
            comment: 'Le cavalier vise f5 pour attaquer la dame.',
          },
          {
            uci: 'h6g5',
            comment: 'La dame va en g5 et attaque le cavalier h4.',
          },
          {
            uci: 'h4f5',
            comment:
              'Le cavalier f5 s’installe : il attaque la dame, les cases g7 et h6, et il ne peut être chassé par un pion.',
          },
          {
            uci: 'c7c6',
            comment:
              'Les Noirs attaquent le fou b5 plutôt que de chercher la sécurité de leur roi.',
          },
          {
            uci: 'g2g4',
            comment:
              'Un pion est offert pour attaquer le cavalier h5 : Anderssen ignore le matériel et pense aux colonnes ouvertes.',
          },
          {
            uci: 'h5f6',
            comment:
              'Le cavalier h5 retourne en f6 : il quitte le jeu et laisse la colonne g libre.',
          },
          {
            uci: 'h1g1',
            comment: 'La tour prend la colonne g, ouverte, et vise le pion g7.',
          },
          {
            uci: 'c6b5',
            comment:
              'Les Noirs prennent le fou : ils ont désormais fou et pions de plus, mais leur roi est resté au centre.',
          },
          {
            uci: 'h2h4',
            comment: 'Le pion h attaque la dame noire.',
          },
          {
            uci: 'g5g6',
            comment: 'La dame se retire en g6, pas très loin du centre.',
          },
          {
            uci: 'h4h5',
            comment: 'Le pion h5 attaque encore la dame noire.',
          },
          {
            uci: 'g6g5',
            comment: 'La dame retourne en g5 en attaquant le cavalier f5.',
          },
          {
            uci: 'd1f3',
            comment: 'La dame arrive : elle prépare Fxf4, qui attaquerait la dame g5.',
          },
          {
            uci: 'f6g8',
            comment: 'Les Noirs libèrent la case f6 pour leur dame.',
          },
          {
            uci: 'c1f4',
            comment: 'Le fou prend le pion f4 avec gain de temps sur la dame g5.',
          },
          {
            uci: 'g5f6',
            comment: 'La dame va en f6, mais elle s’éloigne de la défense du roi noir.',
          },
          {
            uci: 'b1c3',
            comment: 'Le dernier cavalier sort et renforce la case d5.',
          },
          {
            uci: 'f8c5',
            comment: 'Le fou noir attaque la tour g1 : Anderssen est prêt à la sacrifier.',
          },
          {
            uci: 'c3d5',
            comment:
              'Le cavalier d5 attaque la dame f6 et la case c7 : les Blancs gardent l’initiative.',
          },
          {
            uci: 'f6b2',
            comment:
              'La dame prend le pion b2, attaque la tour a1 et s’échappe de l’attaque du cavalier.',
          },
          {
            uci: 'f4d6',
            comment:
              'Le fou d6 coupe le roi noir de f8 et de c7, et menace une attaque de mat. Anderssen laisse deux tours en prise.',
          },
          {
            uci: 'c5g1',
            comment: 'Les Noirs prennent la première tour.',
          },
          {
            uci: 'e4e5',
            comment:
              'Le pion e5 coupe la grande diagonale, empêchant la dame noire de défendre g7.',
          },
          {
            uci: 'b2a1',
            comment: 'Les Noirs prennent la seconde tour avec échec.',
          },
          {
            uci: 'f1e2',
            comment: 'Le roi se met à l’abri sur e2 ; il est seul, mais assez bien protégé.',
          },
          {
            uci: 'b8a6',
            comment: 'Les Noirs sortent leur dernier cavalier, mais ce coup ne défend pas g7.',
          },
          {
            uci: 'f5g7',
            comment: 'Échec : le cavalier prend g7 et ouvre le dernier acte.',
          },
          {
            uci: 'e8d8',
            comment:
              'Le roi n’a qu’une case : f8 est attaquée par le fou d6, e7 contrôlée par fou et cavaliers.',
          },
          {
            uci: 'f3f6',
            comment: 'Sacrifice de dame : l’échec force le cavalier g8 à prendre.',
          },
          {
            uci: 'g8f6',
            comment:
              'Le cavalier est obligé de prendre : il quitte g8 et laisse la case e7 à la merci du fou.',
          },
          {
            uci: 'd6e7',
            comment:
              'Mat : le fou e7, protégé par les deux cavaliers, et le cavalier g7 couvrent toutes les cases. Le roi est enfermé par ses propres pièces c8 et d7. Trois pièces mineures contre deux tours : la partie « immortelle ».',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : le matériel n’est qu’un moyen. Quand le roi adverse est au centre et qu’on a des pièces actives, une attaque peut valoir plus que deux tours. Mais seulement si on a calculé jusqu’au bout.',
      },
    ],
    exercises: [
      {
        fen: 'rnb1kbnr/pppp1ppp/8/8/2B1Pp1q/8/PPPP2PP/RNBQK1NR w KQkq - 2 4',
        prompt:
          'Les Noirs viennent de donner échec avec Dh4. Comment répondre sans abandonner la colonne f ?',
        mode: 'engine',
        solution: ['e1f1'],
        tolerance: 10,
        traps: ['g2g3'],
        hints: [
          'Le roi peut-il se déplacer ? Où ?',
          'Un coup de pion g3 coûterait un pion de plus.',
          'Rf1 : on perd le roque mais on garde la colonne f.',
        ],
        explanation:
          'Rf1 est le coup le plus fort. g3? fxg3 ouvre la position et la dame h4 devient très dangereuse.',
      },
      {
        fen: 'rnb1kb1r/p1pp1ppp/8/1B4qn/4Pp1N/3P4/PPP3PP/RNBQ1K1R w kq - 3 9',
        prompt: 'La dame noire attaque le cavalier h4. Quel coup d’avant-poste prends-tu ?',
        mode: 'engine',
        solution: ['h4f5'],
        tolerance: 10,
        traps: ['g2g3'],
        hints: [
          'Quelle case contrôle h6 et g7 ?',
          'Un cavalier central difficile à déloger.',
          'Cf5.',
        ],
        explanation:
          'Cf5 : avant-poste intouchable, et il attaque la dame. g3? perd du temps et le cavalier h4.',
      },
      {
        fen: 'rnb1kb1r/p2p1ppp/2p5/1B3Nqn/4Pp2/3P4/PPP3PP/RNBQ1K1R w kq - 0 10',
        prompt:
          'Les Noirs ont joué c6. Quel pion sacrifies-tu pour attaquer le cavalier h5 et ouvrir la colonne g ?',
        mode: 'choice',
        solution: ['g2g4'],
        accepted: ['g2g4'],
        hints: [
          'Quel pion peut attaquer le cavalier h5 ?',
          'Il ouvre la colonne g pour la tour.',
          'g4.',
        ],
        explanation:
          'g4 attaque le cavalier h5 et ouvre la colonne g. Le coup n’est pas le meilleur selon le moteur, mais il crée des menaces concrètes : c’est un sacrifice de pion de plus, au nom de l’attaque.',
      },
      {
        fen: 'rnb1kbnr/p2p1ppp/8/1p3NqP/4PpP1/3P1Q2/PPP5/RNB2KR1 w kq - 3 15',
        prompt:
          'Les Blancs peuvent reprendre le pion f4. Joue le coup qui attaque la dame au passage.',
        mode: 'engine',
        solution: ['c1f4'],
        tolerance: 8,
        hints: ['Quelle pièce peut prendre f4 ?', 'Le fou c1 est encore dans le camp.', 'Fxf4.'],
        explanation: 'Fxf4 reprend le pion et attaque la dame g5 : les Blancs gagnent du temps.',
      },
      {
        fen: 'rnb1kbnr/p2p1ppp/5q2/1p3N1P/4PBP1/3P1Q2/PPP5/RN3KR1 w kq - 1 16',
        prompt: 'Il manque un cavalier à ton attaque. Lequel sors-tu pour renforcer la case d5 ?',
        mode: 'engine',
        solution: ['b1c3'],
        tolerance: 8,
        hints: ['Quelle pièce n’est pas encore développée ?', 'Le cavalier b1 vise d5.', 'Cc3.'],
        explanation: 'Cc3 développe la dernière pièce et prépare Cd5.',
      },
      {
        fen: 'r1b1k1nr/p2p1ppp/n2B4/1p1NPN1P/6P1/3P1Q2/P1P1K3/q5b1 w kq - 2 21',
        prompt:
          'Les Noirs ont pris deux tours avec échec. Il est temps de finir : trouve le mat en 3 (ta suite complète).',
        mode: 'exact',
        solution: ['f5g7', 'e8d8', 'f3f6', 'g8f6', 'd6e7'],
        hints: [
          'Quel cavalier prend avec échec ?',
          'Après Rd8, une dame sacrifiée en f6 change tout.',
          'Cxg7+ Rd8, Df6+ Cxf6, Fe7#.',
        ],
        explanation:
          'Cxg7+ Rd8 Df6+! Cxf6 Fe7# : trois pièces mineures mattent un roi entouré de ses propres pièces.',
      },
    ],
  },
  {
    id: 'classique-evergreen',
    phase: 3,
    title: 'La Sempervirens (Anderssen–Dufresne, 1852)',
    summary: 'Une attaque de sacrifices : tour, dame, fou pour un mat à l’ancienne.',
    minutes: 25,
    sections: [
      {
        kind: 'text',
        body: 'Jean Dufresne a affronté Adolf Anderssen à Berlin en 1852. La partie, appelée « sempervirens » (toujours verte), est une brillante illustration du gambit Evans. Anderssen gagne en 24 coups avec des sacrifices de tour et de dame.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) le gambit Evans : un pion offert pour des temps de développement ; (2) l’avantage de développement qui compense le matériel ; (3) la combinaison finale : tour, dame puis deux fous.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment: 'Anderssen ouvre en occupant le centre.',
          },
          {
            uci: 'e7e5',
            comment: 'Son adversaire répond symétriquement.',
          },
          {
            uci: 'g1f3',
            comment: 'Le cavalier attaque e5 en se développant.',
          },
          {
            uci: 'b8c6',
            comment: 'Le cavalier défend e5.',
          },
          {
            uci: 'f1c4',
            comment: 'Le fou vise f7 : la partie italienne.',
          },
          {
            uci: 'f8c5',
            comment: 'Les Noirs sortent aussi leur fou.',
          },
          {
            uci: 'b2b4',
            comment:
              'Le gambit Evans : un pion est offert pour gagner du temps sur le fou et ouvrir le centre.',
          },
          {
            uci: 'c5b4',
            comment: 'Les Noirs acceptent le pion, mais leur fou a perdu un temps.',
          },
          {
            uci: 'c2c3',
            comment: 'Le pion attaque le fou et prépare d4 : les Blancs veulent un grand centre.',
          },
          {
            uci: 'b4a5',
            comment: 'Le fou se retire sur la diagonale a5-e1, où il surveille c3.',
          },
          {
            uci: 'd2d4',
            comment: 'Les Blancs ont maintenant un centre complet avec e4 et d4.',
          },
          {
            uci: 'e5d4',
            comment: 'Les Noirs prennent d4 : la colonne e va s’ouvrir.',
          },
          {
            uci: 'e1g1',
            comment:
              'Au lieu de reprendre le pion, Anderssen roque : il préfère le développement au matériel.',
          },
          {
            uci: 'd4d3',
            comment: 'Le pion noir avance en d3 : il gêne le fou c1 mais il est exposé.',
          },
          {
            uci: 'd1b3',
            comment:
              'La dame vise f7 : la batterie dame-fou sur la diagonale b3-g8 menace de gagner du matériel.',
          },
          {
            uci: 'd8f6',
            comment: 'La dame défend f7 et attaque le cavalier f3.',
          },
          {
            uci: 'e4e5',
            comment: 'Le pion e5 attaque la dame : gain de temps.',
          },
          {
            uci: 'f6g6',
            comment: 'La dame se retire en g6 : elle surveille g2 et la colonne g.',
          },
          {
            uci: 'f1e1',
            comment: 'La tour prend la colonne e, ouverte.',
          },
          {
            uci: 'g8e7',
            comment: 'Le cavalier développe et prépare le roque.',
          },
          {
            uci: 'c1a3',
            comment: 'Le fou a3 empêche le roque noir : la case f8 est attaquée.',
          },
          {
            uci: 'b7b5',
            comment: 'Les Noirs veulent chasser le fou c4, mais ils ouvrent leur aile dame.',
          },
          {
            uci: 'b3b5',
            comment: 'La dame prend le pion b5 et prépare Dxb7.',
          },
          {
            uci: 'a8b8',
            comment: 'La tour noire attaque la dame b5.',
          },
          {
            uci: 'b5a4',
            comment: 'La dame se retire en gardant le pion b7 à l’œil.',
          },
          {
            uci: 'a5b6',
            comment: 'Le fou b6 défend la dame et surveille f2.',
          },
          {
            uci: 'b1d2',
            comment: 'Le cavalier se développe sans perdre de temps.',
          },
          {
            uci: 'c8b7',
            comment: 'Le fou b7 se développe, mais il est gêné par son propre cavalier c6.',
          },
          {
            uci: 'd2e4',
            comment: 'Le cavalier e4 est actif : il menace Cf6+.',
          },
          {
            uci: 'g6f5',
            comment: 'La dame sort pour attaquer le cavalier e4.',
          },
          {
            uci: 'c4d3',
            comment: 'Le fou prend d3 : il récupère un pion et libère la diagonale b3.',
          },
          {
            uci: 'f5h5',
            comment: 'La dame attaque le cavalier f3 : Anderssen doit calculer avant de continuer.',
          },
          {
            uci: 'e4f6',
            comment: 'Échec : le cavalier saute en f6 pour attaquer le roi.',
          },
          {
            uci: 'g7f6',
            comment: 'Les Noirs prennent le cavalier, forcés.',
          },
          {
            uci: 'e5f6',
            comment: 'Le pion reprend et ouvre la colonne e.',
          },
          {
            uci: 'h8g8',
            comment: 'La tour noire attaque g2.',
          },
          {
            uci: 'a1d1',
            comment:
              'Anderssen ne défend pas son cavalier f3 : il apporte un dernier renfort sur la colonne d.',
          },
          {
            uci: 'h5f3',
            comment:
              'La dame noire prend le cavalier f3 : les Noirs gagnent du matériel, mais Anderssen a un plan.',
          },
          {
            uci: 'e1e7',
            comment: 'Sacrifice de tour avec échec : le cavalier c6 doit prendre.',
          },
          {
            uci: 'c6e7',
            comment: 'Forcé : le cavalier prend la tour.',
          },
          {
            uci: 'a4d7',
            comment: 'Sacrifice de dame : le roi noir est forcé de la prendre.',
          },
          {
            uci: 'e8d7',
            comment: 'Les Noirs prennent la dame : le roi quitte son abri.',
          },
          {
            uci: 'd3f5',
            comment: 'Échec : le fou f5 s’attaque au roi.',
          },
          {
            uci: 'd7e8',
            comment: 'Le roi retourne en e8.',
          },
          {
            uci: 'f5d7',
            comment: 'Échec : le fou d7 repousse le roi vers f8.',
          },
          {
            uci: 'e8f8',
            comment: 'Le roi se réfugie en f8.',
          },
          {
            uci: 'a3e7',
            comment:
              'Mat : le fou e7 donne le mat, protégé par le pion f6 ; le roi est enfermé par sa tour g8 et son pion f7.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : un pion ou une pièce donné pour le développement peut être gagnant si l’adversaire a des pièces mal placées. Calcule les sacrifices à fond : Anderssen a vu jusqu’au mat.',
      },
    ],
    exercises: [
      {
        fen: 'r1bqk1nr/pppp1ppp/2n5/b7/2B1P3/2Pp1N2/P4PPP/RNBQ1RK1 w kq - 0 8',
        prompt: 'Les Noirs ont avancé d3. Comment poursuivre l’attaque sur f7 ?',
        mode: 'engine',
        solution: ['d1b3'],
        tolerance: 10,
        hints: [
          'Quelle pièce n’attaque pas encore f7 ?',
          'La dame et le fou peuvent former une batterie.',
          'Db3.',
        ],
        explanation: 'Db3 forme une batterie avec le fou c4 sur f7.',
      },
      {
        fen: 'r1b1k1nr/pppp1ppp/2n2q2/b7/2B1P3/1QPp1N2/P4PPP/RNB2RK1 w kq - 2 9',
        prompt: 'La dame noire est en f6 : quel coup de pion la chasse avec gain de temps ?',
        mode: 'engine',
        solution: ['e4e5'],
        tolerance: 8,
        hints: ['Quelle poussée de pion attaque une pièce ?', 'Le pion e4 peut avancer.', 'e5.'],
        explanation: 'e5 chasse la dame avec gain de temps.',
      },
      {
        fen: 'r1b1k2r/p1ppnppp/2n3q1/bp2P3/2B5/BQPp1N2/P4PPP/RN2R1K1 w kq - 0 12',
        prompt:
          'Les Noirs viennent de jouer b5. Quelle pièce peut capturer le pion sans rien perdre ?',
        mode: 'engine',
        solution: ['b3b5'],
        tolerance: 8,
        hints: ['Qui attaque b5 ?', 'Le fou c4 et la dame b3 peuvent prendre.', 'Dxb5 ou Fxb5.'],
        explanation: 'Dxb5 (ou Fxb5) gagne le pion avec gain de temps.',
      },
      {
        fen: '1rb1k2r/p1ppnppp/2n3q1/bQ2P3/2B5/B1Pp1N2/P4PPP/RN2R1K1 w k - 1 13',
        prompt: 'La tour noire attaque ta dame. Où la poses-tu ?',
        mode: 'engine',
        solution: ['b5a4'],
        tolerance: 8,
        traps: ['f3h4'],
        hints: [
          'La dame est-elle attaquée ?',
          'Une case qui garde un œil sur le pion b7 et reste défendue.',
          'Da4.',
        ],
        explanation:
          'Da4 : la dame se retire en gardant le contrôle. Ch4? laisse la dame b5 attaquée par la tour.',
      },
      {
        fen: '1r2k2r/pbppnppp/1bn5/4Pq2/Q1B1N3/B1Pp1N2/P4PPP/R3R1K1 w k - 7 16',
        prompt: 'Le pion d3 gêne tes pièces. Que fais-tu pour libérer la diagonale de la dame ?',
        mode: 'engine',
        solution: ['c4d3'],
        tolerance: 8,
        hints: ['Le pion d3 est défendu ou non ?', 'Le fou c4 peut le prendre.', 'Fxd3.'],
        explanation: 'Fxd3 reprend le pion et libère la diagonale b3-g8.',
      },
      {
        fen: '1r2k1r1/pbppnp1p/1bn2P2/8/Q7/B1PB1q2/P4PPP/3RR1K1 w - - 0 20',
        prompt:
          'La dame noire est en f3. Les Blancs gagnent de force : trouve la suite complète jusqu’au mat (4 coups des Blancs).',
        mode: 'exact',
        solution: ['e1e7', 'c6e7', 'a4d7', 'e8d7', 'd3f5', 'd7e8', 'f5d7', 'e8f8', 'a3e7'],
        hints: [
          'Quelle tour sacrifie avec échec ?',
          'Après Cxe7, une dame sacrifiée en d7.',
          'Txe7+ Cxe7, Dxd7+ Rxd7, Ff5+ Re8, Fd7+ Rf8, Fxe7#.',
        ],
        explanation:
          'Txe7+ Cxe7 Dxd7+ Rxd7 Ff5+ Re8 Fd7+ Rf8 Fxe7# : la dame et la tour sont données pour un mat avec deux fous.',
      },
    ],
  },
];
